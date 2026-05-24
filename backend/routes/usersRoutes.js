const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// Get all users
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT id, full_name, email, phone, role, responder_type, status, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await db.execute(`
            SELECT id, full_name, email, phone, role, responder_type, status, created_at 
            FROM users 
            WHERE id = ?
        `, [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(users[0]);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new user
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, phone, password, role, responder_type } = req.body;
        
        // Check if user already exists
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE phone = ?', 
            [phone]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'User with this phone number already exists' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insert user
        const [result] = await db.execute(`
            INSERT INTO users (full_name, email, phone, password, role, responder_type) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [fullName, email || null, phone, hashedPassword, role || 'User', responder_type || null]);
        
        res.json({ 
            success: true, 
            id: result.insertId,
            message: 'User created successfully' 
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, phone, password, role, responder_type, status } = req.body;
        
        let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, responder_type = ?, status = ?';
        let params = [fullName, email || null, phone, role, responder_type || null, status || null];
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            query += ', password = ?';
            params.push(hashedPassword);
        }
        
        query += ' WHERE id = ?';
        params.push(id);
        
        await db.execute(query, params);
        
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user exists
        const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM users');
        const [admin] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "Admin"');
        const [responder] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "Responder"');
        const [superResponder] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "SuperResponder"');
        const [user] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "User"');
        
        res.json({
            total: total[0].count,
            admin: admin[0].count,
            responder: responder[0].count,
            superResponder: superResponder[0].count,
            user: user[0].count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;