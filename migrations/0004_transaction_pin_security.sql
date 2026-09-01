ALTER TABLE users
  ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS transaction_pin_set_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS transaction_pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_pin_locked_until TIMESTAMP,
  ADD COLUMN IF NOT EXISTS transaction_pin_announcement_seen_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS transaction_pin_announcement_notified_at TIMESTAMP;