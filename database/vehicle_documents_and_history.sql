SET @vehicle_status_was_missing = (
  SELECT COUNT(*) = 0 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'status'
);
SET @add_vehicle_status = IF(
  @vehicle_status_was_missing,
  'ALTER TABLE vehicles ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT ''Available''',
  'SELECT 1'
);
PREPARE add_vehicle_status_stmt FROM @add_vehicle_status;
EXECUTE add_vehicle_status_stmt;
DEALLOCATE PREPARE add_vehicle_status_stmt;

SET @sync_vehicle_status = IF(
  @vehicle_status_was_missing,
  "UPDATE vehicles SET status = CASE
     WHEN UPPER(COALESCE(registration_status, 'ACTIVE')) IN ('INACTIVE', 'DISABLED') THEN 'Inactive'
     WHEN UPPER(COALESCE(registration_status, 'ACTIVE')) = 'MAINTENANCE' THEN 'Maintenance'
     ELSE 'Available'
   END",
  'SELECT 1'
);
PREPARE sync_vehicle_status_stmt FROM @sync_vehicle_status;
EXECUTE sync_vehicle_status_stmt;
DEALLOCATE PREPARE sync_vehicle_status_stmt;

SET @add_vehicle_owner_name = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'owner_name') = 0,
  'ALTER TABLE vehicles ADD COLUMN owner_name VARCHAR(160) NULL',
  'SELECT 1'
);
PREPARE add_vehicle_owner_name_stmt FROM @add_vehicle_owner_name;
EXECUTE add_vehicle_owner_name_stmt;
DEALLOCATE PREPARE add_vehicle_owner_name_stmt;

SET @add_vehicle_deleted = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'is_deleted') = 0,
  'ALTER TABLE vehicles ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE add_vehicle_deleted_stmt FROM @add_vehicle_deleted;
EXECUTE add_vehicle_deleted_stmt;
DEALLOCATE PREPARE add_vehicle_deleted_stmt;

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_name VARCHAR(100) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX vehicle_documents_vehicle_id_idx (vehicle_id)
);

CREATE TABLE IF NOT EXISTS vehicle_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT NOT NULL,
  action VARCHAR(80) NOT NULL,
  details LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX vehicle_history_vehicle_id_idx (vehicle_id)
);