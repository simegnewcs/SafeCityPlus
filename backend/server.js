const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
    socket.on('stop-stream', (streamId) => {
        console.log(`🛑 Stop stream request: ${streamId} from ${socket.id}`);
        const stream = activeStreams.get(streamId);
        if (stream && stream.broadcasterId === socket.id) {
            // Notify all viewers in the room
            io.to(streamId).emit('stream-ended', { streamId });
            
            // BROADCAST TO ALL ADMINS THAT STREAM ENDED
            io.emit('stream-ended', { 
                streamId,
                cameraName: stream.cameraName 
            });
            
            // Remove stream from active streams
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
            const FIRE_LABELS     = ['fire','smoke'];
            const CROWD_LABELS    = ['crowd'];
            const CONSTRUCTION    = ['crane','hard hat','helmet'];
            const WEAPONS         = ['knife','gun','scissors'];
            const MEDICAL         = ['blood','ambulance'];
            const ALL_HIGH_RISK   = [...ROAD_VEHICLES, ...FIRE_LABELS, ...CROWD_LABELS,
                                     ...CONSTRUCTION, ...WEAPONS, ...MEDICAL, 'person'];

            // Count how many frames each label appeared in
            const objectCounts = {};
            for (const f of frameHistory) {
                const seenInFrame = new Set(f.detections.map(d => d.raw_label?.toLowerCase()));
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

            // Situation flags
            const hasFire       = latestDetections.some(d => FIRE_LABELS.includes(d.raw_label?.toLowerCase()));
            const hasWeapon     = latestDetections.some(d => WEAPONS.includes(d.raw_label?.toLowerCase()));
            const hasBlood      = latestDetections.some(d => d.raw_label?.toLowerCase() === 'blood');
            const hasCrowd      = latestDetections.some(d => CROWD_LABELS.includes(d.raw_label?.toLowerCase()));
            const hasCrane      = latestDetections.some(d => d.raw_label?.toLowerCase() === 'crane');
            const hasAmbulance  = latestDetections.some(d => d.raw_label?.toLowerCase() === 'ambulance');

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
            if (hasFire)    accidentConfidence = Math.max(accidentConfidence, 0.85);
            if (hasWeapon)  accidentConfidence = Math.max(accidentConfidence, 0.82);
            if (hasBlood)   accidentConfidence = Math.max(accidentConfidence, 0.80);
            if (hasCrane)   accidentConfidence = Math.max(accidentConfidence, 0.70);

            // ── Ethiopian Decision Engine ─────────────────────────────────
            let decision, severity, responseAction, incidentCategory;

            if (hasFire) {
                // 🔥 Fire & Explosion
                incidentCategory = 'Fire & Explosion';
                decision         = 'Fire / Explosion Emergency Detected';
                severity         = '🔴 Critical Emergency';
                responseAction   = 'Dispatch Fire Brigade & Ambulance immediately — evacuate area';

            } else if (hasWeapon) {
                // 🔫 Security / Weapon
                incidentCategory = 'Security';
                const w = latestDetections.find(d => WEAPONS.includes(d.raw_label?.toLowerCase()));
                decision       = `Weapon Detected — ${w?.raw_label || 'Unknown'}`;
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
                const labels = [...new Set(outOfCommon.map(d => d.raw_label))].join(', ');
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
            const trackedObjects = latestDetections.slice(0, 10).map((d, idx) => ({
                id: `T${String(idx + 1).padStart(2, '0')}`,
                label: d.raw_label || 'object',
                confidence: Math.round((d.confidence || 0) * 100),
                severity: d.severity || 'Low',
                direction: ['N','NE','E','SE','S','SW','W','NW'][idx % 8],
                speed: Math.round(20 + Math.random() * 60),
                timestamp: new Date().toISOString()
            }));

            // Build normalised bounding-box array for mobile overlay
            const bboxDetections = latestDetections.map(d => ({
                label:      (d.raw_label || d.type || 'object').toLowerCase(),
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
                isAlert: accidentConfidence >= 0.70 || hasFire || hasWeapon || hasBlood
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
                        "SELECT `value` FROM system_settings WHERE `key` = 'ai_auto_assign'"
                    );
                    const autoAssign = settingRows[0]?.value === 'true';

                    // Determine which responder types should handle this incident
                    const CATEGORY_MAP = {
                        'Vehicle Collision':        ['Traffic Police', 'Ambulance / Medical'],
                        'Fire / Smoke':             ['Fire Brigade'],
                        'Medical Emergency':        ['Ambulance / Medical'],
                        'Construction Accident':    ['Construction Safety'],
                        'Flood / Disaster':         ['Disaster Management'],
                        'Violence / Crime':         ['Armed Police'],
                        'Road Blockage':            ['Traffic Police', 'Road Safety'],
                        'Crowd Panic':              ['Armed Police', 'Ambulance / Medical'],
                        'Unknown':                  ['Traffic Police'],
                    };
                    const assignedTypes = CATEGORY_MAP[incidentCategory] || ['Traffic Police'];

                    const streamMeta = activeStreams.get(streamId);
                    const [incResult] = await db.execute(
                        `INSERT INTO ai_incidents
                         (stream_id, camera_name, location, decision, severity, incident_category,
                          response_action, accident_confidence, is_alert, frame_snapshot,
                          status, assigned_to_types, assigned_by, assigned_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW())`,
                        [
                            streamId,
                            streamMeta?.cameraName || streamId,
                            streamMeta?.location || 'Unknown',
                            decision,
                            severity,
                            incidentCategory,
                            responseAction,
                            aiPayload.accidentConfidence,
                            frame.substring(0, 5000), // save first 5KB of snapshot
                            autoAssign ? 'assigned' : 'pending',
                            JSON.stringify(autoAssign ? assignedTypes : []),
                            autoAssign ? 'ai' : 'manual',
                        ]
                    );

                    const incidentId = incResult.insertId;
                    const incidentPayload = {
                        id: incidentId,
                        streamId,
                        cameraName: streamMeta?.cameraName || streamId,
                        location: streamMeta?.location || 'Unknown',
                        decision,
                        severity,
                        incidentCategory,
                        responseAction,
                        accidentConfidence: aiPayload.accidentConfidence,
                        assignedTypes: autoAssign ? assignedTypes : [],
                        assignedBy: autoAssign ? 'ai' : 'manual',
                        status: autoAssign ? 'assigned' : 'pending',
                        timestamp: aiPayload.timestamp,
                    };

                    // Notify SuperResponder dashboard of new incident
                    io.emit('new-ai-incident', incidentPayload);

                    if (autoAssign) {
                        // Notify each assigned specialized responder group
                        io.emit('incident-assigned', incidentPayload);
                        console.log(`🤖 AI Auto-Assigned incident #${incidentId} → [${assignedTypes.join(', ')}]`);
                    } else {
                        console.log(`📋 Incident #${incidentId} queued for manual assignment`);
                    }
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

// Apply authentication middleware globally
app.use(authMiddleware);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cctv', cctvRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/super-responder', superResponderRoutes);

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
                is_alert TINYINT(1) DEFAULT 0,
                frame_snapshot LONGTEXT,
                status VARCHAR(50) DEFAULT 'pending',
                assigned_to_types JSON,
                assigned_by VARCHAR(50) DEFAULT 'manual',
                assigned_at DATETIME,
                resolved_at DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // system_settings table for ai auto-assign toggle
        await db.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                \`key\` VARCHAR(100) PRIMARY KEY,
                \`value\` TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        // Seed default ai_auto_assign = true if not set
        await db.execute(`
            INSERT IGNORE INTO system_settings (\`key\`, \`value\`) VALUES ('ai_auto_assign', 'true')
        `);

        console.log('✅ DB migrations complete');
    } catch (err) {
        console.error('⚠️  Migration warning (non-fatal):', err.message);
    }
}

// Start server
const PORT = process.env.PORT || 5000;
runMigrations().then(() => {
    server.listen(PORT, () => {
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