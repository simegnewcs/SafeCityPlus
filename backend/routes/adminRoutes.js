const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all incidents with media (for admin)
router.get('/incidents/all', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT i.*, 
                   u.full_name as reporter_name,
                   u.phone as reporter_phone,
                   vr.video_url,
                   vr.thumbnail_url,
                   vr.duration as video_duration,
                   GROUP_CONCAT(DISTINCT al.ai_type) as detected_objects
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN video_recordings vr ON i.id = vr.incident_id
            LEFT JOIN ai_logs al ON i.id = al.incident_id
            GROUP BY i.id
            ORDER BY i.created_at DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get incidents by media type
router.get('/incidents/media/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const [rows] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.media_type = ?
            ORDER BY i.created_at DESC
        `, [type]);
        
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get video details for specific incident
router.get('/incidents/:id/video', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [video] = await db.execute(`
            SELECT vr.*, 
                   al.key_frames,
                   al.video_duration,
                   al.ai_type as analysis_summary
            FROM video_recordings vr
            LEFT JOIN ai_logs al ON vr.incident_id = al.incident_id
            WHERE vr.incident_id = ? AND al.media_type = 'video'
            ORDER BY al.created_at DESC
            LIMIT 1
        `, [id]);
        
        if (video.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        res.json(video[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get video analysis key frames
router.get('/incidents/:id/video/frames', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [frames] = await db.execute(`
            SELECT key_frames, video_duration
            FROM ai_logs
            WHERE incident_id = ? AND media_type = 'video'
            ORDER BY created_at DESC
            LIMIT 1
        `, [id]);
        
        if (frames.length === 0) {
            return res.json({ frames: [], duration: 0 });
        }
        
        const keyFrames = JSON.parse(frames[0].key_frames || '[]');
        res.json({
            frames: keyFrames,
            duration: frames[0].video_duration
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update camera stream status
router.put('/cameras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, is_recording } = req.body;
        
        await db.execute(`
            UPDATE camera_streams 
            SET status = ?, is_recording = ?, updated_at = NOW()
            WHERE id = ?
        `, [status, is_recording, id]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;