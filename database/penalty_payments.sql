SET @add_penalty_payment_status = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'penalties' AND COLUMN_NAME = 'payment_status') = 0,
  'ALTER TABLE penalties ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT ''UNPAID''',
  'SELECT 1'
);
PREPARE add_penalty_payment_status_stmt FROM @add_penalty_payment_status;
EXECUTE add_penalty_payment_status_stmt;
DEALLOCATE PREPARE add_penalty_payment_status_stmt;

SET @add_penalty_paid_at = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'penalties' AND COLUMN_NAME = 'paid_at') = 0,
  'ALTER TABLE penalties ADD COLUMN paid_at TIMESTAMP NULL',
  'SELECT 1'
);
PREPARE add_penalty_paid_at_stmt FROM @add_penalty_paid_at;
EXECUTE add_penalty_paid_at_stmt;
DEALLOCATE PREPARE add_penalty_paid_at_stmt;