const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const db = require('../config/db');
const twilio = require('twilio');
const path = require('path');

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Mapping functions for database compatibility
const mapSeverity = (severity) => {
    const mapping = {
        'Critical': 'Critical',
        'High': 'High',
        'Medium': 'Medium',
        'Low': 'Low'
    };
    const key = severity?.charAt(0).toUpperCase() + severity?.slice(1).toLowerCase();
    return mapping[key] || 'Low';
};

const mapPriority = (priority) => {
    const mapping = {
        'Critical': 'Critical',
        'High': 'High',
        'Medium': 'Medium',
        'Normal': 'Normal'
    };
    const key = priority?.charAt(0).toUpperCase() + priority?.slice(1).toLowerCase();
    return mapping[key] || 'Normal';
};

// Helper function to get video duration (simplified)
const getVideoDuration = async (videoPath) => {
    try {
        // For now, return a placeholder duration
        // In production, you'd use ffprobe or a library
        return 5; // Default 5 seconds
    } catch (error) {
        console.error('Error getting video duration:', error);
        return 0;
    }
};

// Helper function to extract frames from video (simplified)
const extractFrames = async (videoPath, intervalSeconds = 2) => {
    // For now, return placeholder frames
    // In production, you'd use ffmpeg
    return [
        { timestamp: 0, path: videoPath, description: "Start of video" },
        { timestamp: 2, path: videoPath, description: "Mid video analysis" },
        { timestamp: 4, path: videoPath, description: "End of video" }
    ];
};

// Handle video upload and analysis
const handleVideoUpload = async (videoPath, incidentId) => {
    try {
        const videoDuration = await getVideoDuration(videoPath);
        
        // Save to video_recordings table
        const sql = `INSERT INTO video_recordings 
                     (incident_id, video_url, duration, file_size, resolution, ai_analyzed) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        
        const stats = fs.statSync(videoPath);
        await db.execute(sql, [
            incidentId,
            path.basename(videoPath),
            videoDuration,
            stats.size,
            '1920x1080',
            true
        ]);
        
        console.log(`✅ Video recording saved with duration: ${videoDuration}s`);
        return { success: true, duration: videoDuration };
    } catch (error) {
        console.error('Video upload error:', error);
        return { success: false, error: error.message };
    }
};

// Analyze video frames
const analyzeVideoFrames = async (videoPath, incidentId) => {
    try {
        const frames = await extractFrames(videoPath, 2);
        const detections = [];
        
        for (const frame of frames) {
            const formData = new FormData();
            formData.append('image', fs.createReadStream(frame.path));
            
            try {
                const aiResponse = await axios.post('http://127.0.0.1:8000/analyze', formData, {
                    headers: formData.getHeaders(),
                    timeout: 30000
                });
                
                detections.push({
                    timestamp: frame.timestamp,
                    ...aiResponse.data
                });
            } catch (aiError) {
                console.error(`Frame analysis error at ${frame.timestamp}s:`, aiError.message);
            }
        }
        
        // Save video analysis to ai_logs
        if (detections.length > 0) {
            const sql = `INSERT INTO ai_logs 
                         (incident_id, source, media_type, ai_type, confidence, severity, priority, 
                          video_duration, key_frames, raw_response) 
                         VALUES (?, 'mobile', 'video', ?, ?, ?, ?, ?, ?, ?)`;
            
            await db.execute(sql, [
                incidentId,
                'Video Analysis',
                detections[0]?.confidence || 0,
                mapSeverity(detections[0]?.severity || 'Low'),
                mapPriority(detections[0]?.priority || 'Normal'),
                frames.length * 2,
                JSON.stringify(detections),
                JSON.stringify({ frames: detections })
            ]);
        }
        
        return detections;
    } catch (error) {
        console.error('Video analysis error:', error);
        return [];
    }
};

// Main report incident function (UNIFIED)
exports.reportIncident = async (req, res) => {
    try {
        const { latitude, longitude, description, mediaType } = req.body;
        const io = req.app.get('socketio');
        const userId = req.user ? req.user.id : null;

        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "No media file provided" 
            });
        }

        const filePath = req.file.path;
        const fileName = req.file.filename;
        
        // Determine if it's video based on mediaType or mime type
        const isVideo = mediaType === 'video' || (req.file.mimetype && req.file.mimetype.startsWith('video/'));
        
        console.log(`📸 Processing ${isVideo ? 'video' : 'image'}: ${fileName}`);

        let aiResult = null;
        let detections = [];

        // Process based on media type
        if (isVideo) {
            console.log('🎥 Processing video...');
            // Analyze video frames
            detections = await analyzeVideoFrames(filePath, 0);
            aiResult = detections.length > 0 ? detections[0] : {
                type: 'Video Evidence',
                confidence: 0.7,
                severity: 'Medium',
                priority: 'Medium'
            };
        } else {
            // Process image with AI
            console.log('📷 Processing image...');
            const formData = new FormData();
            formData.append('image', fs.createReadStream(filePath));
            
            const aiResponse = await axios.post('http://127.0.0.1:8000/analyze', formData, {
                headers: formData.getHeaders(),
                timeout: 30000
            });
            
            aiResult = aiResponse.data;
            detections = aiResult.detections || [];
        }

        // Map values for database compatibility
        const mappedSeverity = mapSeverity(aiResult?.severity);
        const mappedPriority = mapPriority(aiResult?.priority);
        
        console.log(`📊 Mapped values - Severity: ${mappedSeverity}, Priority: ${mappedPriority}`);

        // Save to incidents table
        const sql = `INSERT INTO incidents 
                     (user_id, type, confidence, severity, priority, media_type, 
                      media_name, latitude, longitude, description, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;
        
        const [result] = await db.execute(sql, [
            userId,
            aiResult?.type || (isVideo ? 'Video Evidence' : 'Unknown Incident'),
            aiResult?.confidence || 0,
            mappedSeverity,
            mappedPriority,
            isVideo ? 'video' : 'image',
            fileName,
            latitude,
            longitude,
            description
        ]);

        const incidentId = result.insertId;
        console.log(`✅ Incident saved with ID: ${incidentId}, User ID: ${userId}`);

        // Handle video-specific operations
        let videoDuration = 0;
        if (isVideo) {
            const videoResult = await handleVideoUpload(filePath, incidentId);
            videoDuration = videoResult.duration || 0;
            
            // Re-analyze with incident ID for proper association
            const videoAnalysis = await analyzeVideoFrames(filePath, incidentId);
            if (videoAnalysis.length > 0) {
                detections = videoAnalysis;
            }
        }

        // Save detections to ai_logs
        if (detections && detections.length > 0) {
            console.log(`📊 Saving ${detections.length} detections to ai_logs...`);
            
            for (const detection of detections) {
                const mappedLogSeverity = mapSeverity(detection.severity);
                const mappedLogPriority = mapPriority(detection.priority);
                
                const aiLogSql = `INSERT INTO ai_logs 
                                 (incident_id, source, media_type, ai_type, confidence, 
                                  severity, priority, raw_response) 
                                 VALUES (?, 'mobile', ?, ?, ?, ?, ?, ?)`;
                
                try {
                    await db.execute(aiLogSql, [
                        incidentId,
                        isVideo ? 'video' : 'image',
                        detection.type || detection.ai_type || 'Unknown',
                        detection.confidence || 0.5,
                        mappedLogSeverity,
                        mappedLogPriority,
                        JSON.stringify(detection)
                    ]);
                } catch (logError) {
                    console.error(`Error saving detection: ${detection.type}`, logError.message);
                }
            }
            console.log(`✅ Saved ${detections.length} detections to ai_logs`);
        }

        // Get complete incident with user info
        const [incident] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name, u.phone as reporter_phone
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.id = ?
        `, [incidentId]);

        const newIncident = {
            ...incident[0],
            all_detections: detections || [],
            total_detections: detections?.length || 0,
            media_type: isVideo ? 'video' : 'image',
            video_duration: videoDuration
        };

        // Real-time update via Socket.io
        io.emit('new_incident', newIncident);
        console.log(`📡 Real-time update sent for incident #${incidentId}`);

        // Send SMS Alerts for High/Critical priority
        if (mappedPriority === 'Critical' || mappedPriority === 'High') {
            const message = `🚨 SAFECITY+ ALERT: ${aiResult?.type} incident reported (${mappedPriority} priority). 
Location: ${latitude}, ${longitude}. 
${isVideo ? `Video duration: ${videoDuration}s` : 'Image captured'} 
Check dashboard immediately!`;
            
            const [responders] = await db.execute(
                "SELECT phone FROM users WHERE role IN ('Responder', 'Admin')"
            );
            
            if (responders.length > 0 && process.env.TWILIO_NUMBER) {
                console.log(`📱 Sending SMS alerts to ${responders.length} responders...`);
                for (const responder of responders) {
                    if (responder.phone) {
                        try {
                            await twilioClient.messages.create({
                                body: message,
                                to: responder.phone,
                                from: process.env.TWILIO_NUMBER
                            });
                            console.log(`✅ SMS sent to ${responder.phone}`);
                        } catch (smsError) {
                            console.error(`❌ SMS failed to ${responder.phone}:`, smsError.message);
                        }
                    }
                }
            }
        }

        // Return success response
        res.status(201).json({ 
            success: true, 
            incident: newIncident,
            ai_analysis: {
                primary_incident: {
                    type: aiResult?.type,
                    confidence: aiResult?.confidence,
                    severity: mappedSeverity,
                    priority: mappedPriority
                },
                all_detections: detections,
                total_detections: detections?.length || 0
            }
        });
        
    } catch (error) {
        console.error("❌ Report Incident Error:", error);
        
        // Clean up uploaded file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.log(`🗑️ Deleted failed upload: ${req.file.path}`);
            } catch (unlinkError) {
                console.error('Error deleting file:', unlinkError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
};

// Get all incidents (for admin/responder dashboard)
exports.getAllIncidents = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name, u.phone as reporter_phone,
                   vr.duration as video_duration, vr.video_url
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN video_recordings vr ON i.id = vr.incident_id
            ORDER BY i.created_at DESC
        `);
        
        // Get detections for each incident
        for (let incident of rows) {
            const [detections] = await db.execute(`
                SELECT ai_type, confidence, severity, priority, created_at
                FROM ai_logs
                WHERE incident_id = ?
                ORDER BY confidence DESC
            `, [incident.id]);
            
            incident.all_detections = detections;
            incident.total_detections = detections.length;
        }
        
        console.log(`📋 Retrieved ${rows.length} incidents`);
        res.json(rows);
    } catch (error) {
        console.error("❌ Get Incidents Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get incident by ID
exports.getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [incidents] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name, u.phone as reporter_phone,
                   vr.duration as video_duration, vr.video_url, vr.thumbnail_url
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN video_recordings vr ON i.id = vr.incident_id
            WHERE i.id = ?
        `, [id]);
        
        if (incidents.length === 0) {
            return res.status(404).json({ success: false, message: "Incident not found" });
        }
        
        const [detections] = await db.execute(`
            SELECT id, ai_type, confidence, severity, priority, raw_response, created_at
            FROM ai_logs
            WHERE incident_id = ?
            ORDER BY confidence DESC
        `, [id]);
        
        const incident = incidents[0];
        incident.all_detections = detections;
        incident.total_detections = detections.length;
        
        res.json(incident);
    } catch (error) {
        console.error("❌ Get Incident By ID Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get incidents by user ID
exports.getIncidentsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`📋 Fetching incidents for user ID: ${userId}`);
        
        const [rows] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name, u.phone as reporter_phone,
                   vr.duration as video_duration, vr.video_url
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN video_recordings vr ON i.id = vr.incident_id
            WHERE i.user_id = ?
            ORDER BY i.created_at DESC
        `, [userId]);
        
        console.log(`📋 Found ${rows.length} incidents for user ${userId}`);
        
        for (let incident of rows) {
            const [detections] = await db.execute(`
                SELECT ai_type, confidence, severity, priority, created_at
                FROM ai_logs
                WHERE incident_id = ?
                ORDER BY confidence DESC
            `, [incident.id]);
            
            incident.all_detections = detections;
            incident.total_detections = detections.length;
        }
        
        res.json(rows);
    } catch (error) {
        console.error("❌ Get Incidents By User Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get user's own incidents (from auth token)
exports.getMyIncidents = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        
        console.log(`📋 Fetching my incidents for user ID: ${userId}`);
        
        const [rows] = await db.execute(`
            SELECT i.*, u.full_name as reporter_name, u.phone as reporter_phone
            FROM incidents i
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.user_id = ?
            ORDER BY i.created_at DESC
        `, [userId]);
        
        console.log(`📋 Found ${rows.length} incidents`);
        res.json(rows);
    } catch (error) {
        console.error("❌ Get My Incidents Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Update incident status
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_responder_id } = req.body;
        
        if (req.user && req.user.role === 'User') {
            return res.status(403).json({ 
                success: false, 
                message: "Unauthorized to update incidents" 
            });
        }
        
        const sql = `UPDATE incidents 
                     SET status = ?, 
                         assigned_responder_id = ?,
                         updated_at = NOW()
                     WHERE id = ?`;
        
        await db.execute(sql, [status, assigned_responder_id, id]);
        
        const [incident] = await db.execute(
            'SELECT user_id, type FROM incidents WHERE id = ?',
            [id]
        );
        
        if (incident[0]?.user_id) {
            const [user] = await db.execute(
                'SELECT phone FROM users WHERE id = ?',
                [incident[0].user_id]
            );
            
            if (user[0]?.phone) {
                try {
                    await twilioClient.messages.create({
                        body: `🚨 SafeCity+ Update: Your ${incident[0].type} incident #${id} status changed to "${status}". Thank you for reporting!`,
                        to: user[0].phone,
                        from: process.env.TWILIO_NUMBER
                    });
                    console.log(`✅ Status update SMS sent to ${user[0].phone}`);
                } catch (smsError) {
                    console.error("SMS Error:", smsError.message);
                }
            }
        }
        
        const io = req.app.get('socketio');
        io.emit('incident_updated', { id, status });
        
        res.json({ success: true, message: "Status updated" });
        
    } catch (error) {
        console.error("❌ Update Incident Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get incident statistics
exports.getIncidentStats = async (req, res) => {
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM incidents');
        const [byPriority] = await db.execute(`
            SELECT priority, COUNT(*) as count 
            FROM incidents 
            GROUP BY priority
        `);
        const [byStatus] = await db.execute(`
            SELECT status, COUNT(*) as count 
            FROM incidents 
            GROUP BY status
        `);
        
        res.json({
            total: total[0].count,
            byPriority,
            byStatus
        });
    } catch (error) {
        console.error("❌ Get Stats Error:", error);
        res.status(500).json({ error: error.message });
    }
};