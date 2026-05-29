const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD = 'safecity1234';

// Get all users
router.get('/', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT id, full_name, email, phone, role, responder_type, status, created_at, password_changed
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

// Create new user — admin-created users always get default password and must change on first login
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
        
        // Admin-created users always use default password regardless of what was passed
        const effectivePassword = DEFAULT_PASSWORD;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(effectivePassword, salt);
        
        // Insert user with password_changed = false (forced change on first login)
        const [result] = await db.execute(`
            INSERT INTO users (full_name, email, phone, password, role, responder_type, password_changed) 
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `, [fullName, email || null, phone, hashedPassword, role || 'User', responder_type || null]);
        
        res.json({ 
            success: true, 
            id: result.insertId,
            message: 'User created successfully',
            defaultPassword: DEFAULT_PASSWORD  // Return for admin to share with user
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Change password on first login — validates old password, updates, marks password_changed = true
router.post('/change-first-password', async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;

        if (!userId || !oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'userId, oldPassword, and newPassword are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        }

        const [users] = await db.execute('SELECT id, password, password_changed FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        if (newPassword === oldPassword) {
            return res.status(400).json({ success: false, message: 'New password must be different from the current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedNew = await bcrypt.hash(newPassword, salt);

        await db.execute('UPDATE users SET password = ?, password_changed = 1 WHERE id = ?', [hashedNew, userId]);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing first password:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, phone, password, oldPassword, role, responder_type, status } = req.body;
        
        // Get current user data to preserve required fields and password
        const [currentUser] = await db.execute('SELECT full_name, role, password FROM users WHERE id = ?', [id]);
        if (currentUser.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if requester is admin (for admin bypass)
        // This assumes the frontend sends the requester's role or we get it from JWT
        const requesterRole = req.body.requesterRole || req.headers['x-user-role'] || 'User';
        const isAdmin = requesterRole === 'Admin' || requesterRole === 'SuperResponder';
        const isSelfUpdate = req.body.requesterId === id || req.body.requesterId === parseInt(id);
        
        // If password is being updated, verify old password first (unless admin editing another user)
        if (password) {
            const requiresOldPassword = !isAdmin || isSelfUpdate;
            
            if (requiresOldPassword) {
                // Check if old password was provided
                if (!oldPassword) {
                    return res.status(400).json({ 
                        error: 'Old password is required to change password',
                        message: 'Please enter your current password'
                    });
                }
                
                // Verify old password matches
                const isMatch = await bcrypt.compare(oldPassword, currentUser[0].password);
                if (!isMatch) {
                    return res.status(400).json({ 
                        error: 'Old password is incorrect',
                        message: 'The current password you entered is wrong'
                    });
                }
            }
            // If admin editing another user, skip old password verification
        }
        
        let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, responder_type = ?, status = ?';
        let params = [
            fullName || currentUser[0].full_name, // Keep existing full_name if new one is empty
            email || null, 
            phone || null, 
            role || currentUser[0].role, // Keep existing role if new one is empty
            responder_type || null, 
            status || null
        ];
        
        // Only update password if verification passed (or admin bypass)
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