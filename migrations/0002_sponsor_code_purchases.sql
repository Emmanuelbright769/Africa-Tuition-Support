CREATE TABLE IF NOT EXISTS sponsor_code_purchases (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affiliate_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cohort_id INTEGER NOT NULL UNIQUE REFERENCES sponsor_cohorts(id),
  transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  amount_usd DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'disabled', 'redeemed')),
  redeemed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sponsor_code_purchases_affiliate_request_uq
  ON sponsor_code_purchases (affiliate_user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS sponsor_code_purchases_status_created_idx
  ON sponsor_code_purchases (status, created_at DESC);