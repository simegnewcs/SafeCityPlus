const db = require('../config/db');

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        console.log('🔐 Auth Header:', authHeader);
        
        let token = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            console.log('🔐 Token extracted:', token);
        }
        
        if (!token) {
            console.log('👤 No token - guest mode');
            req.user = null;
            return next();
        }
        
        const userId = parseInt(token);
        console.log('🔐 User ID from token:', userId);
        
        if (isNaN(userId)) {
            console.log('⚠️ Invalid token format');
            req.user = null;
            return next();
        }
        
        const [users] = await db.execute(
            'SELECT id, full_name, phone, role FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            console.log('⚠️ User not found for ID:', userId);
            req.user = null;
            return next();
        }
        
        req.user = users[0];
        console.log('✅ User authenticated:', req.user.full_name, '(ID:', req.user.id, ')');
        next();
        
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        req.user = null;
        next();
    }
};