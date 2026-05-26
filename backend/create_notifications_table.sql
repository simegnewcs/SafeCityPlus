-- Create notifications table for dynamic notification system
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('incident', 'system', 'emergency', 'assignment') DEFAULT 'system',
    `read` BOOLEAN DEFAULT FALSE,
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_read (`read`),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type)
);
