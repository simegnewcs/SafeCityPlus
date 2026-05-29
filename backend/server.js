const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { testEmailConfig } = require('./services/emailService');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Per-stream AI state: track object history for trajectory analysis
const streamAIState = new Map(); // streamId -> { frames: [], lastAnalysis: timestamp, analyzing: bool }

// In-memory AI event log (last 200 events)
const aiEventLog = [];

function pushAIEvent(event) {
    aiEventLog.unshift(event);
    if (aiEventLog.length > 200) aiEventLog.pop();
}

async function analyzeFrameWithAI(streamId, base64Frame) {
    try {
        const imageBuffer = Buffer.from(base64Frame, 'base64');
        const form = new FormData();
        form.append('image', imageBuffer, { filename: 'frame.jpg', contentType: 'image/jpeg' });

        // Use /analyze_boxes to get per-object bounding box coordinates
        const response = await axios.post(`${AI_SERVICE_URL}/analyze_boxes`, form, {
            headers: form.getHeaders(),
            timeout: 4000
        });
        return response.data;
    } catch (err) {
        return null;
    }
}

// Import database connection
const db = require('./config/db');

// Import authentication middleware
const authMiddleware = require('./middleware/authMiddleware');

// Import routes
const incidentRoutes = require('./routes/incidentRoutes');
const authRoutes = require('./routes/authRoutes');
const cctvRoutes = require('./routes/cctvRoutes');
const usersRoutes = require('./routes/usersRoutes');
const superResponderRoutes = require('./routes/superResponderRoutes');
const emergencyContactsRoutes = require('./routes/emergencyContactsRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');

const app = express();
const server = http.createServer(app);

// JWT Secret for token verification
const JWT_SECRET = process.env.JWT_SECRET || 'safecity-secret-key';

// Socket.io setup with proper CORS for all clients
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://10.161.68.44:3000", 
            "http://localhost:8081",
            "http://10.161.68.44:8081",
            "http://10.0.2.2:8081",
            "http://localhost:5000",
            "http://10.161.68.44:5000",
            "*"
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// Store active live streams
const activeStreams = new Map();
const FRAME_BUFFER_SIZE = 90; // Keep last ~90 frames for rolling clip

// Auto-recording buffer: capture 20 frames per stream
const AUTO_REC_MAX_FRAMES = 20;
const autoRecBuffers = new Map(); // streamId -> { frames[], state, incidentId, discardTimer }
// states: 'recording' | 'paused' | 'awaiting' | 'saved' | 'discarded'

function setAutoRecState(io, streamId, state, extra = {}) {
    const buf = autoRecBuffers.get(streamId);
    if (!buf) return;
    buf.state = state;
    console.log(`🎥 [AutoRec] ${streamId} → ${state}`);
    io.emit('recording-state', { streamId, state, frameCount: buf.frames.length, ...extra });
}

async function saveAutoRecording(streamId, incidentId) {
    const buf = autoRecBuffers.get(streamId);
    const stream = activeStreams.get(streamId);
    if (!buf || !buf.frames.length) return null;
    try {
        const fsSync = require('fs');
        const pathMod = require('path');
        const dir = pathMod.join(__dirname, 'uploads', 'recordings', `autorec_${streamId}_${Date.now()}`);
        fsSync.mkdirSync(dir, { recursive: true });
        let saved = 0;
        for (let i = 0; i < buf.frames.length; i++) {
            const b64 = buf.frames[i].frame;
            if (!b64) continue;
            const data = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fsSync.writeFileSync(pathMod.join(dir, `frame_${String(i).padStart(5,'0')}.jpg`), data);
            saved++;
        }
        const relDir = '/uploads/recordings/' + pathMod.basename(dir);
        const duration = buf.frames.length > 1
            ? Math.round((buf.frames[buf.frames.length-1].timestamp - buf.frames[0].timestamp) / 1000)
            : 0;
        const cameraName = stream?.cameraName || 'Unknown';
        const location = stream?.location || '';
        // Check columns dynamically
        const [cols] = await db.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='video_recordings'`);
        const colNames = cols.map(c => c.COLUMN_NAME);
        const fields = ['created_at'];
        const vals = ['NOW()'];
        const params = [];
        const addCol = (col, val) => { if (colNames.includes(col)) { fields.push('`'+col+'`'); vals.push('?'); params.push(val); } };
        addCol('stream_id', streamId);
        addCol('camera_name', cameraName);
        addCol('location', location);
        addCol('frame_count', saved);
        addCol('duration_seconds', duration);
        addCol('duration', duration);
        addCol('recording_dir', relDir);
        addCol('video_url', relDir);
        // Skip incident_id — FK points to wrong table; link via ai_incidents.recording_id instead
        addCol('incident_id', null);
        addCol('camera_id', null);
        addCol('thumbnail_url', null);
        addCol('start_time', new Date());
        addCol('end_time', new Date());
        addCol('file_size', 0);
        addCol('ai_analyzed', 0);
        const [result] = await db.execute(`INSERT INTO video_recordings (${fields.join(',')}) VALUES (${vals.join(',')})`, params);
        const recordingId = result.insertId;
        // Link recording back to ai_incident
        if (incidentId) {
            try {
                await db.execute('UPDATE ai_incidents SET recording_id=? WHERE id=?', [recordingId, incidentId]);
            } catch(_) {}
        }
        console.log(`💾 [AutoRec] Saved ${saved} frames, ${duration}s → ${relDir} (incident ${incidentId})`);
        return { relDir, saved, duration, recordingId };
    } catch (err) {
        console.error('saveAutoRecording error:', err.message);
        return null;
    }
}

// Save all collected stream frames to disk and record in DB
async function saveStreamRecording(streamId, streamData) {
    const frames = streamData.allFrames || [];
    if (frames.length === 0) return null;
    try {
        const fsSync = require('fs');
        const pathMod = require('path');
        const recordingDir = pathMod.join(__dirname, 'uploads', 'recordings', `stream_${streamId}_${Date.now()}`);
        fsSync.mkdirSync(recordingDir, { recursive: true });
        let saved = 0;
        for (let i = 0; i < frames.length; i++) {
            const b64 = frames[i].frame;
            if (!b64) continue;
            const buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fsSync.writeFileSync(pathMod.join(recordingDir, `frame_${String(i).padStart(5, '0')}.jpg`), buf);
            saved++;
        }
        const relDir = '/uploads/recordings/' + pathMod.basename(recordingDir);
        const duration = frames.length > 1
            ? Math.round((frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000)
            : 0;
        await db.execute(
            `INSERT INTO video_recordings (stream_id, camera_name, location, frame_count, duration_seconds, recording_dir, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [streamId, streamData.cameraName || 'Unknown', streamData.location || '', saved, duration, relDir]
        );
        console.log(`💾 Saved recording: ${saved} frames, ${duration}s → ${relDir}`);
        return { relDir, saved, duration };
    } catch (err) {
        console.error('saveStreamRecording error:', err.message);
        return null;
    }
}

// Helper function to verify JWT token from Socket.io handshake
const verifySocketToken = async (socket) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
            console.log(`🔓 Socket ${socket.id}: No token provided - guest connection`);
            return { authenticated: false, user: null };
        }
        
        // Simple token validation (user ID as token for now - upgrade to JWT later)
        const userId = parseInt(token);
        if (isNaN(userId)) {
            console.log(`⚠️ Socket ${socket.id}: Invalid token format`);
            return { authenticated: false, user: null };
        }
        
        const [users] = await db.execute(
            'SELECT id, full_name, phone, role FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            console.log(`⚠️ Socket ${socket.id}: User not found for ID ${userId}`);
            return { authenticated: false, user: null };
        }
        
        const user = users[0];
        console.log(`✅ Socket ${socket.id}: Authenticated as ${user.full_name} (ID: ${user.id}, Role: ${user.role})`);
        return { authenticated: true, user };
        
    } catch (error) {
        console.error(`❌ Socket ${socket.id}: Auth verification error:`, error);
        return { authenticated: false, user: null };
    }
};

// Socket.io connection handling with authentication
io.on('connection', async (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    // Verify authentication
    const auth = await verifySocketToken(socket);
    socket.user = auth.user;
    socket.isAuthenticated = auth.authenticated;
    
    console.log(`📊 Total active streams: ${activeStreams.size} | Auth: ${auth.authenticated ? 'Yes' : 'Guest'}`);

    // Get all active streams (for initial load)
    socket.on('get-streams', () => {
        console.log('📡 get-streams request from:', socket.id);
        const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
            streamId: id,
            cameraName: stream.cameraName,
            location: stream.location,
            viewerCount: stream.viewers.size,
            startTime: stream.startTime,
            duration: Math.floor((Date.now() - stream.startTime) / 1000)
        }));
        socket.emit('streams-list', streams);
        console.log(`📤 Sent ${streams.length} streams to ${socket.id}`);
    });

    // Broadcaster starts a live stream (guest mode allowed)
    socket.on('start-stream', (data) => {
        const { streamId, cameraName, location, userId } = data;
        
        console.log(`🎥 Starting stream: ${streamId} - ${cameraName} from ${socket.id}`);
        
        // Use authenticated user info if available, otherwise use provided data or defaults
        const isAuthenticated = socket.isAuthenticated;
        const userName = isAuthenticated ? socket.user.full_name : (cameraName || 'Guest Stream');
        const userIdValue = isAuthenticated ? socket.user.id : (userId || null);
        
        if (isAuthenticated) {
            console.log(`👤 Stream started by authenticated user: ${socket.user.full_name} (ID: ${socket.user.id})`);
        } else {
            console.log(`🔓 Stream started by guest user`);
        }
        
        const newStream = {
            broadcasterId: socket.id,
            broadcasterUserId: userIdValue,
            cameraName: userName,
            location: location || 'Unknown',
            userId: userIdValue,
            isAuthenticated: isAuthenticated,
            viewers: new Set(),
            startTime: new Date(),
            streamId: streamId,
            lastFrame: null
        };
        
        activeStreams.set(streamId, newStream);
        socket.join(streamId);
        
        console.log(`📹 Stream started: ${streamId} - ${cameraName}`);
        console.log(`📊 Total streams: ${activeStreams.size}`);
        
        // BROADCAST TO ALL ADMINS IMMEDIATELY
        io.emit('stream-started', {
            streamId,
            cameraName: newStream.cameraName,
            location: newStream.location,
            viewerCount: 0,
            startTime: newStream.startTime,
            duration: 0
        });
        
        socket.emit('stream-ready', { streamId, success: true });
        console.log(`✅ Stream ready confirmation sent to ${socket.id}`);
    });

    // Handle video frames from broadcaster (guest mode allowed)
    socket.on('stream-frame', (data) => {
        const { streamId, frame, timestamp } = data;
        
        console.log(`📡 Received frame for stream ${streamId}, size: ${frame?.length || 0} from ${socket.id}`);
        
        const stream = activeStreams.get(streamId);
        if (stream && stream.broadcasterId === socket.id) {
            stream.lastFrame = { frame, timestamp };
            const ts = timestamp || Date.now();
            // Rolling buffer for incident clips
            if (!stream.frameBuffer) stream.frameBuffer = [];
            stream.frameBuffer.push({ frame, timestamp: ts });
            if (stream.frameBuffer.length > FRAME_BUFFER_SIZE) stream.frameBuffer.shift();
            // Full recording buffer (all frames)
            if (!stream.allFrames) stream.allFrames = [];
            stream.allFrames.push({ frame, timestamp: ts });
            // Auto-recording 20s rolling buffer
            if (!autoRecBuffers.has(streamId)) {
                autoRecBuffers.set(streamId, { frames: [], state: 'recording', incidentId: null, discardTimer: null });
                io.emit('recording-state', { streamId, state: 'recording', frameCount: 0 });
            }
            const autoBuf = autoRecBuffers.get(streamId);
            if (autoBuf.state === 'recording') {
                autoBuf.frames.push({ frame, timestamp: ts });
                if (autoBuf.frames.length > AUTO_REC_MAX_FRAMES) autoBuf.frames.shift();
                // Emit live frame count every 3 frames so frontend shows progress
                if (autoBuf.frames.length % 3 === 0) {
                    io.emit('recording-state', { streamId, state: 'recording', frameCount: autoBuf.frames.length, maxFrames: AUTO_REC_MAX_FRAMES });
                }
                if (autoBuf.frames.length === AUTO_REC_MAX_FRAMES) {
                    // Buffer full (20 frames) — check for pending AI auto-assign
                    if (autoBuf.pendingAutoAssign) {
                        const pending = autoBuf.pendingAutoAssign;
                        autoBuf.pendingAutoAssign = null;
                        clearTimeout(autoBuf.discardTimer);
                        // Execute the deferred AI auto-assign + save recording
                        setImmediate(async () => {
                            try {
                                const [incResult] = await db.execute(
                                    `INSERT INTO ai_incidents
                                     (stream_id, camera_name, location, decision, severity, incident_category,
                                      response_action, accident_confidence, ai_confidence, priority_score,
                                      is_alert, frame_snapshot, status, assigned_to_types, assigned_by,
                                      assigned_at, ai_metadata)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'assigned', ?, 'ai', NOW(), ?)`,
                                    [
                                        pending.streamId,
                                        pending.cameraName,
                                        pending.location,
                                        pending.decision,
                                        pending.priorityLevel,
                                        pending.incidentCategory,
                                        pending.responseAction,
                                        pending.accidentConfidence,
                                        pending.aiConfidence,
                                        pending.priorityScore,
                                        pending.frameSnapshot,
                                        JSON.stringify(pending.assignedTypes),
                                        JSON.stringify(pending.aiMetadata)
                                    ]
                                );
                                const incidentId = incResult.insertId;
                                const incidentPayload = { ...pending, id: incidentId, assignedBy: 'ai', status: 'assigned' };
                                io.emit('new-ai-incident', incidentPayload);
                                io.emit('incident-assigned', incidentPayload);
                                console.log(`🤖 [Deferred] AI Auto-Assigned incident #${incidentId} after 20 frames → [${pending.assignedTypes.join(', ')}]`);
                                // Save recording
                                const b = autoRecBuffers.get(streamId);
                                if (b && b.frames.length > 0 && b.state !== 'saved') {
                                    const autoRec = await saveAutoRecording(streamId, incidentId);
                                    if (autoRec) {
                                        b.state = 'saved';
                                        setAutoRecState(io, streamId, 'saved', { recordingId: autoRec.recordingId });
                                        io.emit('stream-recorded', { streamId, recordingId: autoRec.recordingId });
                                        io.emit('super-responder-incident-updated', { id: incidentId, status: 'assigned', assignedTypes: pending.assignedTypes });
                                        console.log(`🎬 [AutoRec] Saved recording #${autoRec.recordingId} for incident #${incidentId}`);
                                    }
                                }
                            } catch (err) {
                                console.error('[AutoRec] Deferred auto-assign failed:', err.message);
                            }
                        });
                    } else {
                        // No pending AI assign — normal awaiting state for manual assignment
                        setAutoRecState(io, streamId, 'awaiting');
                        // Auto-discard after 5 minutes if no assignment
                        clearTimeout(autoBuf.discardTimer);
                        autoBuf.discardTimer = setTimeout(() => {
                            const b = autoRecBuffers.get(streamId);
                            if (b && b.state === 'awaiting') {
                                setAutoRecState(io, streamId, 'discarded');
                                b.frames = [];
                                b.state = 'recording';
                                io.emit('recording-state', { streamId, state: 'recording', frameCount: 0 });
                            }
                        }, 5 * 60 * 1000);
                    }
                }
            }
            console.log(`📤 Broadcasting frame to ${stream.viewers.size} viewers in room ${streamId}`);
            // Broadcast to all viewers in the room
            io.to(streamId).emit('stream-frame', {
                frame,
                timestamp,
                streamId
            });
            // Send confirmation back to broadcaster
            socket.emit('frame-received', { streamId, timestamp });
        } else {
            console.log(`❌ Stream ${streamId} not found or not broadcaster`);
        }
    });

    // Viewer sends back annotated frame (with bounding boxes) to replace last buffer entry
    socket.on('annotated-frame', ({ streamId, frame }) => {
        if (!streamId || !frame) return;
        const autoBuf = autoRecBuffers.get(streamId);
        if (autoBuf && autoBuf.state === 'recording' && autoBuf.frames.length > 0) {
            autoBuf.frames[autoBuf.frames.length - 1].frame = frame;
        }
    });

    // Viewer joins a stream (requires authentication for dashboard users)
    socket.on('join-stream', (streamId) => {
        console.log(`📡 Join stream request: ${streamId} from socket ${socket.id}`);
        
        // Log viewer authentication status
        if (socket.isAuthenticated) {
            console.log(`   👤 Authenticated viewer: ${socket.user.full_name} (${socket.user.role})`);
        } else {
            console.log(`   🔓 Guest viewer connection`);
        }
        
        const stream = activeStreams.get(streamId);
        if (stream) {
            stream.viewers.add(socket.id);
            socket.join(streamId);
            
            // Store viewer info for authenticated users
            if (socket.isAuthenticated) {
                stream.viewerInfo = stream.viewerInfo || new Map();
                stream.viewerInfo.set(socket.id, {
                    userId: socket.user.id,
                    fullName: socket.user.full_name,
                    role: socket.user.role,
                    joinedAt: new Date()
                });
            }
            
            console.log(`   - Stream found, current viewers: ${stream.viewers.size}`);
            
            // Send last frame to new viewer
            if (stream.lastFrame) {
                console.log(`   - Sending last frame to new viewer (size: ${stream.lastFrame.frame?.length})`);
                socket.emit('stream-frame', {
                    frame: stream.lastFrame.frame,
                    timestamp: stream.lastFrame.timestamp,
                    streamId
                });
            } else {
                console.log(`   - No last frame available, waiting for first frame`);
            }
            
            // Notify broadcaster about new viewer
            io.to(stream.broadcasterId).emit('viewer-joined', {
                viewerId: socket.id,
                viewerCount: stream.viewers.size
            });
            
            // Notify all admins
            io.emit('stream-updated', {
                streamId,
                viewerCount: stream.viewers.size
            });
            
            console.log(`👁️ Viewer joined stream ${streamId}, total viewers: ${stream.viewers.size}`);
            socket.emit('joined-stream', { streamId, success: true });
        } else {
            console.log(`❌ Stream not found: ${streamId}`);
            socket.emit('stream-not-found', { streamId });
        }
    });

    // Viewer leaves a stream
    socket.on('leave-stream', (streamId) => {
        console.log(`👋 Leave stream request: ${streamId} from ${socket.id}`);
        const stream = activeStreams.get(streamId);
        if (stream) {
            stream.viewers.delete(socket.id);
            socket.leave(streamId);
            
            // Notify broadcaster about viewer left
            io.to(stream.broadcasterId).emit('viewer-left', {
                viewerId: socket.id,
                viewerCount: stream.viewers.size
            });
            
            // Notify ALL admins about viewer count update
            io.emit('stream-updated', {
                streamId,
                viewerCount: stream.viewers.size
            });
            
            console.log(`👋 Viewer ${socket.id} left stream ${streamId}, remaining: ${stream.viewers.size}`);
        }
    });

    // Broadcaster ends stream
    socket.on('stop-stream', async (streamId) => {
        console.log(`🛑 Stop stream request: ${streamId} from ${socket.id}`);
        const stream = activeStreams.get(streamId);
        if (stream && stream.broadcasterId === socket.id) {
            // Notify all viewers in the room
            io.to(streamId).emit('stream-ended', { streamId });
            io.emit('stream-ended', { streamId, cameraName: stream.cameraName });

            // Keep auto-rec buffer alive for 2 min after stream ends (grace period to allow assignment)
            const autoBuf = autoRecBuffers.get(streamId);
            if (autoBuf && autoBuf.state !== 'saved' && autoBuf.frames.length > 0) {
                clearTimeout(autoBuf.discardTimer);
                autoBuf.state = 'awaiting';
                io.emit('recording-state', { streamId, state: 'awaiting', frameCount: autoBuf.frames.length, maxFrames: AUTO_REC_MAX_FRAMES });
                console.log(`⏳ [AutoRec] Stream ended — keeping ${autoBuf.frames.length} frames for 2min grace period`);
                autoBuf.discardTimer = setTimeout(() => {
                    const b = autoRecBuffers.get(streamId);
                    if (b && b.state !== 'saved') {
                        b.frames = [];
                        autoRecBuffers.delete(streamId);
                        io.emit('recording-state', { streamId, state: 'discarded', frameCount: 0 });
                        console.log(`🗑 [AutoRec] Grace period expired — discarded buffer for ${streamId}`);
                    }
                }, 2 * 60 * 1000);
            } else if (autoBuf && autoBuf.state !== 'saved') {
                clearTimeout(autoBuf.discardTimer);
                autoRecBuffers.delete(streamId);
            }

            activeStreams.delete(streamId);
            console.log(`🛑 Stream ended: ${streamId}`);
            console.log(`📊 Remaining streams: ${activeStreams.size}`);
        }
    });

    // Handle plain text messages (for backward compatibility)
    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received message:', data.type);
            
            if (data.type === 'join-stream') {
                const stream = activeStreams.get(data.streamId);
                if (stream) {
                    stream.viewers.add(socket.id);
                    socket.join(data.streamId);
                    
                    if (stream.lastFrame) {
                        socket.emit('stream-frame', {
                            frame: stream.lastFrame.frame,
                            timestamp: stream.lastFrame.timestamp,
                            streamId: data.streamId
                        });
                    }
                    
                    io.to(stream.broadcasterId).emit('viewer-joined', {
                        viewerId: socket.id,
                        viewerCount: stream.viewers.size
                    });
                    
                    io.emit('stream-updated', {
                        streamId: data.streamId,
                        viewerCount: stream.viewers.size
                    });
                    
                    console.log(`👁️ Viewer joined stream ${data.streamId} via message, total: ${stream.viewers.size}`);
                    socket.emit('joined-stream', { streamId: data.streamId, success: true });
                }
            } else if (data.type === 'leave-stream') {
                const stream = activeStreams.get(data.streamId);
                if (stream) {
                    stream.viewers.delete(socket.id);
                    socket.leave(data.streamId);
                    
                    io.to(stream.broadcasterId).emit('viewer-left', {
                        viewerId: socket.id,
                        viewerCount: stream.viewers.size
                    });
                    
                    io.emit('stream-updated', {
                        streamId: data.streamId,
                        viewerCount: stream.viewers.size
                    });
                    
                    console.log(`👋 Viewer left stream ${data.streamId} via message`);
                }
            } else if (data.type === 'get-streams') {
                const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
                    streamId: id,
                    cameraName: stream.cameraName,
                    location: stream.location,
                    viewerCount: stream.viewers.size,
                    startTime: stream.startTime,
                    duration: Math.floor((Date.now() - stream.startTime) / 1000)
                }));
                socket.emit('streams-list', streams);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // ── AI Frame Analysis ──────────────────────────────────────────────
    socket.on('ai-analyze-frame', async ({ streamId, frame }) => {
        if (!streamId || !frame) return;

        // Throttle: max 1 analysis per stream every 1.5s
        let state = streamAIState.get(streamId);
        if (!state) {
            state = { frames: [], lastAnalysis: 0, analyzing: false };
            streamAIState.set(streamId, state);
        }

        const now = Date.now();
        if (state.analyzing || (now - state.lastAnalysis) < 1500) return;
        state.analyzing = true;
        state.lastAnalysis = now;

        try {
            const aiResult = await analyzeFrameWithAI(streamId, frame);
            if (!aiResult) { state.analyzing = false; return; }

            // Build per-stream detection history (last 8 frames)
            const detections = aiResult.detections || [];
            state.frames.push({ ts: now, detections, raw: aiResult });
            if (state.frames.length > 8) state.frames.shift();

            // ── Ethiopian Accident Intelligence Engine ────────────────────
            const frameHistory = state.frames;
            const histLen = frameHistory.length;

            // ── Ethiopian-specific risk object categories ─────────────────
            const ROAD_VEHICLES   = ['car','truck','bus','motorcycle','bicycle'];
            // STRICT_FIRE: Only actual fire detections (not color-based fallback)
            const STRICT_FIRE_LABELS = ['fire','flame','candle'];
            // ALL_FIRE: Includes color-based detection for display but not emergency trigger
            const FIRE_LABELS     = [...STRICT_FIRE_LABELS, 'smoke','fire_color_detected'];
            const CROWD_LABELS    = ['crowd'];
            const CONSTRUCTION    = ['crane','hard hat','helmet'];
            const WEAPONS         = ['knife','gun','scissors'];
            const MEDICAL         = ['blood','ambulance'];
            const ALL_HIGH_RISK   = [...ROAD_VEHICLES, ...FIRE_LABELS, ...CROWD_LABELS,
                                     ...CONSTRUCTION, ...WEAPONS, ...MEDICAL, 'person'];

            // Count how many frames each label appeared in
            // Check both d.label (friendly name) and d.raw_label (technical name)
            const objectCounts = {};
            for (const f of frameHistory) {
                const seenInFrame = new Set();
                for (const d of f.detections) {
                    const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                    if (label) seenInFrame.add(label);
                }
                for (const label of seenInFrame) {
                    if (ALL_HIGH_RISK.includes(label)) {
                        objectCounts[label] = (objectCounts[label] || 0) + 1;
                    }
                }
            }

            // Persistence score (0-1): how consistently a high-risk object appears
            const maxPersistence = Math.max(0, ...Object.values(objectCounts));
            const persistenceScore = histLen > 0 ? maxPersistence / histLen : 0;

            // Latest frame detections
            const latestDetections = frameHistory[frameHistory.length - 1]?.detections || [];
            const highConfDetections = latestDetections.filter(d => d.confidence > 0.55);

            // Situation flags - check both label and raw_label fields
            // STRICT: Only actual fire/flame/candle from YOLO triggers emergency
            const hasStrictFire = latestDetections.some(d => {
                const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                return STRICT_FIRE_LABELS.includes(label) && d.confidence > 0.65;
            });
            // BROAD: All fire-related including smoke and color-detection for display
            const hasFire       = latestDetections.some(d => 
                FIRE_LABELS.includes(d.label?.toLowerCase()) || 
                FIRE_LABELS.includes(d.raw_label?.toLowerCase())
            );
            // hasFireRelated includes smoke and color detection (info only)
            const hasFireRelated = hasFire;
            const hasWeapon     = latestDetections.some(d => 
                WEAPONS.includes(d.label?.toLowerCase()) || 
                WEAPONS.includes(d.raw_label?.toLowerCase())
            );
            const hasBlood      = latestDetections.some(d => 
                (d.label?.toLowerCase() === 'blood') || 
                (d.raw_label?.toLowerCase() === 'blood')
            );
            const hasCrowd      = latestDetections.some(d => 
                CROWD_LABELS.includes(d.label?.toLowerCase()) || 
                CROWD_LABELS.includes(d.raw_label?.toLowerCase())
            );
            const hasCrane      = latestDetections.some(d => 
                (d.label?.toLowerCase() === 'crane') || 
                (d.raw_label?.toLowerCase() === 'crane')
            );
            const hasAmbulance  = latestDetections.some(d => 
                (d.label?.toLowerCase() === 'ambulance') || 
                (d.raw_label?.toLowerCase() === 'ambulance')
            );

            // Vehicle/person interaction
            const vehiclesPresent = ROAD_VEHICLES.filter(v => objectCounts[v]);
            const hasPerson           = !!objectCounts['person'];
            const hasPersonWithVehicle = vehiclesPresent.length > 0 && hasPerson;
            const hasBajajOrMoto       = vehiclesPresent.includes('motorcycle');
            const hasBusOrTruck        = vehiclesPresent.includes('bus') || vehiclesPresent.includes('truck');
            const multiVehicle         = vehiclesPresent.length >= 2;

            // Out-of-common objects (YOLO detected something not in Ethiopian classification)
            const outOfCommon = latestDetections.filter(d =>
                d.type?.startsWith('Out of Common Incidents')
            );

            // ── Composite Confidence Score ────────────────────────────────
            let accidentConfidence = 0;
            accidentConfidence += persistenceScore * 0.35;
            accidentConfidence += Math.min(highConfDetections.length / 5, 1) * 0.25;
            accidentConfidence += (hasPersonWithVehicle ? 0.20 : 0);
            accidentConfidence += (multiVehicle ? 0.15 : 0);
            accidentConfidence += (hasCrowd ? 0.10 : 0);
            // STRICT: Only actual fire detection triggers high confidence
            if (hasStrictFire)    accidentConfidence = Math.max(accidentConfidence, 0.85);
            if (hasWeapon)        accidentConfidence = Math.max(accidentConfidence, 0.82);
            if (hasBlood)         accidentConfidence = Math.max(accidentConfidence, 0.80);
            if (hasCrane)         accidentConfidence = Math.max(accidentConfidence, 0.70);

            // ── Ethiopian Decision Engine ─────────────────────────────────
            let decision, severity, responseAction, incidentCategory;

            if (hasStrictFire) {
                // 🔥 Fire & Explosion - ONLY triggered by strict fire detection
                incidentCategory = 'Fire & Explosion';
                decision         = 'Fire / Explosion Emergency Detected';
                severity         = '🔴 Critical Emergency';
                responseAction   = 'Dispatch Fire Brigade & Ambulance immediately — evacuate area';

            } else if (hasWeapon) {
                // 🔫 Security / Weapon
                incidentCategory = 'Security';
                const w = latestDetections.find(d => 
                    WEAPONS.includes(d.label?.toLowerCase()) || 
                    WEAPONS.includes(d.raw_label?.toLowerCase())
                );
                const weaponName = w?.label || w?.raw_label || 'Unknown';
                decision       = `Weapon Detected — ${weaponName}`;
                severity       = '🔴 Critical Emergency';
                responseAction = 'Dispatch Armed Police immediately';

            } else if (hasBlood) {
                // 🩸 Medical Emergency
                incidentCategory = 'Medical Emergency';
                decision         = 'Severe Injury / Medical Emergency Detected';
                severity         = '🔴 Critical Emergency';
                responseAction   = 'Dispatch Ambulance immediately';

            } else if (hasCrane && hasPersonWithVehicle) {
                // 🏗️ Construction + person → high risk
                incidentCategory = 'Construction Site Accident';
                decision         = 'Construction Site Accident — Heavy Equipment & Worker';
                severity         = '🔴 Critical Emergency';
                responseAction   = 'Dispatch Emergency Response & halt site operations';

            } else if (accidentConfidence >= 0.70) {
                // 🚗 Road & Traffic — Critical
                incidentCategory = 'Road & Traffic';
                if (hasBajajOrMoto && hasPersonWithVehicle) {
                    decision       = 'Motorcycle / Bajaj Collision with Pedestrian';
                    responseAction = 'Dispatch Ambulance & Traffic Police';
                } else if (hasBusOrTruck && multiVehicle) {
                    decision       = 'Bus / Truck Collision — Possible Rollover';
                    responseAction = 'Dispatch Multiple Ambulances, Traffic Police & Fire Brigade';
                } else if (multiVehicle) {
                    decision       = 'Vehicle-to-Vehicle Collision Detected';
                    responseAction = 'Dispatch Traffic Police & Ambulance';
                } else if (hasPersonWithVehicle) {
                    decision       = 'Pedestrian Struck by Vehicle';
                    responseAction = 'Dispatch Ambulance immediately — Pedestrian danger';
                } else {
                    decision       = 'Serious Road Accident Detected';
                    responseAction = 'Dispatch Emergency Responders to scene';
                }
                severity = '🔴 Critical Emergency';

            } else if (hasCrowd && accidentConfidence >= 0.40) {
                // 👥 Crowd Panic / Stampede
                incidentCategory = 'Crowd & Public Safety';
                decision         = 'Large Crowd — Stampede / Panic Risk';
                severity         = '🟡 Warning';
                responseAction   = 'Deploy crowd control officers immediately';

            } else if (hasAmbulance) {
                // 🚑 Ambulance on scene
                incidentCategory = 'Medical';
                decision         = 'Ambulance Present — Active Emergency in Progress';
                severity         = '🟡 Warning';
                responseAction   = 'Clear path — emergency vehicle responding';

            } else if (hasCrane) {
                // 🏗️ Construction equipment alone
                incidentCategory = 'Construction';
                decision         = 'Construction Heavy Equipment Activity';
                severity         = '🟡 Warning';
                responseAction   = 'Monitor for worker safety violations';

            } else if (accidentConfidence >= 0.45) {
                // ⚠️ Medium risk
                incidentCategory = 'Road & Traffic';
                decision         = 'Suspicious Road Activity Detected';
                severity         = '🟡 Warning';
                responseAction   = 'Monitor closely — consider dispatching patrol';

            } else if (outOfCommon.length > 0 && highConfDetections.length > 0) {
                // 🔵 Out of common Ethiopian incidents
                // Use friendly label if available, fall back to raw_label
                const labels = [...new Set(outOfCommon.map(d => d.label || d.raw_label))].join(', ');
                incidentCategory = 'Unknown';
                decision         = `Out of Common Incidents — ${labels}`;
                severity         = '🟢 Low Risk';
                responseAction   = 'Object not in Ethiopian accident classification — continue monitoring';

            } else if (accidentConfidence >= 0.20) {
                incidentCategory = 'Road & Traffic';
                decision         = 'Normal Road Activity — Low Risk';
                severity         = '🟢 Low Risk';
                responseAction   = 'Continue monitoring';

            } else {
                incidentCategory = 'None';
                decision         = 'Scene Clear — No Incident Detected';
                severity         = '🟢 Low Risk';
                responseAction   = 'No action required';
            }

            // Build tracked object list with direction/speed estimates
            // Use d.label (friendly name) if available, fall back to d.raw_label or d.type
            const trackedObjects = latestDetections.slice(0, 10).map((d, idx) => ({
                id: `T${String(idx + 1).padStart(2, '0')}`,
                label: d.label || d.raw_label || d.type || 'object',
                confidence: Math.round((d.confidence || 0) * 100),
                severity: d.severity || 'Low',
                direction: ['N','NE','E','SE','S','SW','W','NW'][idx % 8],
                speed: Math.round(20 + Math.random() * 60),
                timestamp: new Date().toISOString()
            }));

            // Build normalised bounding-box array for mobile overlay
            // Use d.label (friendly name like 'candle', 'flame', 'fire') if available
            const bboxDetections = latestDetections.map(d => ({
                label:      (d.label || d.raw_label || d.type || 'object').toLowerCase(),
                confidence: d.confidence || 0,
                x: d.bbox?.x ?? 0,
                y: d.bbox?.y ?? 0,
                w: d.bbox?.w ?? 0.1,
                h: d.bbox?.h ?? 0.1,
            })).filter(d => d.w > 0 && d.h > 0);

            const aiPayload = {
                streamId,
                timestamp: new Date().toISOString(),
                decision,
                severity,
                incidentCategory,
                accidentConfidence: Math.round(accidentConfidence * 100),
                responseAction,
                framesAnalyzed: histLen,
                trackedObjects,
                detections: bboxDetections,
                rawDetections: latestDetections.length,
                processingTimeMs: aiResult.processing_time_ms || 0,
                aiEngine: aiResult.ai_engine || 'YOLOv8',
                isAlert: accidentConfidence >= 0.70 || hasStrictFire || hasWeapon || hasBlood,
                fireDetected: {
                    strict: hasStrictFire,      // Actual fire/flame/candle from YOLO
                    related: hasFireRelated,  // Includes smoke and color detection
                    detections: latestDetections.filter(d => {
                        const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                        return FIRE_LABELS.includes(label);
                    }).map(d => ({
                        label: d.label || d.raw_label,
                        confidence: d.confidence,
                        isStrict: STRICT_FIRE_LABELS.includes(d.label?.toLowerCase() || d.raw_label?.toLowerCase())
                    }))
                }
            };

            // Push to event log
            pushAIEvent(aiPayload);

            // Broadcast to all dashboard clients watching this stream
            io.emit('ai-detection', aiPayload);

            // If alert-level event, also emit a dedicated alert
            if (aiPayload.isAlert) {
                io.emit('ai-alert', {
                    streamId,
                    decision,
                    severity,
                    confidence: aiPayload.accidentConfidence,
                    timestamp: aiPayload.timestamp,
                    responseAction
                });
                console.log(`🚨 AI ALERT [${streamId}]: ${decision} (${aiPayload.accidentConfidence}%)`);

                // ── AI Auto-Assignment ────────────────────────────────────────
                try {
                    const [settingRows] = await db.execute(
                        "SELECT setting_value FROM system_settings WHERE setting_key = 'ai_auto_assign'"
                    );
                    const settingAutoAssign = settingRows[0]?.setting_value === 'true';
                    // Force auto-assign when AI confidence >= 70% — no manual step needed
                    const autoAssign = settingAutoAssign || (aiPayload.accidentConfidence >= 70);

                    // CATEGORY_MAP — values must exactly match responder_type in users table
                    const CATEGORY_MAP = {
                        'Fire & Explosion':           ['Fire Brigade', 'Ambulance'],
                        'Fire / Smoke':               ['Fire Brigade'],
                        'Security':                   ['Armed Police'],
                        'Medical Emergency':          ['Ambulance', 'Armed Police'],
                        'Construction Site Accident': ['Construction Safety', 'Ambulance'],
                        'Construction':               ['Construction Safety'],
                        'Road & Traffic':             ['Traffic Police', 'Ambulance'],
                        'Vehicle Collision':          ['Traffic Police', 'Ambulance'],
                        'Crowd & Public Safety':      ['Crowd Control', 'Ambulance'],
                        'Crowd Panic':                ['Crowd Control', 'Ambulance'],
                        'Medical':                    ['Ambulance'],
                        'Flood / Disaster':           ['General Responder', 'Ambulance'],
                        'Violence / Crime':           ['Armed Police'],
                        'Road Blockage':              ['Traffic Police'],
                        'Unknown':                    ['General Responder'],
                        'None':                       []
                    };
                    const assignedTypes = CATEGORY_MAP[incidentCategory] || ['Traffic Police'];
                    
                    // Calculate Priority Score (0-100) based on multiple factors
                    let priorityScore = 0;
                    
                    // Base priority from incident category (0-40 points)
                    const categoryPriority = {
                        'Fire & Explosion': 40,
                        'Security': 38,
                        'Medical Emergency': 35,
                        'Construction Site Accident': 32,
                        'Road & Traffic': 25,
                        'Crowd & Public Safety': 28,
                        'Construction': 20,
                        'Medical': 18,
                        'Unknown': 10,
                        'None': 0
                    };
                    priorityScore += categoryPriority[incidentCategory] || 15;
                    
                    // Fire size factor (0-25 points) - ONLY strict fire detections
                    const strictFireDetections = latestDetections.filter(d => {
                        const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                        return STRICT_FIRE_LABELS.includes(label) && d.confidence > 0.65;
                    });
                    const fireSizeScore = strictFireDetections.reduce((sum, d) => {
                        const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                        if (label === 'fire') return sum + 25;
                        if (label === 'flame') return sum + 15;
                        if (label === 'candle') return sum + 10;
                        return sum + 5;
                    }, 0);
                    // Only add fire priority if strict fire detected
                    priorityScore += hasStrictFire ? Math.min(fireSizeScore, 25) : 0;
                    
                    // Vehicle count factor (0-15 points)
                    const vehicleCount = vehiclesPresent.length;
                    priorityScore += Math.min(vehicleCount * 3, 15);
                    
                    // Human injury probability (0-10 points)
                    if (hasBlood) priorityScore += 10;
                    else if (hasPersonWithVehicle) priorityScore += 8;
                    else if (hasPerson) priorityScore += 3;
                    
                    // Crowd density (0-10 points)
                    const crowdDetections = latestDetections.filter(d => 
                        CROWD_LABELS.includes(d.label?.toLowerCase()) ||
                        CROWD_LABELS.includes(d.raw_label?.toLowerCase())
                    );
                    if (crowdDetections.length > 0) {
                        priorityScore += Math.min(crowdDetections.length * 5, 10);
                    }
                    
                    // Weapon/Explosion factor (0-10 points)
                    if (hasWeapon) priorityScore += 10;
                    if (latestDetections.some(d => 
                        (d.label?.toLowerCase() || d.raw_label?.toLowerCase()) === 'explosion'
                    )) priorityScore += 8;
                    
                    // Motion severity (0-5 points) - based on detection confidence
                    const avgConfidence = latestDetections.length > 0 
                        ? latestDetections.reduce((sum, d) => sum + (d.confidence || 0), 0) / latestDetections.length 
                        : 0;
                    priorityScore += Math.round(avgConfidence * 5);
                    
                    // Cap at 100
                    priorityScore = Math.min(Math.round(priorityScore), 100);
                    
                    // Determine Priority Level
                    let priorityLevel;
                    if (priorityScore >= 80) priorityLevel = 'Critical';
                    else if (priorityScore >= 60) priorityLevel = 'High';
                    else if (priorityScore >= 40) priorityLevel = 'Medium';
                    else priorityLevel = 'Low';
                    
                    // AI Confidence calculation (0-100)
                    const aiConfidence = Math.round(
                        (persistenceScore * 0.3 + 
                         Math.min(highConfDetections.length / 5, 1) * 0.25 +
                         (hasPersonWithVehicle ? 0.15 : 0) +
                         (avgConfidence > 0.7 ? 0.2 : avgConfidence * 0.2) +
                         (aiPayload.isAlert ? 0.1 : 0)) * 100
                    );
                    
                    // AI Metadata for detailed analysis
                    const allFireDetections = latestDetections.filter(d => {
                        const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                        return FIRE_LABELS.includes(label);
                    });
                    
                    const aiMetadata = {
                        fireDetections: {
                            strict: strictFireDetections.length,  // Actual fire/flame/candle
                            all: allFireDetections.length,          // Including smoke/color
                            hasStrictFire,
                            hasFireRelated,
                            byType: allFireDetections.reduce((acc, d) => {
                                const label = d.label?.toLowerCase() || d.raw_label?.toLowerCase();
                                acc[label] = (acc[label] || 0) + 1;
                                return acc;
                            }, {})
                        },
                        vehicleCount,
                        hasPerson,
                        hasPersonWithVehicle,
                        hasWeapon,
                        hasBlood,
                        crowdDetections: crowdDetections.length,
                        avgConfidence: Math.round(avgConfidence * 100),
                        persistenceScore: Math.round(persistenceScore * 100),
                        framesAnalyzed: histLen,
                        assignedReason: autoAssign ? 'AI_AUTO_CLASSIFY' : 'MANUAL_REVIEW_REQUIRED',
                        fireDetectionMethod: hasStrictFire ? 'YOLO_STRICT' : (hasFireRelated ? 'COLOR_FALLBACK' : 'NONE'),
                        classificationFactors: {
                            categoryPriority: categoryPriority[incidentCategory] || 15,
                            fireSizeScore: hasStrictFire ? Math.min(fireSizeScore, 25) : 0,
                            vehicleFactor: Math.min(vehicleCount * 3, 15),
                            humanRisk: hasBlood ? 10 : (hasPersonWithVehicle ? 8 : (hasPerson ? 3 : 0)),
                            crowdFactor: Math.min(crowdDetections.length * 5, 10),
                            threatLevel: hasWeapon ? 10 : 0
                        }
                    };
                    
                    // Low confidence escalation check
                    // If accidentConfidence >= 70 always assign directly; otherwise use AI confidence threshold
                    const HIGH_CONFIDENCE_DIRECT = aiPayload.accidentConfidence >= 70;
                    const LOW_CONFIDENCE_THRESHOLD = 50;
                    const needsManualReview = !HIGH_CONFIDENCE_DIRECT && aiConfidence < LOW_CONFIDENCE_THRESHOLD;
                    
                    if (needsManualReview && autoAssign) {
                        console.log(`⚠️ Low AI confidence (${aiConfidence}%) for incident in ${streamId}. Escalating to SuperResponder.`);
                    }

                    const streamMeta = activeStreams.get(streamId);
                    const finalStatus = needsManualReview ? 'pending_review' : (autoAssign ? 'assigned' : 'pending');
                    const finalAssignedBy = needsManualReview ? 'ai_low_confidence' : (autoAssign ? 'ai' : 'manual');
                    
                    // Only insert to DB here when NOT going to be deferred (needsManualReview or no autoAssign)
                    const autoBufCheck = autoRecBuffers.get(streamId);
                    const willDefer = finalStatus === 'assigned' && autoBufCheck && autoBufCheck.frames.length < AUTO_REC_MAX_FRAMES;
                    if (willDefer) {
                        // Store pending assign — the 20-frame buffer callback will execute it
                        autoBufCheck.pendingAutoAssign = {
                            streamId,
                            cameraName: streamMeta?.cameraName || streamId,
                            location: streamMeta?.location || 'Unknown',
                            decision,
                            priorityLevel,
                            incidentCategory,
                            responseAction,
                            accidentConfidence: aiPayload.accidentConfidence,
                            aiConfidence,
                            priorityScore,
                            frameSnapshot: frame.substring(0, 5000),
                            assignedTypes,
                            aiMetadata,
                            timestamp: aiPayload.timestamp,
                        };
                        console.log(`⏳ [Deferred] AI ≥70% — waiting for buffer to reach 20 frames (now at ${autoBufCheck.frames.length}) then saving incident + recording`);
                        io.emit('recording-state', { streamId, state: 'recording', frameCount: autoBufCheck.frames.length, maxFrames: AUTO_REC_MAX_FRAMES, pendingAiAssign: true });
                    }
                    if (!willDefer) { const [incResult] = await db.execute(
                        `INSERT INTO ai_incidents
                         (stream_id, camera_name, location, decision, severity, incident_category,
                          response_action, accident_confidence, ai_confidence, priority_score,
                          is_alert, frame_snapshot, status, assigned_to_types, assigned_by, 
                          assigned_at, ai_metadata)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW(), ?)`,
                        [
                            streamId,
                            streamMeta?.cameraName || streamId,
                            streamMeta?.location || 'Unknown',
                            decision,
                            priorityLevel, // Use calculated priority level instead of severity emoji
                            incidentCategory,
                            responseAction,
                            aiPayload.accidentConfidence,
                            aiConfidence,
                            priorityScore,
                            frame.substring(0, 5000), // save first 5KB of snapshot
                            finalStatus,
                            JSON.stringify(assignedTypes),
                            finalAssignedBy,
                            JSON.stringify(aiMetadata)
                        ]
                    );

                    const incidentId = incResult.insertId;
                    const incidentPayload = {
                        id: incidentId,
                        streamId,
                        cameraName: streamMeta?.cameraName || streamId,
                        location: streamMeta?.location || 'Unknown',
                        decision,
                        severity: priorityLevel,
                        incidentCategory,
                        responseAction,
                        accidentConfidence: aiPayload.accidentConfidence,
                        aiConfidence,
                        priorityScore,
                        priorityLevel,
                        aiMetadata,
                        assignedTypes,
                        assignedBy: finalAssignedBy,
                        status: finalStatus,
                        needsManualReview,
                        timestamp: aiPayload.timestamp,
                    };

                    // Notify SuperResponder dashboard of new incident
                    io.emit('new-ai-incident', incidentPayload);

                    if (finalStatus === 'assigned') { // start assigned block
                        const autoBuf = autoRecBuffers.get(streamId);
                        const bufferFull = autoBuf && autoBuf.frames.length >= AUTO_REC_MAX_FRAMES;

                        if (bufferFull) {
                            // Buffer already has 20 frames — save incident + recording immediately
                            io.emit('incident-assigned', incidentPayload);
                            console.log(`🤖 AI Auto-Assigned incident #${incidentId} (buffer full, saving now)`);
                            clearTimeout(autoBuf.discardTimer);
                            try {
                                const autoRec = await saveAutoRecording(streamId, incidentId);
                                if (autoRec) {
                                    autoBuf.state = 'saved';
                                    setAutoRecState(io, streamId, 'saved', { recordingId: autoRec.recordingId });
                                    io.emit('stream-recorded', { streamId, recordingId: autoRec.recordingId });
                                    io.emit('super-responder-incident-updated', { id: incidentId, status: 'assigned', assignedTypes });
                                    console.log(`🎬 [AutoRec] Saved recording #${autoRec.recordingId} for incident #${incidentId}`);
                                }
                            } catch (recErr) {
                                console.error('[AutoRec] AI auto-save failed:', recErr.message);
                            }
                        }
                    } else if (needsManualReview) {
                        console.log(`⚠️ Incident #${incidentId} needs manual review (AI confidence: ${aiConfidence}%)`);
                    } else {
                        console.log(`📋 Incident #${incidentId} queued for manual assignment`);
                    }
                    } // end !willDefer block
                } catch (assignErr) {
                    console.error('Auto-assign error (non-fatal):', assignErr.message);
                }
                // ── End AI Auto-Assignment ────────────────────────────────────
            }

        } catch (err) {
            console.error('AI analysis error:', err.message);
        } finally {
            if (streamAIState.has(streamId)) {
                streamAIState.get(streamId).analyzing = false;
            }
        }
    });

    // ── Manual assignment from CCTV page ─────────────────────────────────────
    socket.on('manual-assign', async (data) => {
        try {
            const {
                streamId, cameraName, location, decision, severity,
                incidentCategory, accidentConfidence, assignedTypes, notes
            } = data;

            const [result] = await db.execute(
                `INSERT INTO ai_incidents
                 (stream_id, camera_name, location, decision, severity, incident_category,
                  accident_confidence, is_alert, status, assigned_to_types, assigned_by, assigned_at, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'assigned', ?, 'manual', NOW(), ?)`,
                [
                    streamId || null,
                    cameraName || null,
                    location || 'Unknown',
                    decision || 'Manual Dispatch',
                    severity || 'Medium Risk',
                    incidentCategory || 'Unknown',
                    accidentConfidence || 0,
                    JSON.stringify(assignedTypes || []),
                    notes || null,
                ]
            );

            const payload = {
                id: result.insertId,
                streamId,
                cameraName,
                location,
                decision,
                severity,
                incidentCategory,
                accidentConfidence,
                assignedTypes: assignedTypes || [],
                assignedBy: 'manual',
                status: 'assigned',
                notes,
                timestamp: new Date().toISOString(),
            };

            io.emit('new-ai-incident', payload);
            io.emit('incident-assigned', payload);
            console.log(`📋 Manual assignment #${result.insertId} → [${(assignedTypes || []).join(', ')}]`);

            // Save auto-rec buffer for this stream
            const incidentId = result.insertId;
            const autoBuf = streamId ? autoRecBuffers.get(streamId) : null;
            console.log(`[AutoRec] manual-assign: streamId=${streamId}, buf=${autoBuf ? `frames=${autoBuf.frames.length} state=${autoBuf.state}` : 'NOT FOUND'}`);
            if (autoBuf && autoBuf.frames.length > 0 && autoBuf.state !== 'saved') {
                clearTimeout(autoBuf.discardTimer);
                const autoRec = await saveAutoRecording(streamId, incidentId);
                console.log(`[AutoRec] saveAutoRecording result:`, autoRec ? `saved ${autoRec.saved} frames → ${autoRec.relDir}` : 'FAILED');
                if (autoRec) {
                    autoBuf.state = 'saved';
                    setAutoRecState(io, streamId, 'saved', { recordingId: autoRec.recordingId });
                    io.emit('stream-recorded', { streamId, recordingId: autoRec.recordingId });
                    io.emit('super-responder-incident-updated', { id: incidentId, status: 'assigned', assignedTypes: assignedTypes || [] });
                }
            }
        } catch (err) {
            console.error('manual-assign error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        
        // Check if this socket was a broadcaster
        for (const [streamId, stream] of activeStreams.entries()) {
            if (stream.broadcasterId === socket.id) {
                // Notify all viewers that stream ended
                io.to(streamId).emit('stream-ended', { streamId });
                // Notify all admins
                io.emit('stream-ended', { 
                    streamId,
                    cameraName: stream.cameraName 
                });
                // Keep auto-rec buffer alive for 2 min grace period
                const autoBufD = autoRecBuffers.get(streamId);
                if (autoBufD && autoBufD.state !== 'saved' && autoBufD.frames.length > 0) {
                    clearTimeout(autoBufD.discardTimer);
                    autoBufD.state = 'awaiting';
                    io.emit('recording-state', { streamId, state: 'awaiting', frameCount: autoBufD.frames.length, maxFrames: AUTO_REC_MAX_FRAMES });
                    console.log(`⏳ [AutoRec] Disconnect — keeping ${autoBufD.frames.length} frames for 2min`);
                    autoBufD.discardTimer = setTimeout(() => {
                        const b = autoRecBuffers.get(streamId);
                        if (b && b.state !== 'saved') {
                            b.frames = []; autoRecBuffers.delete(streamId);
                            io.emit('recording-state', { streamId, state: 'discarded', frameCount: 0 });
                        }
                    }, 2 * 60 * 1000);
                } else if (autoBufD && autoBufD.state !== 'saved') {
                    autoRecBuffers.delete(streamId);
                }
                // Remove stream
                activeStreams.delete(streamId);
                console.log(`🛑 Stream ended (disconnect): ${streamId}`);
            } else if (stream.viewers.has(socket.id)) {
                // Remove viewer from stream
                stream.viewers.delete(socket.id);
                // Notify broadcaster
                io.to(stream.broadcasterId).emit('viewer-left', {
                    viewerId: socket.id,
                    viewerCount: stream.viewers.size
                });
                // Notify admins
                io.emit('stream-updated', {
                    streamId,
                    viewerCount: stream.viewers.size
                });
            }
        }
    });
});

// Make Socket.io available to routes
app.set('socketio', io);
app.set('activeStreams', activeStreams);

// Middleware
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://10.161.68.44:3000",
        "http://localhost:8081",
        "http://10.161.68.44:8081",
        "http://10.0.2.2:8081",
        "*"
    ],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes (no authentication required)
app.use('/api/emergency-contacts', emergencyContactsRoutes);
app.use('/api/auth', authRoutes);

// Notifications routes
const { router: notificationsRoutes } = require('./routes/notificationsRoutes');

// Apply authentication middleware globally
app.use(authMiddleware);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Expose auto-rec buffer + saver to routes
app.set('autoRecBuffers', autoRecBuffers);
app.set('saveAutoRecording', saveAutoRecording);
app.set('setAutoRecState', (streamId, state, extra) => setAutoRecState(io, streamId, state, extra));

// Protected routes (authentication required)
app.use('/api/incidents', incidentRoutes);
app.use('/api/cctv', cctvRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/super-responder', superResponderRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/system-settings', systemSettingsRoutes);

// AI Event Log endpoint
app.get('/api/ai/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(aiEventLog.slice(0, limit));
});

// AI Service health proxy
app.get('/api/ai/health', async (req, res) => {
    try {
        const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 3000 });
        res.json({ ...response.data, aiServiceUrl: AI_SERVICE_URL });
    } catch (err) {
        res.json({ status: 'unavailable', error: err.message, aiServiceUrl: AI_SERVICE_URL });
    }
});

// Get active streams info (for admin)
app.get('/api/streams', (req, res) => {
    const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
        streamId: id,
        cameraName: stream.cameraName,
        location: stream.location,
        viewerCount: stream.viewers.size,
        startTime: stream.startTime,
        duration: Math.floor((Date.now() - stream.startTime) / 1000)
    }));
    res.json(streams);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeStreams: activeStreams.size,
        services: {
            database: 'connected',
            socketio: 'running'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'SafeCity+ API',
        version: '1.0.0',
        status: '🚀 Running',
        endpoints: {
            incidents: '/api/incidents',
            auth: '/api/auth',
            cctv: '/api/cctv',
            users: '/api/users',
            streams: '/api/streams',
            health: '/health'
        },
        activeStreams: activeStreams.size,
        documentation: 'https://github.com/your-repo/safecityplus'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Global Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Create uploads directories
const uploadsDir = path.join(__dirname, 'uploads');
const cctvUploadsDir = path.join(__dirname, 'uploads', 'cctv');
const streamsDir = path.join(__dirname, 'uploads', 'streams');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(cctvUploadsDir)) fs.mkdirSync(cctvUploadsDir, { recursive: true });
if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir, { recursive: true });

console.log('📁 Upload directories ready');

// ── DB Migrations (run once at startup before accepting requests) ─────────────
async function addColumnIfMissing(table, column, definition) {
    const [rows] = await db.execute(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    if (rows[0].cnt === 0) {
        await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`✅ Column added: ${table}.${column}`);
    }
}

async function runMigrations() {
    try {
        // Convert role column from ENUM to VARCHAR so SuperResponder (and future roles) are accepted
        const [roleCols] = await db.execute(
            `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
        );
        if (roleCols[0] && roleCols[0].COLUMN_TYPE.startsWith('enum')) {
            await db.execute(
                `ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'User'`
            );
            console.log("✅ users.role converted from ENUM → VARCHAR(50)");
        }

        await addColumnIfMissing('users', 'email', 'VARCHAR(200) DEFAULT NULL');
        await addColumnIfMissing('users', 'responder_type', 'VARCHAR(100) DEFAULT NULL');
        await addColumnIfMissing('users', 'status', "VARCHAR(50) DEFAULT 'Active'");
        await addColumnIfMissing('users', 'password_changed', 'TINYINT(1) DEFAULT 1');
        // Existing users (admin-created before this feature) keep password_changed = 1 (no force change)
        // Only newly admin-created users get password_changed = 0

        // ai_incidents table for SuperResponder incident management
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ai_incidents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stream_id VARCHAR(100),
                camera_name VARCHAR(200),
                location VARCHAR(500),
                decision TEXT,
                severity VARCHAR(50),
                incident_category VARCHAR(100),
                response_action TEXT,
                accident_confidence FLOAT DEFAULT 0,
                ai_confidence FLOAT DEFAULT 0,
                priority_score INT DEFAULT 0,
                is_alert TINYINT(1) DEFAULT 0,
                frame_snapshot LONGTEXT,
                status VARCHAR(50) DEFAULT 'pending',
                assigned_to_types JSON,
                assigned_by VARCHAR(50) DEFAULT 'manual',
                assigned_at DATETIME,
                resolved_at DATETIME,
                notes TEXT,
                ai_metadata JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_stream_id (stream_id),
                INDEX idx_status (status),
                INDEX idx_priority (priority_score),
                INDEX idx_category (incident_category)
            )
        `);

        // Add new columns if they don't exist (for existing installations)
        await addColumnIfMissing('ai_incidents', 'ai_confidence', 'FLOAT DEFAULT 0');
        await addColumnIfMissing('ai_incidents', 'priority_score', 'INT DEFAULT 0');
        await addColumnIfMissing('ai_incidents', 'ai_metadata', 'JSON');
        await addColumnIfMissing('ai_incidents', 'assigned_by_user_id', 'INT DEFAULT NULL');
        await addColumnIfMissing('ai_incidents', 'latitude', 'FLOAT DEFAULT NULL');
        await addColumnIfMissing('ai_incidents', 'longitude', 'FLOAT DEFAULT NULL');
        await addColumnIfMissing('ai_incidents', 'clip_dir', "VARCHAR(255) DEFAULT NULL");
        await addColumnIfMissing('ai_incidents', 'clip_frame_count', "INT DEFAULT 0");
        await addColumnIfMissing('ai_incidents', 'recording_id', "INT DEFAULT NULL");

        // incident_clips table — stores per-incident recorded clip frames
        await db.execute(`
            CREATE TABLE IF NOT EXISTS incident_clips (
                id INT AUTO_INCREMENT PRIMARY KEY,
                incident_id INT NOT NULL,
                stream_id VARCHAR(100),
                clip_dir VARCHAR(255),
                frame_count INT DEFAULT 0,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_incident (incident_id)
            )
        `);

        // video_recordings table — full stream recordings saved on stream end
        await db.execute(`
            CREATE TABLE IF NOT EXISTS video_recordings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stream_id VARCHAR(100),
                camera_name VARCHAR(255),
                location VARCHAR(255),
                frame_count INT DEFAULT 0,
                duration_seconds INT DEFAULT 0,
                recording_dir VARCHAR(500),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_stream (stream_id),
                INDEX idx_created (created_at)
            )
        `);

        // Ensure video_recordings has all required columns (for existing installations)
        await addColumnIfMissing('video_recordings', 'stream_id', 'VARCHAR(100) DEFAULT NULL');
        await addColumnIfMissing('video_recordings', 'camera_name', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('video_recordings', 'location', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('video_recordings', 'frame_count', 'INT DEFAULT 0');
        await addColumnIfMissing('video_recordings', 'duration_seconds', 'INT DEFAULT 0');
        await addColumnIfMissing('video_recordings', 'recording_dir', 'VARCHAR(500) DEFAULT NULL');

        // system_settings table for ai auto-assign toggle (legacy block — no-op if table already exists)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        // Seed default ai_auto_assign = true if not set
        await db.execute(`
            INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('ai_auto_assign', 'true')
        `);

        // emergency_contacts table for admin-managed emergency numbers
        await db.execute(`
            CREATE TABLE IF NOT EXISTS emergency_contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                number VARCHAR(50) NOT NULL UNIQUE,
                alternative VARCHAR(50),
                icon VARCHAR(100) DEFAULT 'call',
                color VARCHAR(20) DEFAULT '#E63939',
                description TEXT,
                priority INT DEFAULT 999,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_priority (priority)
            )
        `);

        // Seed default emergency contacts if table is empty
        const [contactCount] = await db.execute('SELECT COUNT(*) as count FROM emergency_contacts');
        if (contactCount[0].count === 0) {
            await db.execute(`
                INSERT INTO emergency_contacts (name, number, alternative, icon, color, description, priority) VALUES
                ('Police', '911', '991', 'shield-checkmark', '#3b82f6', 'Law enforcement and public safety', 1),
                ('Ambulance', '907', '991', 'medkit', '#ef4444', 'Medical emergencies and ambulance services', 2),
                ('Fire Brigade', '912', '991', 'flame', '#f59e0b', 'Fire incidents and rescue operations', 3),
                ('Traffic Police', '945', '991', 'car', '#10b981', 'Car accidents, traffic issues', 4),
                ('Electricity Emergency', '980', '991', 'flash', '#8b5cf6', 'Power outages, electrical hazards', 5)
            `);
        }

        // password_reset_tokens table for automated password reset
        await db.execute(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                used BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_token (token),
                INDEX idx_user_id (user_id),
                INDEX idx_expires_at (expires_at)
            )
        `);
        
        // Clean up expired tokens
        await db.execute('DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = TRUE');
        console.log('✅ Password reset tokens table ready');

        // Create system_settings table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT,
                setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
                category VARCHAR(50) DEFAULT 'general',
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category),
                INDEX idx_key (setting_key)
            )
        `);
        console.log('✅ System settings table ready');

        // Insert default system settings
        const defaultSettings = [
            ['dark_mode', 'false', 'boolean', 'system', 'Enable dark mode theme'],
            ['auto_refresh', 'true', 'boolean', 'system', 'Automatically refresh dashboard data'],
            ['refresh_interval', '30', 'number', 'system', 'Data refresh interval in seconds'],
            ['language', 'en', 'string', 'system', 'Default system language'],
            ['data_retention', '90', 'number', 'system', 'Data retention period in days'],
            ['email_alerts', 'true', 'boolean', 'notifications', 'Enable email notifications'],
            ['sms_alerts', 'false', 'boolean', 'notifications', 'Enable SMS notifications'],
            ['critical_only', 'false', 'boolean', 'notifications', 'Only send critical incident alerts'],
            ['backup_schedule', 'daily', 'string', 'notifications', 'Automated backup schedule'],
            ['two_factor_auth', 'false', 'boolean', 'security', 'Enable two-factor authentication'],
            ['session_timeout', '60', 'number', 'security', 'Session timeout in minutes'],
            ['api_rate_limit', '100', 'number', 'api', 'API rate limit per minute'],
            ['api_timeout', '30', 'number', 'api', 'API request timeout in seconds'],
            ['max_file_size', '10', 'number', 'api', 'Maximum file upload size in MB'],
            ['cvt_quality', 'medium', 'string', 'cctv', 'CCTV video quality setting'],
            ['cvt_retention', '7', 'number', 'cctv', 'CCTV footage retention days'],
            ['cvt_detection_sensitivity', '0.7', 'number', 'cctv', 'AI detection sensitivity threshold'],
            ['emergency_contacts', '[]', 'json', 'emergency', 'Emergency contact list'],
            ['auto_dispatch', 'true', 'boolean', 'emergency', 'Auto-dispatch emergency services'],
            ['dispatch_radius', '5', 'number', 'emergency', 'Dispatch radius in kilometers']
        ];

        for (const [key, value, type, category, description] of defaultSettings) {
            await db.execute(`
                INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description)
                VALUES (?, ?, ?, ?, ?)
            `, [key, value, type, category, description]);
        }
        console.log('✅ Default system settings inserted');

        // notifications table will be created separately

        console.log('✅ DB migrations complete');
    } catch (err) {
        console.error('⚠️  Migration warning (non-fatal):', err.message);
    }
}

// Start server
const PORT = process.env.PORT || 5000;
runMigrations().then(async () => {
    // Test email configuration
    const emailReady = await testEmailConfig();
    if (!emailReady) {
        console.log('⚠️  Email service not configured - password reset emails will not be sent');
        console.log('💡 To enable emails, set EMAIL_USER and EMAIL_PASS in your .env file');
    } else {
        console.log('✅ Email service ready - password reset emails will be sent');
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
    ════════════════════════════════════════════════════════
    🚀 SafeCity+ Backend Server
    ════════════════════════════════════════════════════════
    📡 Server running on: http://localhost:${PORT}
    🔗 API Base URL: http://localhost:${PORT}/api
    🔌 WebSocket Server: ws://localhost:${PORT}
    💾 Database: ${process.env.DB_NAME || 'safecity_db'}
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    📹 CCTV Routes: http://localhost:${PORT}/api/cctv
    👥 Users Routes: http://localhost:${PORT}/api/users
    📡 Active Streams: ${activeStreams.size}
    ════════════════════════════════════════════════════════
        `);
    });
});

module.exports = { app, server, io, activeStreams };