const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ዳታቤዙን መጀመሪያ እናነሳዋለን
require('./config/db');

// የኤፒአይ መንገዶች (Routes)
const incidentRoutes = require('./routes/incidentRoutes');
 const authRoutes = require('./routes/authRoutes'); // ዝግጁ ሲሆን ይከፈታል

const app = express();
const server = http.createServer(app);

// Socket.io ዝግጅት
const io = new Server(server, {
    cors: { origin: "*" }
});

// Socket.ioን በ app ውስጥ "set" ማድረጋችን በ controllers ውስጥ ለመጠቀም ይረዳል
app.set('socketio', io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes አጠቃቀም
app.use('/api/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);
// መነሻ ገጽ (ለሙከራ)
app.get('/', (req, res) => {
    res.send('🚀 Safe City Plus API is running...');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 SafeCity+ - Safe City Plus Backend running on port ${PORT}`);
});