CREATE TABLE IF NOT EXISTS violation_types (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS penalties (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT NOT NULL UNIQUE,
  vehicle_id BIGINT NULL,
  violation_type_id BIGINT NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  violation_name VARCHAR(150) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  INDEX penalties_vehicle_id_idx (vehicle_id),
  INDEX penalties_status_created_idx (status, created_at)
);