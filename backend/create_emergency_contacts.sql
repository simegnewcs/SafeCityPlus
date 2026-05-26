-- Drop existing table if it exists (to start fresh)
DROP TABLE IF EXISTS emergency_contacts;

-- Create emergency_contacts table
CREATE TABLE emergency_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    number VARCHAR(50) NOT NULL UNIQUE,
    alternative VARCHAR(50),
    icon VARCHAR(100) DEFAULT 'call',
    color VARCHAR(20) DEFAULT '#E63939',
    description TEXT,
    priority INT DEFAULT 999,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_priority (priority)
);

-- Insert default emergency contacts
INSERT INTO emergency_contacts (name, number, alternative, icon, color, description, priority) VALUES
('Police', '911', '991', 'shield-checkmark', '#3b82f6', 'Law enforcement and public safety', 1),
('Ambulance', '907', '991', 'medkit', '#ef4444', 'Medical emergencies and ambulance services', 2),
('Fire Brigade', '912', '991', 'flame', '#f59e0b', 'Fire incidents and rescue operations', 3),
('Traffic Police', '945', '991', 'car', '#10b981', 'Car accidents, traffic issues', 4),
('Electricity Emergency', '980', '991', 'flash', '#8b5cf6', 'Power outages, electrical hazards', 5);

-- Show the created table
DESCRIBE emergency_contacts;
