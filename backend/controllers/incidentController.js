const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const db = require('../config/db');
const twilio = require('twilio');

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

exports.reportIncident = async (req, res) => {
    try {
        const { latitude, longitude, description } = req.body;
        const io = req.app.get('socketio'); // Socket.io ከ app ማግኘት

        if (!req.file) return res.status(400).json({ success: false, message: "No image provided" });

        const imagePath = req.file.path;
        const imageName = req.file.filename;

        // 1. ለ AI መላክ
        const formData = new FormData();
        formData.append('image', fs.createReadStream(imagePath));
        const aiResponse = await axios.post('http://127.0.0.1:8000/analyze', formData, {
            headers: formData.getHeaders(),
        });

        const { type, confidence, severity, priority } = aiResponse.data;

        // 2. MySQL ውስጥ መመዝገብ
        const sql = `INSERT INTO incidents (type, confidence, severity, priority, latitude, longitude, description, image_name, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`;
        
        const [result] = await db.execute(sql, [type, confidence, severity, priority, latitude, longitude, description, imageName]);

        const newIncident = {
            id: result.insertId,
            type, confidence, severity, priority, latitude, longitude, description,
            image_name: imageName,
            timestamp: new Date()
        };

        // 3. Real-time መላክ
        io.emit('new_incident', newIncident);

        // 4. High Priority SMS
        if (priority === 'High') {
            twilioClient.messages.create({
                body: `🚨 Safe City Plus: ${type} አደጋ ተከስቷል። በአፋጣኝ ዳሽቦርዱን ይከታተሉ!`,
                to: process.env.EMERGENCY_CONTACT,
                from: process.env.TWILIO_NUMBER
            }).catch(e => console.error(`❌ SMS Error: ${e.message}`));
        }

        res.status(201).json({ success: true, incident: newIncident });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllIncidents = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM incidents ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};