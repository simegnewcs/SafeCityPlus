const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const upload = multer({ dest: 'uploads/' });

// ===================== MySQL + Sequelize Connection =====================
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT,
    logging: false,
  }
);

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ Connected to MySQL Database'))
  .catch(err => console.error('❌ MySQL Connection Error:', err));

// ===================== MODELS (exactly as in your PDF) =====================

// Users Table
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  full_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'Citizen' },
  responder_type: { type: DataTypes.STRING },
  created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
});

// Incidents Table
const Incident = sequelize.define('Incident', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  is_guest: { type: DataTypes.BOOLEAN, defaultValue: false },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT },
  media_url: { type: DataTypes.STRING },
  ai_type: { type: DataTypes.STRING },
  ai_severity: { type: DataTypes.STRING },
  ai_priority: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'Pending' },
  assigned_responder_id: { type: DataTypes.INTEGER },
  created_at: { type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
});

// Sync tables (creates them automatically)
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Database tables synced (Users & Incidents)'));

// ===================== AUTH =====================
app.post('/api/auth/register', async (req, res) => {
  const { fullName, phone } = req.body;
  const token = jwt.sign({ phone, role: 'Citizen' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { fullName, phone, role: 'Citizen' } });
});

app.post('/api/auth/login', async (req, res) => {
  const { phone } = req.body;
  const token = jwt.sign({ phone, role: 'Citizen' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { phone, role: 'Citizen' } });
});

// ===================== SOS REPORT (now saves to MySQL) =====================
app.post('/api/incidents', upload.single('media'), async (req, res) => {
  try {
    const { description, latitude, longitude } = req.body;

    const newIncident = await Incident.create({
      user_id: 1, // later from token
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      description,
      media_url: req.file ? `/uploads/${req.file.filename}` : null,
    });

    // Call AI Service
    try {
      const axios = require('axios');
      const aiRes = await axios.post('http://localhost:8000/detect');
      newIncident.ai_type = aiRes.data.type;
      newIncident.ai_severity = aiRes.data.severity;
      newIncident.ai_priority = aiRes.data.priority;
      await newIncident.save();
    } catch (e) {
      console.log("AI service not responding yet");
    }

    res.json({ success: true, incident: newIncident });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all incidents
app.get('/api/incidents', async (req, res) => {
  const incidents = await Incident.findAll({ order: [['created_at', 'DESC']] });
  res.json(incidents);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📡 MySQL Database: ${process.env.DB_NAME}`);
});