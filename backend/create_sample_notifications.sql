-- Insert sample notifications for testing
INSERT INTO notifications (user_id, title, message, type, `read`) VALUES
(NULL, 'New Incident Reported', 'A fire incident has been reported in downtown area. Priority: High', 'incident', FALSE),
(NULL, 'System Update', 'SafeCity+ emergency response system has been updated with new features', 'system', TRUE),
(NULL, 'Emergency Alert', 'Severe weather warning issued for the area. Please stay safe.', 'emergency', FALSE),
(NULL, 'Assignment Complete', 'CCTV analysis for incident #123 has been completed successfully', 'assignment', TRUE),
(NULL, 'New Safety Tip', 'Learn how to use the SOS button effectively in emergency situations', 'system', FALSE),
(2, 'Personal Alert', 'Your recent incident report has been reviewed and assigned to responders', 'assignment', FALSE),
(NULL, 'Maintenance Notice', 'System maintenance scheduled for tonight at 2 AM', 'system', TRUE),
(NULL, 'Critical Incident', 'Multi-vehicle accident reported on highway. Emergency services dispatched.', 'emergency', FALSE);
