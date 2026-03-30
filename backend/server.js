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
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    },
    pingTimeout: 60000, // 60 seconds for slow connections
    pingInterval: 25000
});

// Make Socket.io available to routes and controllers
app.set('socketio', io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('✅ New client connected:', socket.id);
    
    // Join room based on user role (if authenticated)
    socket.on('authenticate', (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`📱 User ${userId} joined their room`);
        }
    });
    
    // Join responder room
    socket.on('join_responder', (responderId) => {
        if (responderId) {
            socket.join(`responder_${responderId}`);
            console.log(`🚨 Responder ${responderId} joined responder room`);
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Increased limit for large images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply authentication middleware globally
// This will attach user to req if token exists, otherwise req.user = null
app.use(authMiddleware);

// Request logging middleware (for debugging)
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: 'connected',
            ai_service: 'checking...'
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
            health: '/health'
        },
        documentation: 'https://github.com/your-repo/safecityplus'
    });
});

// 404 handler - Route not found
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Global Error:', err.stack);
    
    // Handle specific error types
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: 'File too large. Maximum size is 50MB'
        });
    }
    
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            message: 'Database connection failed. Please try again later.'
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        // Close database connections
        db.end().catch(err => console.error('Error closing database:', err));
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        db.end().catch(err => console.error('Error closing database:', err));
        process.exit(0);
    });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Uploads directory created');
}

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════════
    🚀 SafeCity+ Backend Server
    ════════════════════════════════════════════
    📡 Server running on: http://localhost:${PORT}
    🔗 API Base URL: http://localhost:${PORT}/api
    💾 Database: ${process.env.DB_NAME || 'safecity_db'}
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    ════════════════════════════════════════════
    `);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🔥 Uncaught Exception:', error);
    // Don't exit immediately, log and continue
    // In production, you might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, log and continue
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

module.exports = { app, server, io };