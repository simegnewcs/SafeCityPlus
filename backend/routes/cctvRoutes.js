const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/streams';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '.mp4';
        cb(null, `stream_${timestamp}${ext}`);
    }
});

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for videos
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed.'), false);
        }
    }
});

// Helper function to get Socket.IO instance
const getIO = (req) => {
    return req.app.get('socketio');
};

// ==================== CAMERA MANAGEMENT ====================

// Get all cameras
router.get('/cameras', async (req, res) => {
    try {
        console.log('Fetching cameras...');
        
        // Check if table exists
        const [tables] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'camera_streams'
        `);
        
        if (tables[0].count === 0) {
            // Create table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS camera_streams (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    camera_name VARCHAR(255) NOT NULL,
                    location_name VARCHAR(255),
                    location_lat DECIMAL(10,8),
                    location_lng DECIMAL(11,8),
                    stream_url VARCHAR(500),
                    stream_type ENUM('rtsp', 'hls', 'mp4', 'webrtc') DEFAULT 'rtsp',
                    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
                    is_live BOOLEAN DEFAULT FALSE,
                    resolution VARCHAR(20) DEFAULT '1080p',
                    frame_rate INT DEFAULT 30,
                    is_recording BOOLEAN DEFAULT FALSE,
                    viewers INT DEFAULT 0,
                    last_active TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_live (is_live)
                )
            `);
            console.log('Created camera_streams table');
            
            // Insert sample cameras
            await db.execute(`
                INSERT INTO camera_streams (camera_name, location_name, location_lat, location_lng, stream_url, resolution, status, is_live, last_active) VALUES
                ('Downtown Intersection', 'Bole, Addis Ababa', 9.0117, 38.7468, 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', '1080p', 'active', TRUE, NOW()),
                ('Highway 101', 'Mexico Road, Addis Ababa', 9.0300, 38.7400, 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', '720p', 'active', TRUE, NOW()),
                ('Central Park', 'Piassa, Addis Ababa', 9.0305, 38.7500, NULL, '4K', 'maintenance', FALSE, NOW()),
                ('Airport Terminal', 'Bole International Airport', 8.9777, 38.7993, 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', '1080p', 'active', TRUE, NOW())
            `);
            console.log('Inserted sample cameras');
        }
        
        // Fetch all cameras with viewer count
        const [cameras] = await db.execute(`
            SELECT c.*, 
                   COUNT(DISTINCT v.id) as recording_count,
                   COUNT(DISTINCT a.id) as alert_count,
                   MAX(v.created_at) as last_recording
            FROM camera_streams c
            LEFT JOIN video_recordings v ON c.id = v.camera_id
            LEFT JOIN camera_alerts a ON c.id = a.camera_id
            GROUP BY c.id
            ORDER BY c.is_live DESC, c.status DESC, c.created_at DESC
        `);
        
        console.log(`Found ${cameras.length} cameras`);
        res.json(cameras);
        
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single camera
router.get('/cameras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [cameras] = await db.execute(`
            SELECT c.*, 
                   COUNT(v.id) as recording_count,
                   MAX(v.created_at) as last_recording
            FROM camera_streams c
            LEFT JOIN video_recordings v ON c.id = v.camera_id
            WHERE c.id = ?
            GROUP BY c.id
        `, [id]);
        
        if (cameras.length === 0) {
            return res.status(404).json({ error: 'Camera not found' });
        }
        res.json(cameras[0]);
    } catch (error) {
        console.error('Error fetching camera:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add new camera
router.post('/cameras', async (req, res) => {
    try {
        const { camera_name, location_name, stream_url, resolution, location_lat, location_lng } = req.body;
        
        console.log('Adding camera:', { camera_name, location_name, stream_url, resolution });
        
        if (!camera_name || !location_name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: camera_name, location_name' 
            });
        }
        
        const sql = `INSERT INTO camera_streams 
                     (camera_name, location_name, location_lat, location_lng, stream_url, resolution, status, last_active) 
                     VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`;
        
        const [result] = await db.execute(sql, [
            camera_name, 
            location_name, 
            location_lat || null, 
            location_lng || null, 
            stream_url || null, 
            resolution || '1080p'
        ]);
        
        console.log(`Camera added with ID: ${result.insertId}`);
        res.json({ success: true, id: result.insertId });
        
    } catch (error) {
        console.error('Error adding camera:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update camera
router.put('/cameras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { camera_name, location_name, stream_url, resolution, status } = req.body;
        
        const sql = `UPDATE camera_streams 
                     SET camera_name = COALESCE(?, camera_name),
                         location_name = COALESCE(?, location_name),
                         stream_url = COALESCE(?, stream_url),
                         resolution = COALESCE(?, resolution),
                         status = COALESCE(?, status),
                         updated_at = NOW()
                     WHERE id = ?`;
        
        await db.execute(sql, [camera_name, location_name, stream_url, resolution, status, id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating camera:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update camera status with Socket.IO notification
router.put('/cameras/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await db.execute(
            'UPDATE camera_streams SET status = ?, updated_at = NOW() WHERE id = ?', 
            [status, id]
        );
        
        // Get camera info for notification
        const [cameras] = await db.execute('SELECT camera_name FROM camera_streams WHERE id = ?', [id]);
        const cameraName = cameras[0]?.camera_name || `Camera ${id}`;
        
        // Create alert for status change
        await db.execute(`
            INSERT INTO camera_alerts (camera_id, incident_type, alert_message) 
            VALUES (?, 'Camera Status Change', ?)
        `, [id, `Camera ${cameraName} status changed to ${status}`]);
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('camera-status-change', {
                cameraId: id,
                cameraName: cameraName,
                status: status,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating camera:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== LIVE STREAMING ====================

// Start a new live stream from mobile
router.post('/start-stream', async (req, res) => {
    try {
        const { camera_name, location_name, stream_url, user_id, latitude, longitude, duration } = req.body;
        
        const sql = `INSERT INTO camera_streams 
                     (camera_name, location_name, location_lat, location_lng, stream_url, status, is_live, viewers, last_active) 
                     VALUES (?, ?, ?, ?, ?, 'active', TRUE, 1, NOW())`;
        
        const [result] = await db.execute(sql, [
            camera_name || 'Mobile Stream',
            location_name || 'Current Location',
            latitude || null,
            longitude || null,
            stream_url || `/uploads/streams/stream_${Date.now()}.mp4`,
        ]);
        
        const streamId = result.insertId;
        
        // Create alert for admin
        await db.execute(`
            INSERT INTO camera_alerts (camera_id, incident_type, alert_message) 
            VALUES (?, 'Live Stream Started', ?)
        `, [streamId, `New live stream from ${camera_name || 'Mobile User'}`]);
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('stream-started', {
                streamId: streamId.toString(),
                cameraName: camera_name || 'Mobile Stream',
                location: location_name || 'Current Location',
                viewerCount: 1,
                startTime: new Date().toISOString()
            });
        }
        
        console.log(`Live stream started: Camera ID ${streamId}`);
        res.json({ success: true, id: streamId, stream_id: streamId });
        
    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload stream video
router.post('/upload-stream', upload.single('video'), async (req, res) => {
    try {
        const videoFile = req.file;
        if (!videoFile) {
            return res.status(400).json({ error: 'No video file provided' });
        }
        
        const streamUrl = `/uploads/streams/${videoFile.filename}`;
        console.log(`Video uploaded: ${streamUrl}`);
        
        res.json({ success: true, stream_url: streamUrl });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// End live stream
router.post('/cameras/:id/end-stream', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get camera info before updating
        const [cameras] = await db.execute('SELECT camera_name FROM camera_streams WHERE id = ?', [id]);
        const cameraName = cameras[0]?.camera_name || `Camera ${id}`;
        
        await db.execute(`
            UPDATE camera_streams 
            SET is_live = FALSE, 
                viewers = 0, 
                updated_at = NOW() 
            WHERE id = ?
        `, [id]);
        
        // Create alert that stream ended
        await db.execute(`
            INSERT INTO camera_alerts (camera_id, incident_type, alert_message) 
            VALUES (?, 'Live Stream Ended', 'Live broadcast has ended')
        `, [id]);
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('stream-ended', {
                streamId: id.toString(),
                cameraName: cameraName,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending stream:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all live streams
router.get('/live-streams', async (req, res) => {
    try {
        const [streams] = await db.execute(`
            SELECT c.*, COUNT(DISTINCT v.id) as recording_count
            FROM camera_streams c
            LEFT JOIN video_recordings v ON c.id = v.camera_id
            WHERE c.is_live = TRUE AND c.status = 'active'
            GROUP BY c.id
            ORDER BY c.last_active DESC
        `);
        res.json(streams);
    } catch (error) {
        console.error('Error fetching live streams:', error);
        res.json([]);
    }
});

// Update viewer count (for real-time)
router.post('/cameras/:id/viewer', async (req, res) => {
    try {
        const { id } = req.params;
        const { increment } = req.body; // true = add viewer, false = remove viewer
        
        if (increment) {
            await db.execute('UPDATE camera_streams SET viewers = viewers + 1 WHERE id = ?', [id]);
        } else {
            await db.execute('UPDATE camera_streams SET viewers = GREATEST(viewers - 1, 0) WHERE id = ?', [id]);
        }
        
        // Get updated viewer count
        const [result] = await db.execute('SELECT viewers, camera_name FROM camera_streams WHERE id = ?', [id]);
        const viewerCount = result[0]?.viewers || 0;
        const cameraName = result[0]?.camera_name;
        
        // Send update via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('stream-updated', {
                streamId: id.toString(),
                viewerCount: viewerCount,
                cameraName: cameraName
            });
        }
        
        res.json({ success: true, viewerCount });
    } catch (error) {
        console.error('Error updating viewer count:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== RECORDINGS ====================

// Start recording
router.post('/cameras/:id/record', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.execute(
            'UPDATE camera_streams SET is_recording = TRUE, updated_at = NOW() WHERE id = ?', 
            [id]
        );
        
        // Create recording entry
        const [result] = await db.execute(`
            INSERT INTO video_recordings (camera_id, start_time, video_url) 
            VALUES (?, NOW(), ?)
        `, [id, `recording_${id}_${Date.now()}.mp4`]);
        
        // Get camera info
        const [cameras] = await db.execute('SELECT camera_name FROM camera_streams WHERE id = ?', [id]);
        const cameraName = cameras[0]?.camera_name || `Camera ${id}`;
        
        // Create alert
        await db.execute(`
            INSERT INTO camera_alerts (camera_id, incident_type, alert_message) 
            VALUES (?, 'Recording Started', ?)
        `, [id, `Camera ${cameraName} recording has started`]);
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('recording-started', {
                cameraId: id,
                cameraName: cameraName,
                recordingId: result.insertId,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true, recording_id: result.insertId });
    } catch (error) {
        console.error('Error starting recording:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stop recording
router.post('/cameras/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.execute(
            'UPDATE camera_streams SET is_recording = FALSE, updated_at = NOW() WHERE id = ?', 
            [id]
        );
        
        // Update the latest recording
        const [result] = await db.execute(`
            UPDATE video_recordings 
            SET end_time = NOW(), 
                duration = TIMESTAMPDIFF(SECOND, start_time, NOW())
            WHERE camera_id = ? AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1
        `, [id]);
        
        // Get camera info
        const [cameras] = await db.execute('SELECT camera_name FROM camera_streams WHERE id = ?', [id]);
        const cameraName = cameras[0]?.camera_name || `Camera ${id}`;
        
        // Create alert
        await db.execute(`
            INSERT INTO camera_alerts (camera_id, incident_type, alert_message) 
            VALUES (?, 'Recording Stopped', ?)
        `, [id, `Camera ${cameraName} recording has stopped`]);
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('recording-stopped', {
                cameraId: id,
                cameraName: cameraName,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error stopping recording:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recordings for camera
router.get('/cameras/:id/recordings', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if table exists
        const [tables] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'video_recordings'
        `);
        
        if (tables[0].count === 0) {
            // Create table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS video_recordings (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    camera_id INT NOT NULL,
                    incident_id INT NULL,
                    video_url VARCHAR(500) NOT NULL,
                    thumbnail_url VARCHAR(500) NULL,
                    start_time TIMESTAMP NOT NULL,
                    end_time TIMESTAMP NULL,
                    duration INT DEFAULT 0,
                    file_size INT NULL,
                    ai_analyzed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (camera_id) REFERENCES camera_streams(id) ON DELETE CASCADE,
                    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL,
                    INDEX idx_camera_time (camera_id, start_time)
                )
            `);
            return res.json([]);
        }
        
        const [recordings] = await db.execute(`
            SELECT * FROM video_recordings 
            WHERE camera_id = ? 
            ORDER BY start_time DESC 
            LIMIT 100
        `, [id]);
        
        res.json(recordings);
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.json([]);
    }
});

// ==================== ALERTS ====================

// Get camera alerts
router.get('/alerts', async (req, res) => {
    try {
        // Check if table exists
        const [tables] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'camera_alerts'
        `);
        
        if (tables[0].count === 0) {
            // Create table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS camera_alerts (
                    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    camera_id INT NOT NULL,
                    incident_type VARCHAR(100),
                    confidence DECIMAL(5,2),
                    screenshot_url VARCHAR(500),
                    alert_message TEXT,
                    is_viewed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (camera_id) REFERENCES camera_streams(id) ON DELETE CASCADE,
                    INDEX idx_viewed (is_viewed),
                    INDEX idx_created (created_at)
                )
            `);
            return res.json([]);
        }
        
        const [alerts] = await db.execute(`
            SELECT a.*, c.camera_name, c.location_name as camera_location
            FROM camera_alerts a
            JOIN camera_streams c ON a.camera_id = c.id
            ORDER BY a.created_at DESC
            LIMIT 50
        `);
        
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.json([]);
    }
});

// Create alert (for AI detection)
router.post('/alerts', async (req, res) => {
    try {
        const { camera_id, incident_type, confidence, alert_message, screenshot_url } = req.body;
        
        const sql = `INSERT INTO camera_alerts 
                     (camera_id, incident_type, confidence, alert_message, screenshot_url) 
                     VALUES (?, ?, ?, ?, ?)`;
        
        const [result] = await db.execute(sql, [
            camera_id, incident_type, confidence, alert_message, screenshot_url
        ]);
        
        // Also update the camera's last_active timestamp
        await db.execute('UPDATE camera_streams SET last_active = NOW() WHERE id = ?', [camera_id]);
        
        // Get camera info
        const [cameras] = await db.execute('SELECT camera_name FROM camera_streams WHERE id = ?', [camera_id]);
        const cameraName = cameras[0]?.camera_name || `Camera ${camera_id}`;
        
        // Send notification via Socket.IO
        const io = getIO(req);
        if (io) {
            io.emit('new-alert', {
                id: result.insertId,
                cameraId: camera_id,
                cameraName: cameraName,
                incidentType: incident_type,
                confidence: confidence,
                alertMessage: alert_message,
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark alert as viewed
router.put('/alerts/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE camera_alerts SET is_viewed = TRUE WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark multiple alerts as viewed
router.put('/alerts/view-all', async (req, res) => {
    try {
        await db.execute('UPDATE camera_alerts SET is_viewed = TRUE WHERE is_viewed = FALSE');
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATISTICS ====================

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM camera_streams');
        const [active] = await db.execute('SELECT COUNT(*) as count FROM camera_streams WHERE status = "active" OR is_live = TRUE');
        const [offline] = await db.execute('SELECT COUNT(*) as count FROM camera_streams WHERE status = "inactive"');
        const [maintenance] = await db.execute('SELECT COUNT(*) as count FROM camera_streams WHERE status = "maintenance"');
        const [live] = await db.execute('SELECT COUNT(*) as count FROM camera_streams WHERE is_live = TRUE');
        const [alerts] = await db.execute('SELECT COUNT(*) as count FROM camera_alerts WHERE is_viewed = FALSE');
        const [recordings] = await db.execute('SELECT COUNT(*) as count FROM video_recordings WHERE DATE(created_at) = CURDATE()');
        
        res.json({
            total: total[0].count,
            active: active[0].count,
            offline: offline[0].count,
            maintenance: maintenance[0].count,
            live: live[0].count,
            unreadAlerts: alerts[0].count,
            todayRecordings: recordings[0].count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEST ENDPOINT ====================

// End live stream (alternate endpoint)
router.post('/end-stream', async (req, res) => {
    try {
        const { streamId } = req.body;
        
        // Update camera status
        await db.execute(`
            UPDATE camera_streams 
            SET is_live = FALSE, 
                updated_at = NOW() 
            WHERE camera_name LIKE ? OR id = ?
        `, [`%${streamId}%`, streamId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error ending stream:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check for CCTV module
router.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        module: 'CCTV Routes'
    });
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'CCTV routes are working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /cameras',
            'GET /cameras/:id',
            'POST /cameras',
            'PUT /cameras/:id',
            'PUT /cameras/:id/status',
            'POST /start-stream',
            'POST /upload-stream',
            'POST /cameras/:id/end-stream',
            'GET /live-streams',
            'POST /cameras/:id/viewer',
            'POST /cameras/:id/record',
            'POST /cameras/:id/stop',
            'GET /cameras/:id/recordings',
            'GET /alerts',
            'POST /alerts',
            'PUT /alerts/:id/view',
            'PUT /alerts/view-all',
            'GET /stats',
            'GET /health',
            'POST /end-stream'
        ]
    });
});

module.exports = router;