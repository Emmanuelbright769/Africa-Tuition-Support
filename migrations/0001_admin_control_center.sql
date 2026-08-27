-- Additive admin-control migration for existing populated databases.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  reference TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx
  ON admin_audit_logs (target_user_id, created_at DESC);

-- Manual credits use a dedicated replay guard rather than requiring historical
-- provider deposits to have globally unique references.
CREATE TABLE IF NOT EXISTS admin_manual_credit_guards (
  reference TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_manual_credit_guards ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'admin_manual_credit_guards'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE admin_manual_credit_guards DROP CONSTRAINT %I', constraint_name);
  END IF;
  ALTER TABLE admin_manual_credit_guards
    ADD CONSTRAINT admin_manual_credit_guards_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
END $$;

-- Remove the development-only global index if it was previously applied.
DROP INDEX IF EXISTS wallet_deposits_tx_hash_unique;