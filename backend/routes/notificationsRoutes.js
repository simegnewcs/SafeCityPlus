const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Get all notifications (with optional user filter)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    let query = `
      SELECT n.*, u.full_name as user_name 
      FROM notifications n 
      LEFT JOIN users u ON n.user_id = u.id 
      ORDER BY n.created_at DESC 
      LIMIT ${Number(limit)}
    `;
    
    const [notifications] = await db.execute(query);
    
    res.json({
      success: true,
      notifications: notifications,
      total: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get notifications for specific user
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    const [notifications] = await db.execute(
      `SELECT * FROM notifications 
       WHERE user_id = ? OR user_id IS NULL 
       ORDER BY created_at DESC 
       LIMIT ${Number(limit)}`,
      [userId]
    );
    
    res.json({
      success: true,
      notifications: notifications
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get unread count for user
router.get('/unread/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [result] = await db.execute(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE (user_id = ? OR user_id IS NULL) AND read = FALSE`,
      [userId]
    );
    
    res.json({
      success: true,
      unreadCount: result[0].count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.execute(
      'UPDATE notifications SET read = TRUE WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark all notifications as read for user
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      await db.execute(
        'UPDATE notifications SET read = TRUE WHERE user_id = ? OR user_id IS NULL',
        [userId]
      );
    }
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new notification (internal use)
const createNotification = async (userId, title, message, type = 'system', data = null) => {
  try {
    const [result] = await db.execute(
      `INSERT INTO notifications (user_id, title, message, type, data) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, data ? JSON.stringify(data) : null]
    );
    
    return result.insertId;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Create incident notification
const createIncidentNotification = async (incidentId, incidentType, priority = 'normal') => {
  try {
    const title = `New ${incidentType} Incident`;
    const message = `A new ${incidentType.toLowerCase()} incident has been reported. Priority: ${priority}`;
    
    // Create for all users (or specific responders based on type)
    await createNotification(null, title, message, 'incident', { incidentId });
    
    return true;
  } catch (error) {
    console.error('Error creating incident notification:', error);
    return false;
  }
};

module.exports = {
  router,
  createNotification,
  createIncidentNotification
};
