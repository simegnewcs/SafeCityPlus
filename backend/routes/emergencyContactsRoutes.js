const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Get all emergency contacts (public endpoint - no auth required)
router.get('/', async (req, res) => {
  try {
    const contacts = await db.query(
      'SELECT * FROM emergency_contacts ORDER BY id ASC'
    );
    res.json(contacts[0]);
  } catch (error) {
    console.error('Error fetching emergency contacts:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single emergency contact (admin only)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const [contact] = await db.query(
      'SELECT * FROM emergency_contacts WHERE id = ?',
      [req.params.id]
    );
    
    if (!contact.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    
    res.json({ success: true, data: contact[0] });
  } catch (error) {
    console.error('Error fetching emergency contact:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create new emergency contact (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { name, number, alternative, icon, color, description } = req.body;
    
    // Validation
    if (!name || !number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and phone number are required' 
      });
    }
    
    // Check if contact with same number already exists
    const [existing] = await db.query(
      'SELECT id FROM emergency_contacts WHERE number = ? OR alternative = ?',
      [number, alternative]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'A contact with this phone number already exists' 
      });
    }
    
    const [result] = await db.query(
      `INSERT INTO emergency_contacts 
       (name, number, alternative, icon, color, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, number, alternative || null, icon || 'call', color || '#E63939', description]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Emergency contact created successfully',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    console.error('Error creating emergency contact:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update emergency contact (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { name, number, alternative, icon, color, description } = req.body;
    const contactId = req.params.id;
    
    // Check if contact exists
    const [existing] = await db.query(
      'SELECT id FROM emergency_contacts WHERE id = ?',
      [contactId]
    );
    
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    
    // Check if another contact has the same number
    if (number || alternative) {
      const [duplicate] = await db.query(
        'SELECT id FROM emergency_contacts WHERE (number = ? OR alternative = ?) AND id != ?',
        [number, alternative, contactId]
      );
      
      if (duplicate.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Another contact with this phone number already exists' 
        });
      }
    }
    
    await db.query(
      `UPDATE emergency_contacts 
       SET name = ?, number = ?, alternative = ?, icon = ?, color = ?, 
           description = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, number, alternative, icon, color, description, contactId]
    );
    
    res.json({ 
      success: true, 
      message: 'Emergency contact updated successfully',
      data: { id: contactId, ...req.body }
    });
  } catch (error) {
    console.error('Error updating emergency contact:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete emergency contact (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const contactId = req.params.id;
    
    // Check if contact exists
    const [existing] = await db.query(
      'SELECT id FROM emergency_contacts WHERE id = ?',
      [contactId]
    );
    
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    
    await db.query('DELETE FROM emergency_contacts WHERE id = ?', [contactId]);
    
    res.json({ 
      success: true, 
      message: 'Emergency contact deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting emergency contact:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reorder emergency contacts (admin only) - DISABLED until priority column is added
// router.put('/reorder', async (req, res) => {
//   try {
//     // Check if user is admin
//     if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'SuperAdmin')) {
//       return res.status(403).json({ success: false, message: 'Admin access required' });
//     }

//     const { contacts } = req.body; // Array of { id, priority }
    
//     if (!Array.isArray(contacts)) {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'Contacts array is required' 
//       });
//     }
    
//     // Update priorities in a transaction
//     const connection = await db.getConnection();
//     try {
//       await connection.beginTransaction();
      
//       for (const contact of contacts) {
//         await connection.query(
//           'UPDATE emergency_contacts SET priority = ?, updated_at = NOW() WHERE id = ?',
//           [contact.priority, contact.id]
//         );
//       }
      
//       await connection.commit();
//       res.json({ 
//         success: true, 
//         message: 'Contacts reordered successfully' 
//       });
//     } catch (error) {
//       await connection.rollback();
//       throw error;
//     } finally {
//       connection.release();
//     }
//   } catch (error) {
//     console.error('Error reordering emergency contacts:', error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

module.exports = router;
