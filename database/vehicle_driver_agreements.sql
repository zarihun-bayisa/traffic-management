CREATE TABLE IF NOT EXISTS vehicle_driver_agreements (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id BIGINT NOT NULL,
  driver_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX vehicle_driver_agreements_vehicle_dates_idx (vehicle_id, status, start_date, end_date),
  INDEX vehicle_driver_agreements_driver_dates_idx (driver_id, status, start_date, end_date),
  INDEX vehicle_driver_agreements_created_idx (created_at)
);