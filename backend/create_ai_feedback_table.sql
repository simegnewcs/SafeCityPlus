-- Create AI Feedback table for Confusion Matrix ground truth
-- This stores human-validated labels to evaluate AI detection accuracy

CREATE TABLE IF NOT EXISTS ai_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id VARCHAR(255) DEFAULT NULL,
    stream_id VARCHAR(255) DEFAULT NULL,
    was_correct BOOLEAN NOT NULL,
    actual_alert BOOLEAN NOT NULL,
    notes TEXT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_incident_id (incident_id),
    INDEX idx_stream_id (stream_id),
    INDEX idx_created_at (created_at),
    INDEX idx_was_correct (was_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment for documentation
ALTER TABLE ai_feedback 
COMMENT = 'Stores ground truth feedback for AI detection accuracy evaluation. Used to calculate confusion matrix metrics: TP (AI correct), FP (false alarm), FN (missed emergency), TN (correct normal).';
