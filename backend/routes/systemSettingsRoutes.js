const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all system settings
router.get("/", async (req, res) => {
  try {
    const [settings] = await db.execute(`
      SELECT setting_key, setting_value, setting_type, category, description
      FROM system_settings 
      ORDER BY category, setting_key
    `);
    
    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(setting => {
      let value = setting.setting_value;
      
      // Convert based on type
      switch (setting.setting_type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = [];
          }
          break;
        default:
          // Keep as string
          break;
      }
      
      settingsObj[setting.setting_key] = value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error("Error fetching system settings:", error);
    res.status(500).json({ message: "Error fetching system settings" });
  }
});

// Get settings by category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const [settings] = await db.execute(`
      SELECT setting_key, setting_value, setting_type, description
      FROM system_settings 
      WHERE category = ?
      ORDER BY setting_key
    `, [category]);
    
    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(setting => {
      let value = setting.setting_value;
      
      // Convert based on type
      switch (setting.setting_type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = [];
          }
          break;
        default:
          // Keep as string
          break;
      }
      
      settingsObj[setting.setting_key] = {
        value: value,
        description: setting.description,
        type: setting.setting_type
      };
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error("Error fetching settings by category:", error);
    res.status(500).json({ message: "Error fetching settings by category" });
  }
});

// Update multiple settings
router.put("/", async (req, res) => {
  try {
    const settings = req.body;
    const updatePromises = [];
    
    for (const [key, value] of Object.entries(settings)) {
      // Get setting type first
      const [settingInfo] = await db.execute(
        "SELECT setting_type FROM system_settings WHERE setting_key = ?",
        [key]
      );
      
      if (settingInfo.length === 0) {
        continue; // Skip if setting doesn't exist
      }
      
      const settingType = settingInfo[0].setting_type;
      let convertedValue = value;
      
      // Convert value based on type
      switch (settingType) {
        case 'boolean':
          convertedValue = value ? 'true' : 'false';
          break;
        case 'number':
          convertedValue = value.toString();
          break;
        case 'json':
          convertedValue = JSON.stringify(value);
          break;
        default:
          convertedValue = value.toString();
          break;
      }
      
      updatePromises.push(
        db.execute(
          "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?",
          [convertedValue, key]
        )
      );
    }
    
    await Promise.all(updatePromises);
    
    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating system settings:", error);
    res.status(500).json({ message: "Error updating system settings" });
  }
});

// Update single setting
router.put("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Get setting type first
    const [settingInfo] = await db.execute(
      "SELECT setting_type FROM system_settings WHERE setting_key = ?",
      [key]
    );
    
    if (settingInfo.length === 0) {
      return res.status(404).json({ message: "Setting not found" });
    }
    
    const settingType = settingInfo[0].setting_type;
    let convertedValue = value;
    
    // Convert value based on type
    switch (settingType) {
      case 'boolean':
        convertedValue = value ? 'true' : 'false';
        break;
      case 'number':
        convertedValue = value.toString();
        break;
      case 'json':
        convertedValue = JSON.stringify(value);
        break;
      default:
        convertedValue = value.toString();
        break;
    }
    
    await db.execute(
      "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?",
      [convertedValue, key]
    );
    
    res.json({ message: "Setting updated successfully" });
  } catch (error) {
    console.error("Error updating system setting:", error);
    res.status(500).json({ message: "Error updating system setting" });
  }
});

// Reset settings to defaults
router.post("/reset", async (req, res) => {
  try {
    const { category } = req.body;
    
    let query = "UPDATE system_settings SET setting_value = ";
    const defaults = {
      'dark_mode': 'false',
      'auto_refresh': 'true',
      'refresh_interval': '30',
      'language': 'en',
      'data_retention': '90',
      'email_alerts': 'true',
      'sms_alerts': 'false',
      'critical_only': 'false',
      'backup_schedule': 'daily',
      'two_factor_auth': 'false',
      'session_timeout': '60',
      'api_rate_limit': '100',
      'api_timeout': '30',
      'max_file_size': '10',
      'cvt_quality': 'medium',
      'cvt_retention': '7',
      'cvt_detection_sensitivity': '0.7',
      'emergency_contacts': '[]',
      'auto_dispatch': 'true',
      'dispatch_radius': '5'
    };
    
    if (category) {
      // Reset specific category
      const categorySettings = Object.keys(defaults).filter(key => {
        // This would need category mapping, for now reset all
        return true;
      });
      
      for (const key of categorySettings) {
        if (defaults[key] !== undefined) {
          await db.execute(
            "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?",
            [defaults[key], key]
          );
        }
      }
    } else {
      // Reset all settings
      for (const [key, value] of Object.entries(defaults)) {
        await db.execute(
          "UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?",
          [value, key]
        );
      }
    }
    
    res.json({ message: "Settings reset to defaults successfully" });
  } catch (error) {
    console.error("Error resetting system settings:", error);
    res.status(500).json({ message: "Error resetting system settings" });
  }
});

// Diagnostic endpoint to check table structure
router.get("/diagnose", async (req, res) => {
  try {
    // Check if table exists
    const [tables] = await db.execute(`
      SHOW TABLES LIKE 'system_settings'
    `);
    
    if (tables.length === 0) {
      return res.json({ exists: false, message: "Table does not exist" });
    }
    
    // Get table structure
    const [structure] = await db.execute(`
      DESCRIBE system_settings
    `);
    
    // Get all data
    const [data] = await db.execute(`
      SELECT * FROM system_settings LIMIT 5
    `);
    
    res.json({ 
      exists: true, 
      structure: structure,
      sampleData: data,
      columnCount: structure.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force drop and recreate table
router.post("/force-recreate", async (req, res) => {
  try {
    // Drop existing table
    await db.execute(`DROP TABLE IF EXISTS system_settings`);
    
    // Create the table
    await db.execute(`
      CREATE TABLE system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
        category VARCHAR(50) DEFAULT 'general',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_key (setting_key)
      )
    `);

    // Insert default settings
    const defaultSettings = [
      ['dark_mode', 'false', 'boolean', 'system', 'Enable dark mode theme'],
      ['auto_refresh', 'true', 'boolean', 'system', 'Automatically refresh dashboard data'],
      ['refresh_interval', '30', 'number', 'system', 'Data refresh interval in seconds'],
      ['language', 'en', 'string', 'system', 'Default system language'],
      ['data_retention', '90', 'number', 'system', 'Data retention period in days'],
      ['email_alerts', 'true', 'boolean', 'notifications', 'Enable email notifications'],
      ['sms_alerts', 'false', 'boolean', 'notifications', 'Enable SMS notifications'],
      ['critical_only', 'false', 'boolean', 'notifications', 'Only send critical incident alerts'],
      ['backup_schedule', 'daily', 'string', 'notifications', 'Automated backup schedule'],
      ['two_factor_auth', 'false', 'boolean', 'security', 'Enable two-factor authentication'],
      ['session_timeout', '60', 'number', 'security', 'Session timeout in minutes']
    ];

    for (const [key, value, type, category, description] of defaultSettings) {
      await db.execute(`
        INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description)
        VALUES (?, ?, ?, ?, ?)
      `, [key, value, type, category, description]);
    }

    res.json({ message: "System settings table recreated successfully" });
  } catch (error) {
    console.error("Error recreating table:", error);
    res.status(500).json({ message: "Error recreating table", error: error.message });
  }
});

module.exports = router;
