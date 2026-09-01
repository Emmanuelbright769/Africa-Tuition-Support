CREATE TABLE IF NOT EXISTS service_wallets (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('manual', 'signals', 'tsmart')),
  balance DECIMAL(16,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT service_wallets_user_service_uq UNIQUE (user_id, service_type)
);

CREATE TABLE IF NOT EXISTS service_wallet_transactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES service_wallets(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('manual', 'signals', 'tsmart')),
  amount DECIMAL(16,6) NOT NULL CHECK (amount <> 0),
  reference TEXT NOT NULL,
  kind TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT service_wallet_transactions_service_reference_uq UNIQUE (service_type, reference)
);
CREATE INDEX IF NOT EXISTS service_wallet_transactions_user_created_idx
  ON service_wallet_transactions (user_id, service_type, created_at DESC);