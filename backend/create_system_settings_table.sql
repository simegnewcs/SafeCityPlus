-- Create system_settings table for storing dynamic system configuration
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
);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
-- System Settings
('dark_mode', 'false', 'boolean', 'system', 'Enable dark mode theme'),
('auto_refresh', 'true', 'boolean', 'system', 'Automatically refresh dashboard data'),
('refresh_interval', '30', 'number', 'system', 'Data refresh interval in seconds'),
('language', 'en', 'string', 'system', 'Default system language'),
('data_retention', '90', 'number', 'system', 'Data retention period in days'),

-- Notification Settings
('email_alerts', 'true', 'boolean', 'notifications', 'Enable email notifications'),
('sms_alerts', 'false', 'boolean', 'notifications', 'Enable SMS notifications'),
('critical_only', 'false', 'boolean', 'notifications', 'Only send critical incident alerts'),
('backup_schedule', 'daily', 'string', 'notifications', 'Automated backup schedule'),

-- Security Settings
('two_factor_auth', 'false', 'boolean', 'security', 'Enable two-factor authentication'),
('session_timeout', '60', 'number', 'security', 'Session timeout in minutes'),

-- API Settings
('api_rate_limit', '100', 'number', 'api', 'API rate limit per minute'),
('api_timeout', '30', 'number', 'api', 'API request timeout in seconds'),
('max_file_size', '10', 'number', 'api', 'Maximum file upload size in MB'),

-- CCTV Settings
('cvt_quality', 'medium', 'string', 'cctv', 'CCTV video quality setting'),
('cvt_retention', '7', 'number', 'cctv', 'CCTV footage retention days'),
('cvt_detection_sensitivity', '0.7', 'number', 'cctv', 'AI detection sensitivity threshold'),

-- Emergency Settings
('emergency_contacts', '[]', 'json', 'emergency', 'Emergency contact list'),
('auto_dispatch', 'true', 'boolean', 'emergency', 'Auto-dispatch emergency services'),
('dispatch_radius', '5', 'number', 'emergency', 'Dispatch radius in kilometers')

ON DUPLICATE KEY UPDATE 
setting_value = VALUES(setting_value),
updated_at = CURRENT_TIMESTAMP;
