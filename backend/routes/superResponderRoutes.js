const express = require('express');
const router = express.Router();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// Save frame buffer to disk and record clip metadata
async function saveIncidentClip(req, incidentId, streamId) {
    try {
        const activeStreams = req.app.get('activeStreams');
        if (!activeStreams) return null;
        const stream = streamId ? activeStreams.get(streamId) : null;
        // If no specific streamId, find any active stream
        const target = stream || (activeStreams.size > 0 ? activeStreams.values().next().value : null);
        if (!target || !target.frameBuffer || target.frameBuffer.length === 0) return null;

        const clipDir = path.join(__dirname, '..', 'uploads', 'clips', `incident_${incidentId}_${Date.now()}`);
        fs.mkdirSync(clipDir, { recursive: true });

        const frames = target.frameBuffer.slice(-60); // last ~60 frames
        for (let i = 0; i < frames.length; i++) {
            const b64 = frames[i].frame;
            if (!b64) continue;
            const buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fs.writeFileSync(path.join(clipDir, `frame_${String(i).padStart(4, '0')}.jpg`), buf);
        }

        const relDir = clipDir.replace(path.join(__dirname, '..'), '').replace(/\\/g, '/');
        await db.execute(
            'INSERT INTO incident_clips (incident_id, stream_id, clip_dir, frame_count) VALUES (?, ?, ?, ?)',
            [incidentId, target.streamId || streamId || null, relDir, frames.length]
        );
        await db.execute(
            'UPDATE ai_incidents SET clip_dir = ?, clip_frame_count = ? WHERE id = ?',
            [relDir, frames.length, incidentId]
        );
        console.log(`🎬 Saved ${frames.length} frames for incident ${incidentId} → ${relDir}`);
        return { clipDir: relDir, frameCount: frames.length };
    } catch (err) {
        console.error('saveIncidentClip error:', err.message);
        return null;
    }
}

// GET /api/super-responder/incidents  — list all AI incidents with assigner name
router.get('/incidents', async (req, res) => {
    try {
        const { status } = req.query;
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
        let sql = `
            SELECT ai.*,
                   u.full_name AS assigned_by_name,
                   vr.recording_dir AS recording_dir, vr.frame_count AS recording_frame_count
            FROM ai_incidents ai
            LEFT JOIN users u ON u.id = ai.assigned_by_user_id
            LEFT JOIN video_recordings vr ON vr.id = ai.recording_id
        `;
        const params = [];
        if (status) { sql += ' WHERE ai.status = ?'; params.push(status); }
        sql += ` ORDER BY ai.created_at DESC LIMIT ${limit}`;
        const [rows] = await db.execute(sql, params);
        const incidents = rows.map(row => {
            try { if (typeof row.assigned_to_types === 'string') row.assigned_to_types = JSON.parse(row.assigned_to_types); } catch {}
            try { if (typeof row.ai_metadata === 'string') row.ai_metadata = JSON.parse(row.ai_metadata); } catch {}
            return row;
        });
        res.json(incidents);
    } catch (err) {
        console.error('GET /incidents error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/incidents/:id
router.get('/incidents/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT ai.*, u.full_name AS assigned_by_name
            FROM ai_incidents ai
            LEFT JOIN users u ON u.id = ai.assigned_by_user_id
            WHERE ai.id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        const row = rows[0];
        try { if (typeof row.assigned_to_types === 'string') row.assigned_to_types = JSON.parse(row.assigned_to_types); } catch {}
        try { if (typeof row.ai_metadata === 'string') row.ai_metadata = JSON.parse(row.ai_metadata); } catch {}
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/super-responder/incidents/:id/assign  — manual assignment
router.post('/incidents/:id/assign', async (req, res) => {
    try {
        const { assignedTypes, notes, assignedByUserId, assignedByName } = req.body;
        await db.execute(
            `UPDATE ai_incidents SET
                status = 'assigned',
                assigned_to_types = ?,
                assigned_by = 'manual',
                assigned_by_user_id = ?,
                assigned_at = NOW(),
                notes = ?
             WHERE id = ?`,
            [JSON.stringify(assignedTypes || []), assignedByUserId || null, notes || null, req.params.id]
        );
        const [rows] = await db.execute(`
            SELECT ai.*, u.full_name AS assigned_by_name
            FROM ai_incidents ai
            LEFT JOIN users u ON u.id = ai.assigned_by_user_id
            WHERE ai.id = ?
        `, [req.params.id]);
        const incident = rows[0];

        let parsedTypes = assignedTypes || [];
        try {
            if (typeof incident.assigned_to_types === 'string')
                parsedTypes = JSON.parse(incident.assigned_to_types);
            else if (Array.isArray(incident.assigned_to_types))
                parsedTypes = incident.assigned_to_types;
        } catch {}

        const payload = {
            id:                 incident.id,
            decision:           incident.decision,
            severity:           incident.severity,
            incidentCategory:   incident.incident_category,
            incident_category:  incident.incident_category,
            location:           incident.location,
            cameraName:         incident.camera_name,
            accidentConfidence: incident.accident_confidence,
            priorityScore:      incident.priority_score,
            assignedTypes:      parsedTypes,
            assigned_to_types:  parsedTypes,
            assignedBy:         assignedByName || incident.assigned_by_name || 'Super Responder',
            assignedByUserId:   assignedByUserId || null,
            notes:              incident.notes,
            status:             incident.status,
            assignedAt:         incident.assigned_at,
            timestamp:          incident.assigned_at || incident.created_at,
            latitude:           incident.latitude,
            longitude:          incident.longitude,
        };

        // Save live clip from active stream (legacy clip system)
        const clipMeta = await saveIncidentClip(req, req.params.id, incident.stream_id);
        if (clipMeta) payload.clipDir = clipMeta.clipDir;
        if (clipMeta) payload.clipFrameCount = clipMeta.frameCount;

        // Save auto-rec buffer for this stream (new 20s buffer system)
        const saveAutoRec = req.app.get('saveAutoRecording');
        const setRecState = req.app.get('setAutoRecState');
        const autoRecBuffers = req.app.get('autoRecBuffers');
        console.log(`[AutoRec] assign check: stream_id=${incident.stream_id}, saveAutoRec=${!!saveAutoRec}, bufferCount=${autoRecBuffers?.size}`);
        if (saveAutoRec && incident.stream_id) {
            const autoBuf = autoRecBuffers?.get(incident.stream_id);
            console.log(`[AutoRec] buf for stream: ${autoBuf ? `frames=${autoBuf.frames.length} state=${autoBuf.state}` : 'NOT FOUND'}`);
            if (autoBuf && autoBuf.frames.length > 0 && autoBuf.state !== 'saved') {
                clearTimeout(autoBuf.discardTimer);
                const autoRec = await saveAutoRec(incident.stream_id, req.params.id);
                console.log(`[AutoRec] saveAutoRec result:`, autoRec);
                if (autoRec) {
                    autoBuf.state = 'saved';
                    if (setRecState) setRecState(incident.stream_id, 'saved', { recordingId: autoRec.recordingId });
                    payload.autoRecordingDir = autoRec.relDir;
                    payload.autoRecordingId = autoRec.recordingId;
                    console.log(`✅ Auto-recording saved for incident ${req.params.id}: ${autoRec.relDir}`);
                }
            } else if (!autoBuf) {
                console.log(`[AutoRec] ⚠️ No buffer found for stream_id=${incident.stream_id}. Available buffers: ${[...autoRecBuffers.keys()].join(', ')}`);
            }
        }

        const io = req.app.get('socketio');
        if (io) {
            io.emit('incident-assigned', payload);
            io.emit('super-responder-incident-updated', { id: incident.id, status: 'assigned', assignedTypes: parsedTypes, clipDir: payload.clipDir });
            if (payload.autoRecordingDir) io.emit('stream-recorded', { streamId: incident.stream_id, recordingId: payload.autoRecordingId });
        }

        incident.assigned_to_types = parsedTypes;
        incident.clip_dir = payload.clipDir || incident.clip_dir;
        incident.clip_frame_count = payload.clipFrameCount || incident.clip_frame_count;
        res.json({ success: true, incident, clip: clipMeta || null });
    } catch (err) {
        console.error('POST /incidents/:id/assign error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/incidents/:id/clip — list saved frames for playback
router.get('/incidents/:id/clip', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM incident_clips WHERE incident_id = ? ORDER BY recorded_at DESC LIMIT 1',
            [req.params.id]
        );
        if (!rows.length) return res.json({ success: false, frames: [], message: 'No clip recorded' });
        const clip = rows[0];
        const clipPath = path.join(__dirname, '..', clip.clip_dir);
        if (!fs.existsSync(clipPath)) return res.json({ success: false, frames: [], message: 'Clip files missing' });
        const files = fs.readdirSync(clipPath)
            .filter(f => f.endsWith('.jpg'))
            .sort()
            .map(f => `/uploads/clips/${path.basename(clip.clip_dir)}/${f}`);
        res.json({ success: true, frameCount: files.length, frames: files, recordedAt: clip.recorded_at });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/super-responder/incidents/:id/status
router.put('/incidents/:id/status', async (req, res) => {
    try {
        const { status, notes } = req.body;
        const extra = status === 'resolved' ? ', resolved_at = NOW()' : '';
        await db.execute(
            `UPDATE ai_incidents SET status = ?, notes = COALESCE(?, notes)${extra} WHERE id = ?`,
            [status, notes || null, req.params.id]
        );
        // Emit real-time update so all assigned responders see status change
        const [rows] = await db.execute('SELECT id, status, assigned_to_types, incident_category FROM ai_incidents WHERE id = ?', [req.params.id]);
        if (rows.length) {
            const inc = rows[0];
            let types = [];
            try { types = typeof inc.assigned_to_types === 'string' ? JSON.parse(inc.assigned_to_types) : (inc.assigned_to_types || []); } catch {}
            const io = req.app.get('socketio');
            if (io) io.emit('incident-status-updated', {
                id: inc.id,
                status,
                assigned_to_types: types,
                incident_category: inc.incident_category,
            });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('PUT /incidents/:id/status error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/super-responder/incidents/:id
router.delete('/incidents/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
        const [r] = await db.execute('DELETE FROM ai_incidents WHERE id = ?', [id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Incident not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /incidents/:id error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/super-responder/recordings/manual — save a manually recorded clip from the frontend
router.post('/recordings/manual', async (req, res) => {
    console.log('🎬 POST /recordings/manual hit — frames:', Array.isArray(req.body?.frames) ? req.body.frames.length : 'none');
    try {
        const { streamId, cameraName, location, frames } = req.body;
        if (!frames || !frames.length) return res.status(400).json({ error: 'No frames provided' });

        const recordingDir = path.join(__dirname, '..', 'uploads', 'recordings', `manual_${streamId || 'unknown'}_${Date.now()}`);
        fs.mkdirSync(recordingDir, { recursive: true });

        let saved = 0;
        for (let i = 0; i < frames.length; i++) {
            const b64 = frames[i].frame;
            if (!b64) continue;
            const buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fs.writeFileSync(path.join(recordingDir, `frame_${String(i).padStart(5, '0')}.jpg`), buf);
            saved++;
        }

        const relDir = '/uploads/recordings/' + path.basename(recordingDir);
        const duration = frames.length > 1
            ? Math.round((frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000)
            : 0;

        // Check which columns exist before inserting
        const [cols] = await db.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'video_recordings'`
        );
        const colNames = cols.map(c => c.COLUMN_NAME);
        console.log('📋 video_recordings columns:', colNames.join(', '));

        // Build INSERT dynamically based on existing columns — handles any schema variant
        const fields = ['created_at'];
        const values = ['NOW()'];
        const params = [];
        const add = (col, val) => { if (colNames.includes(col)) { fields.push(`\`${col}\``); values.push('?'); params.push(val); } };
        add('stream_id', streamId || null);
        add('camera_name', cameraName || 'Manual Recording');
        add('location', location || '');
        add('frame_count', saved);
        add('duration_seconds', duration);
        add('duration', duration);
        add('recording_dir', relDir);
        add('video_url', relDir);
        add('thumbnail_url', null);
        add('camera_id', null);
        add('incident_id', null);
        add('start_time', new Date());
        add('end_time', new Date());
        add('file_size', 0);
        add('ai_analyzed', 0);

        await db.execute(
            `INSERT INTO video_recordings (${fields.join(', ')}) VALUES (${values.join(', ')})`,
            params
        );

        const io = req.app.get('socketio');
        if (io) io.emit('stream-recorded', { streamId, cameraName, location, frameCount: saved, duration, recordingDir: relDir });

        console.log(`🎬 Manual recording saved: ${saved} frames, ${duration}s → ${relDir}`);
        res.json({ success: true, frameCount: saved, duration, recordingDir: relDir });
    } catch (err) {
        console.error('POST /recordings/manual error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/recordings — list all saved stream recordings (only valid ones)
router.get('/recordings', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, stream_id, camera_name, location, frame_count,
                    COALESCE(duration_seconds, duration, 0) AS duration_seconds,
                    COALESCE(recording_dir, video_url) AS recording_dir,
                    incident_id, created_at
             FROM video_recordings
             WHERE frame_count > 0 AND COALESCE(recording_dir, video_url) IS NOT NULL AND COALESCE(recording_dir, video_url) != ''
             ORDER BY created_at DESC LIMIT 100`
        );
        res.json({ success: true, recordings: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/super-responder/recordings/:id — delete a recording entry
router.delete('/recordings/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
        const [rows] = await db.execute('SELECT recording_dir FROM video_recordings WHERE id = ?', [id]);
        if (rows.length && rows[0].recording_dir) {
            const relDir = rows[0].recording_dir.replace(/^[/\\]+/, '');
            const diskPath = path.join(__dirname, '..', relDir);
            try { fs.rmSync(diskPath, { recursive: true, force: true }); } catch {}
        }
        await db.execute('DELETE FROM video_recordings WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/recordings/:id/frames — get playable frame URLs for a recording
router.get('/recordings/:id/frames', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid recording id' });
        const [rows] = await db.execute(
            `SELECT id, stream_id, camera_name, location, frame_count,
                    COALESCE(duration_seconds, duration, 0) AS duration_seconds,
                    COALESCE(recording_dir, video_url) AS recording_dir,
                    created_at FROM video_recordings WHERE id = ?`,
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Recording not found' });
        const rec = rows[0];
        console.log('📂 Recording row id=%s dir=%s', rec.id, rec.recording_dir);
        if (!rec.recording_dir) return res.json({ success: false, frames: [], message: 'Recording has no directory saved' });

        // Resolve disk path — always treat /uploads/... as relative to backend root
        const rawDir = rec.recording_dir;
        let recPath;
        if (rawDir.startsWith('/uploads') || rawDir.startsWith('\\uploads') || rawDir.startsWith('uploads')) {
            // URL-style or relative path — strip leading slash and resolve from backend root
            recPath = path.join(__dirname, '..', rawDir.replace(/^[/\\]+/, ''));
        } else if (path.isAbsolute(rawDir) && fs.existsSync(rawDir)) {
            recPath = rawDir; // genuine absolute disk path that exists
        } else {
            recPath = path.join(__dirname, '..', rawDir.replace(/^[/\\]+/, ''));
        }
        console.log('📂 Resolved path:', recPath, '| exists:', fs.existsSync(recPath));
        if (!fs.existsSync(recPath)) return res.json({ success: false, frames: [], message: `Files missing on disk: ${recPath}` });

        // Build URL-style path for serving via /uploads static route
        const dirName = path.basename(recPath);
        const serveBase = `/uploads/recordings/${dirName}`;

        const files = fs.readdirSync(recPath)
            .filter(f => f.endsWith('.jpg'))
            .sort()
            .map(f => `${serveBase}/${f}`);
        res.json({ success: true, recording: rec, frames: files });
    } catch (err) {
        console.error('GET /recordings/:id/frames error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/settings
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT setting_key, setting_value FROM system_settings');
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/super-responder/settings
router.put('/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        await db.execute(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, String(value), String(value)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/my-incidents — get incidents assigned to current responder type
router.get('/my-incidents', async (req, res) => {
    try {
        const { responderType, status, limit = 50 } = req.query;
        
        if (!responderType) {
            return res.status(400).json({ error: 'responderType query parameter required' });
        }
        
        const queryLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
        
        // Query incidents where assigned_to_types JSON array contains the responderType string
        // Guard against NULL assigned_to_types with IFNULL
        let sql = `
            SELECT ai.*, u.full_name AS assigned_by_name
            FROM ai_incidents ai
            LEFT JOIN users u ON u.id = ai.assigned_by_user_id
            WHERE ai.assigned_to_types IS NOT NULL
              AND JSON_CONTAINS(ai.assigned_to_types, JSON_QUOTE(?))
        `;
        const params = [responderType];
        
        if (status) {
            sql += ' AND ai.status = ?';
            params.push(status);
        }
        
        sql += ` ORDER BY ai.priority_score DESC, ai.created_at DESC LIMIT ${queryLimit}`;
        
        console.log(`GET /my-incidents: type="${responderType}"`);
        const [rows] = await db.execute(sql, params);
        console.log(`GET /my-incidents: found ${rows.length} incidents for "${responderType}"`);
        
        // Parse JSON fields for each row
        const incidents = rows.map(row => {
            try {
                if (typeof row.assigned_to_types === 'string') {
                    row.assigned_to_types = JSON.parse(row.assigned_to_types);
                }
                if (typeof row.ai_metadata === 'string') {
                    row.ai_metadata = JSON.parse(row.ai_metadata);
                }
            } catch (e) {}
            return row;
        });
        
        res.json({
            success: true,
            responderType,
            count: incidents.length,
            incidents
        });
    } catch (err) {
        console.error('GET /my-incidents error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/incident-streams — get stream IDs for responder's assigned incidents
router.get('/incident-streams', async (req, res) => {
    try {
        const { responderType, includeActive = 'true' } = req.query;
        
        if (!responderType) {
            return res.status(400).json({ error: 'responderType query parameter required' });
        }
        
        // Get active (non-resolved) incidents assigned to this responder type
        const [rows] = await db.execute(
            `SELECT DISTINCT stream_id, id, decision, severity, priority_score, incident_category, created_at
             FROM ai_incidents 
             WHERE assigned_to_types IS NOT NULL
               AND JSON_VALID(assigned_to_types) = 1
               AND JSON_CONTAINS(assigned_to_types, JSON_QUOTE(?))
             AND status IN ('assigned', 'pending', 'pending_review', 'in_progress')
             ORDER BY priority_score DESC, created_at DESC`,
            [responderType]
        );
        
        res.json({
            success: true,
            responderType,
            accessibleStreams: rows,
            count: rows.length
        });
    } catch (err) {
        console.error('GET /incident-streams error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/super-responder/incidents/:id/reassign — manual reassignment (SuperResponder only)
router.post('/incidents/:id/reassign', async (req, res) => {
    try {
        const { assignedTypes, notes, reassignedBy } = req.body;
        
        // Update the incident with new assignment
        await db.execute(
            `UPDATE ai_incidents SET
                status = 'assigned',
                assigned_to_types = ?,
                assigned_by = 'manual_reassign',
                assigned_at = NOW(),
                notes = CONCAT(COALESCE(notes, ''), '\n[Reassigned by ', ?, ']: ', ?)
             WHERE id = ?`,
            [JSON.stringify(assignedTypes || []), reassignedBy || 'SuperResponder', notes || '', req.params.id]
        );
        
        const [rows] = await db.execute('SELECT * FROM ai_incidents WHERE id = ?', [req.params.id]);
        const incident = rows[0];
        
        // Parse JSON fields
        try {
            if (typeof incident.assigned_to_types === 'string')
                incident.assigned_to_types = JSON.parse(incident.assigned_to_types);
            if (typeof incident.ai_metadata === 'string')
                incident.ai_metadata = JSON.parse(incident.ai_metadata);
        } catch {}
        
        // Notify via socket
        const io = req.app.get('socketio');
        if (io) {
            io.emit('incident-reassigned', {
                id: incident.id,
                streamId: incident.stream_id,
                decision: incident.decision,
                severity: incident.severity,
                priorityScore: incident.priority_score,
                assignedTypes: incident.assigned_to_types,
                reassignedBy: reassignedBy || 'SuperResponder',
                notes: notes,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true, incident });
    } catch (err) {
        console.error('POST /incidents/:id/reassign error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ============================================================================
// CONFUSION MATRIX & AI PERFORMANCE EVALUATION ROUTES
// ============================================================================

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/super-responder/confusion-matrix — Get confusion matrix from AI service
router.get('/confusion-matrix', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get(`${AI_SERVICE_URL}/confusion_matrix`, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (err) {
        console.error('GET /confusion-matrix error:', err.message);
        res.status(500).json({ 
            error: 'Failed to fetch confusion matrix from AI service',
            details: err.message
        });
    }
});

// GET /api/super-responder/performance-metrics — Get AI performance metrics
router.get('/performance-metrics', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get(`${AI_SERVICE_URL}/performance_metrics`, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (err) {
        console.error('GET /performance-metrics error:', err.message);
        res.status(500).json({ 
            error: 'Failed to fetch performance metrics',
            details: err.message
        });
    }
});

// POST /api/super-responder/confusion-matrix/reset — Reset confusion matrix
router.post('/confusion-matrix/reset', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.post(`${AI_SERVICE_URL}/confusion_matrix/reset`, {}, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (err) {
        console.error('POST /confusion-matrix/reset error:', err.message);
        res.status(500).json({ 
            error: 'Failed to reset confusion matrix',
            details: err.message
        });
    }
});

// POST /api/super-responder/confusion-matrix/feedback — Submit ground truth feedback
router.post('/confusion-matrix/feedback', async (req, res) => {
    try {
        const { incidentId, streamId, wasCorrect, actualAlert, notes, userId } = req.body;
        
        // Store feedback in database
        await db.execute(
            `INSERT INTO ai_feedback 
             (incident_id, stream_id, was_correct, actual_alert, notes, user_id, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [incidentId, streamId, wasCorrect, actualAlert, notes, userId]
        );
        
        // Also update confusion matrix in AI service
        const axios = require('axios');
        await axios.post(`${AI_SERVICE_URL}/confusion_matrix/update_alert`, {
            predicted_alert: true,  // AI detected an alert
            actual_alert: actualAlert,
            image_id: incidentId || streamId
        }, { timeout: 5000 });
        
        res.json({ 
            success: true, 
            message: 'Feedback recorded and confusion matrix updated' 
        });
    } catch (err) {
        console.error('POST /confusion-matrix/feedback error:', err.message);
        res.status(500).json({ 
            error: 'Failed to record feedback',
            details: err.message
        });
    }
});

// GET /api/super-responder/confusion-matrix/health — Health check
router.get('/confusion-matrix/health', async (req, res) => {
    try {
        const axios = require('axios');
        const response = await axios.get(`${AI_SERVICE_URL}/confusion_matrix/health`, {
            timeout: 5000
        });
        res.json(response.data);
    } catch (err) {
        console.error('GET /confusion-matrix/health error:', err.message);
        res.status(500).json({ 
            error: 'AI service health check failed',
            details: err.message
        });
    }
});

// GET /api/super-responder/feedback-stats — Get feedback statistics
router.get('/feedback-stats', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                COUNT(*) as total_feedback,
                SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END) as correct_predictions,
                SUM(CASE WHEN was_correct = 0 THEN 1 ELSE 0 END) as incorrect_predictions,
                SUM(CASE WHEN actual_alert = 1 THEN 1 ELSE 0 END) as actual_alerts,
                SUM(CASE WHEN actual_alert = 0 THEN 1 ELSE 0 END) as actual_normal
            FROM ai_feedback
        `);
        
        const stats = rows[0];
        const accuracy = stats.total_feedback > 0 
            ? (stats.correct_predictions / stats.total_feedback * 100).toFixed(2)
            : 0;
        
        res.json({
            total_feedback: stats.total_feedback,
            correct_predictions: stats.correct_predictions,
            incorrect_predictions: stats.incorrect_predictions,
            actual_alerts: stats.actual_alerts,
            actual_normal: stats.actual_normal,
            accuracy_percent: parseFloat(accuracy)
        });
    } catch (err) {
        console.error('GET /feedback-stats error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
