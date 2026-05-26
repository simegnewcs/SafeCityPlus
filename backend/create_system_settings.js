const db = require('./config/db');

async function createSystemSettingsTable() {
  try {
    console.log('Creating system_settings table...');
    
    // Create the table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
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
    console.log('✅ System settings table created');

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
      ['session_timeout', '60', 'number', 'security', 'Session timeout in minutes'],
      ['api_rate_limit', '100', 'number', 'api', 'API rate limit per minute'],
      ['api_timeout', '30', 'number', 'api', 'API request timeout in seconds'],
      ['max_file_size', '10', 'number', 'api', 'Maximum file upload size in MB'],
      ['cvt_quality', 'medium', 'string', 'cctv', 'CCTV video quality setting'],
      ['cvt_retention', '7', 'number', 'cctv', 'CCTV footage retention days'],
      ['cvt_detection_sensitivity', '0.7', 'number', 'cctv', 'AI detection sensitivity threshold'],
      ['emergency_contacts', '[]', 'json', 'emergency', 'Emergency contact list'],
      ['auto_dispatch', 'true', 'boolean', 'emergency', 'Auto-dispatch emergency services'],
      ['dispatch_radius', '5', 'number', 'emergency', 'Dispatch radius in kilometers']
    ];

    console.log('Inserting default settings...');
    for (const [key, value, type, category, description] of defaultSettings) {
      await db.execute(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description)
        VALUES (?, ?, ?, ?, ?)
      `, [key, value, type, category, description]);
    }
    console.log('✅ Default system settings inserted');
    console.log('✅ System settings setup complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating system settings:', error);
    process.exit(1);
  }
}

createSystemSettingsTable();
