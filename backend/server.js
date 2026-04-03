const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import database connection
const db = require('./config/db');

// Import authentication middleware
const authMiddleware = require('./middleware/authMiddleware');

// Import routes
const incidentRoutes = require('./routes/incidentRoutes');
const authRoutes = require('./routes/authRoutes');
const cctvRoutes = require('./routes/cctvRoutes');
const usersRoutes = require('./routes/usersRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io setup with proper CORS for all clients
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://192.168.137.1:3000", 
            "http://localhost:8081",
            "http://192.168.137.1:8081",
            "http://10.0.2.2:8081",
            "http://localhost:5000",
            "http://192.168.137.1:5000",
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

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    console.log('📊 Total active streams:', activeStreams.size);

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

    // Broadcaster starts a live stream
    socket.on('start-stream', (data) => {
        const { streamId, cameraName, location, userId } = data;
        
        console.log(`🎥 Starting stream: ${streamId} - ${cameraName} from ${socket.id}`);
        
        const newStream = {
            broadcasterId: socket.id,
            cameraName: cameraName || 'Mobile Stream',
            location: location || 'Unknown',
            userId: userId || null,
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

    // Handle video frames from broadcaster
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

    // Viewer joins a stream
    socket.on('join-stream', (streamId) => {
        console.log(`📡 Join stream request: ${streamId} from socket ${socket.id}`);
        const stream = activeStreams.get(streamId);
        if (stream) {
            stream.viewers.add(socket.id);
            socket.join(streamId);
            
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
        "http://192.168.137.1:3000",
        "http://localhost:8081",
        "http://192.168.137.1:8081",
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

// Start server
const PORT = process.env.PORT || 5000;
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

module.exports = { app, server, io, activeStreams };