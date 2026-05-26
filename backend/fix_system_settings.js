const db = require('./config/db');

async function fixSystemSettings() {
  try {
    console.log('Dropping existing system_settings table if it exists...');
    await db.execute('DROP TABLE IF EXISTS system_settings');
    
    console.log('Creating system_settings table with correct structure...');
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
    
    console.log('Inserting default settings...');
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
    
    console.log('✅ System settings table fixed successfully!');
    console.log('Testing table with a simple query...');
    const [test] = await db.execute('SELECT setting_key, setting_value FROM system_settings LIMIT 3');
    console.log('Sample data:', test);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing system settings:', error);
    process.exit(1);
  }
}

fixSystemSettings();
