const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/super-responder/incidents  — list all AI incidents
router.get('/incidents', async (req, res) => {
    try {
        const { status } = req.query;
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
        let sql = `SELECT * FROM ai_incidents`;
        const params = [];
        if (status) { sql += ' WHERE status = ?'; params.push(status); }
        sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('GET /incidents error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/incidents/:id
router.get('/incidents/:id', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM ai_incidents WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/super-responder/incidents/:id/assign  — manual assignment
router.post('/incidents/:id/assign', async (req, res) => {
    try {
        const { assignedTypes, notes } = req.body;
        await db.execute(
            `UPDATE ai_incidents SET
                status = 'assigned',
                assigned_to_types = ?,
                assigned_by = 'manual',
                assigned_at = NOW(),
                notes = ?
             WHERE id = ?`,
            [JSON.stringify(assignedTypes || []), notes || null, req.params.id]
        );
        const [rows] = await db.execute('SELECT * FROM ai_incidents WHERE id = ?', [req.params.id]);
        const incident = rows[0];

        // Normalize to camelCase for frontend socket listeners
        let parsedTypes = assignedTypes || [];
        try {
            if (typeof incident.assigned_to_types === 'string')
                parsedTypes = JSON.parse(incident.assigned_to_types);
            else if (Array.isArray(incident.assigned_to_types))
                parsedTypes = incident.assigned_to_types;
        } catch {}

        const io = req.app.get('socketio');
        if (io) io.emit('incident-assigned', {
            id:                 incident.id,
            decision:           incident.decision,
            severity:           incident.severity,
            incidentCategory:   incident.incident_category,
            location:           incident.location,
            cameraName:         incident.camera_name,
            accidentConfidence: incident.accident_confidence,
            assignedTypes:      parsedTypes,
            assignedBy:         incident.assigned_by,
            notes:              incident.notes,
            status:             incident.status,
            timestamp:          incident.assigned_at || incident.created_at,
        });

        res.json({ success: true, incident });
    } catch (err) {
        console.error('POST /incidents/:id/assign error:', err.message);
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
        res.json({ success: true });
    } catch (err) {
        console.error('PUT /incidents/:id/status error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/super-responder/settings
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT `key`, `value` FROM system_settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
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
            'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [key, String(value), String(value)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
