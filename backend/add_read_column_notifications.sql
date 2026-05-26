-- Add read column to notifications table (MySQL doesn't support IF NOT EXISTS with ALTER TABLE)
SET @dbname = DATABASE();
SET @tablename = 'notifications';
SET @columnname = 'read';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` BOOLEAN DEFAULT FALSE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index for read column for better performance
ALTER TABLE notifications ADD INDEX idx_read(`read`);
