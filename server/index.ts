import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { canonicalBotProfitPredicate } from "./tradeProfitEvidence";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail, sendTradeWindowOpenEmail, sendTradeWindowCloseEmail } from "./email";
import { pushToUser } from "./realtime";
import { processCurrentMonthlyBilling, reconcileMonthlyBilling } from "./monthlyBilling";
import { creditVerifiedDepositAtomic } from "./walletBalance";
import { creditTradeDepositAtomic, recordDepositOutcomeAtomic } from "./depositCredits";
import { enqueueFinancialEvent, processFinancialEventOutbox } from "./financialNotifications";
import { reconcileDuplicateBurstAccounts } from "./tradeBotCompletion";
import {
  TSIA_BEP20_ADDRESS,
  hasFinalBscSuccess,
  hasFinalTronSuccess,
  validateCanonicalUsdtTransfer,
} from "./cryptoDepositPolicy";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "15mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const safeResponse = path === "/api/identity-verifications/signup" &&
          typeof capturedJsonResponse.signupVerificationToken === "string"
          ? { ...capturedJsonResponse, signupVerificationToken: "[redacted]" }
          : capturedJsonResponse;
        logLine += ` :: ${JSON.stringify(safeResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_wallets (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('manual', 'signals', 'tsmart')),
        balance DECIMAL(16,6) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT service_wallets_user_service_uq UNIQUE (user_id, service_type)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_wallet_transactions (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES service_wallets(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        service_type TEXT NOT NULL CHECK (service_type IN ('manual', 'signals', 'tsmart')),
        amount DECIMAL(16,6) NOT NULL CHECK (amount <> 0), reference TEXT NOT NULL,
        kind TEXT NOT NULL, metadata JSONB, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT service_wallet_transactions_service_reference_uq UNIQUE (service_type, reference)
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS service_wallet_transactions_user_created_idx ON service_wallet_transactions (user_id, service_type, created_at DESC)`);
    await db.execute(sql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    `);
    await db.execute(sql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT,
        ADD COLUMN IF NOT EXISTS transaction_pin_set_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS transaction_pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS transaction_pin_locked_until TIMESTAMP,
        ADD COLUMN IF NOT EXISTS transaction_pin_announcement_seen_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS transaction_pin_announcement_notified_at TIMESTAMP
    `);
    await db.execute(sql`
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
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx
      ON admin_audit_logs (target_user_id, created_at DESC)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS proctoring_sessions (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        assessment_type TEXT NOT NULL CHECK (assessment_type IN ('kiddies','student','masters')),
        child_id INTEGER REFERENCES back_to_school_children(id),
        back_to_school_attempt_id INTEGER REFERENCES back_to_school_attempts(id),
        scholarship_id INTEGER REFERENCES scholarships(id),
        consented_at TIMESTAMP NOT NULL,
        consent_policy_version VARCHAR(80) NOT NULL,
        status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','ready','running','completed','interrupted','failed','deleted')),
        camera_available BOOLEAN NOT NULL DEFAULT FALSE,
        microphone_available BOOLEAN NOT NULL DEFAULT FALSE,
        device_health JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMP, completed_at TIMESTAMP, last_heartbeat_at TIMESTAMP,
        heartbeat_count INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0, total_bytes INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0, audio_bytes INTEGER NOT NULL DEFAULT 0,
        video_bytes INTEGER NOT NULL DEFAULT 0, audio_chunk_count INTEGER NOT NULL DEFAULT 0,
        video_chunk_count INTEGER NOT NULL DEFAULT 0, failure_reason TEXT, retention_until TIMESTAMP,
        deleted_at TIMESTAMP, deleted_by_user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS proctoring_media_chunks (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES proctoring_sessions(id),
        track TEXT NOT NULL CHECK (track IN ('audio','video')),
        sequence INTEGER NOT NULL CHECK (sequence >= 0),
        object_key TEXT NOT NULL UNIQUE, content_type VARCHAR(100) NOT NULL,
        byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(session_id, track, sequence)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS proctoring_playback_audits (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        actor_user_id INTEGER REFERENCES users(id),
        session_id INTEGER NOT NULL REFERENCES proctoring_sessions(id),
        chunk_id INTEGER REFERENCES proctoring_media_chunks(id),
        action VARCHAR(24) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE proctoring_sessions
        ADD COLUMN IF NOT EXISTS audio_bytes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS video_bytes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS audio_chunk_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS video_chunk_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS heartbeat_count INTEGER NOT NULL DEFAULT 0
    `);
    await db.execute(sql`ALTER TABLE proctoring_playback_audits ADD COLUMN IF NOT EXISTS reason TEXT`);
    await db.execute(sql`ALTER TABLE proctoring_playback_audits ALTER COLUMN actor_user_id DROP NOT NULL`);
    await db.execute(sql`
      ALTER TABLE proctoring_sessions
        DROP CONSTRAINT IF EXISTS proctoring_sessions_status_check,
        ALTER COLUMN status SET DEFAULT 'created'
    `);
    await db.execute(sql`
      ALTER TABLE proctoring_sessions
        ADD CONSTRAINT proctoring_sessions_status_check
        CHECK (status IN ('created','ready','running','completed','interrupted','failed','deleted'))
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS proctoring_sessions_owner_idx ON proctoring_sessions(owner_user_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS proctoring_chunks_session_idx ON proctoring_media_chunks(session_id, track, sequence)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_manual_credit_guards (
        reference TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE admin_manual_credit_guards ALTER COLUMN user_id DROP NOT NULL
    `);
    await db.execute(sql`
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
    `);
    await db.execute(sql`DROP INDEX IF EXISTS wallet_deposits_tx_hash_unique`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wallet_credit_claims (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        provider TEXT NOT NULL,
        reference TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id),
        deposit_id INTEGER REFERENCES wallet_deposits(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT wallet_credit_claims_provider_reference_uq UNIQUE (provider, reference)
      )
    `);
    await db.execute(sql`
      INSERT INTO wallet_credit_claims (provider, reference, user_id, deposit_id)
      SELECT LOWER(wallet_type), tx_hash, user_id, id
      FROM wallet_deposits
      WHERE tx_hash IS NOT NULL
        AND status IN ('completed', 'verified')
      ON CONFLICT (provider, reference) DO NOTHING
    `);
    await db.execute(sql`
      ALTER TABLE co_affiliates
        ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(14,6) NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE affiliate_trade_shares
        ADD COLUMN IF NOT EXISTS transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL
    `);
    await db.execute(sql`
      ALTER TABLE wallet_deposits
        ADD COLUMN IF NOT EXISTS metadata JSONB,
        ADD COLUMN IF NOT EXISTS failure_reason TEXT,
        ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    `);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS financial_event_key TEXT`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS notifications_financial_event_key_uq
      ON notifications (financial_event_key)
      WHERE financial_event_key IS NOT NULL
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS financial_events (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS financial_event_outbox (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        financial_event_id INTEGER NOT NULL REFERENCES financial_events(id) ON DELETE CASCADE,
        delivery_type TEXT NOT NULL CHECK (delivery_type IN ('user_email','admin_email','in_app')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMP NOT NULL DEFAULT NOW(),
        claimed_at TIMESTAMP,
        claimed_by TEXT,
        delivered_at TIMESTAMP,
        last_error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT financial_event_outbox_event_delivery_uq UNIQUE (financial_event_id, delivery_type)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS financial_event_outbox_ready_idx
      ON financial_event_outbox (status, available_at, id)
    `);
    await db.execute(sql`
      ALTER TABLE trade_wallets
        ADD COLUMN IF NOT EXISTS bot_activated_at TIMESTAMP
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id),
        type          TEXT NOT NULL CHECK (type IN ('bank','crypto')),
        amount        DECIMAL(14,2) NOT NULL,
        fee           DECIMAL(14,2) NOT NULL DEFAULT 0,
        net_amount    DECIMAL(14,2) NOT NULL,
        bank_name     TEXT,
        bank_code     TEXT,
        account_number TEXT,
        account_name  TEXT,
        network       TEXT,
        address       TEXT,
        status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','refunded')),
        admin_note    TEXT,
        processed_at  TIMESTAMP,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      ALTER TABLE verifications
        ADD COLUMN IF NOT EXISTS sponsorship_reason TEXT
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
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
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS sponsor_code_purchases_affiliate_request_uq
      ON sponsor_code_purchases (affiliate_user_id, idempotency_key)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sponsor_code_purchases_status_created_idx
      ON sponsor_code_purchases (status, created_at DESC)
    `);
    // Seed default plan prices and tier payouts (skip if already set)
    // Monthly account billing is recorded as two explicit ledger entries.
    await db.execute(sql`ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'subscription_fee'`);
    await db.execute(sql`ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'maintenance_fee'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monthly_billing_cycles (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month_key VARCHAR(7) NOT NULL,
        subscription_fee DECIMAL(10,2) NOT NULL DEFAULT 1.50,
        maintenance_fee DECIMAL(10,2) NOT NULL DEFAULT 0.50,
        total_fee DECIMAL(10,2) NOT NULL DEFAULT 2.00,
        status TEXT NOT NULL DEFAULT 'payment_required'
          CHECK (status IN ('payment_required', 'paid', 'waived')),
        balance_at_attempt DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        charged_at TIMESTAMP,
        last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT monthly_billing_cycles_user_month_uq UNIQUE (user_id, month_key)
      )
    `);
    await db.execute(sql`
      ALTER TABLE monthly_billing_cycles
      DROP CONSTRAINT IF EXISTS monthly_billing_cycles_status_check
    `);
    await db.execute(sql`
      ALTER TABLE monthly_billing_cycles
      ADD CONSTRAINT monthly_billing_cycles_status_check
      CHECK (status IN ('payment_required', 'paid', 'waived'))
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS monthly_billing_cycles_status_month_idx
      ON monthly_billing_cycles (month_key, status)
    `);
    await db.execute(sql`
      INSERT INTO platform_settings (key, value) VALUES
        ('plan_1yr_base',            '35'),
        ('plan_2yr_base',            '45'),
        ('plan_3yr_base',            '50'),
        ('plan_service_charge_rate', '0.10'),
        ('tier_silver_min',   '110'),
        ('tier_silver_max',   '130'),
        ('tier_gold_min',     '160'),
        ('tier_gold_max',     '180'),
        ('tier_platinum_min', '225'),
        ('tier_platinum_max', '230'),
        ('usd_ngn_buying_rate',  '1480'),
        ('usd_ngn_selling_rate', '1280')
      ON CONFLICT (key) DO NOTHING
    `);
    // ── BACKFILL: co_affiliates rows where share_percentage was stored as 0
    // Root cause: a code defect stored 0.0000000000 for all non-elite tiers
    // when those users enrolled. Only records with share_percentage = 0 are
    // touched. The correct formula mirrors the only correct record in the DB
    // (id=1, $10 000 elite → 0.0005000000 = SHARE_FACTOR × (10000/100)
    //  where SHARE_FACTOR = 0.000005).
    await db.execute(sql`
      UPDATE co_affiliates
      SET share_percentage = ROUND(0.000005 * (investment_category / 100.0), 10)
      WHERE share_percentage = 0
        AND status = 'active'
    `);
    console.log("[MIGRATE] Co-affiliate share_percentage backfill applied");

    // ── topup type for mid-cycle top-ups (distinct from initial deposit) ──────
    await db.execute(sql`ALTER TYPE trade_transaction_type ADD VALUE IF NOT EXISTS 'topup'`);
    // Administrative Trade-wallet adjustments are structurally distinct from
    // bot-session profit and can never advance cycle earnings progress.
    await db.execute(sql`ALTER TYPE trade_transaction_type ADD VALUE IF NOT EXISTS 'admin_credit'`);

    // ── cycle_started_at column (tracks start of current deposit cycle) ────────
    await db.execute(sql`
      ALTER TABLE trade_wallets
        ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE trade_wallets
        ADD COLUMN IF NOT EXISTS early_exit_completed BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // ── Backfill cycle_started_at: set it to the user's most recent deposit ─────
    // This ensures per-cycle deposit counts and earnings computations are correct
    // for all users who deposited before this column was added.
    await db.execute(sql`
      UPDATE trade_wallets tw
      SET cycle_started_at = (
        SELECT MAX(created_at) FROM trade_transactions
        WHERE user_id = tw.user_id AND type = 'deposit' AND status = 'completed'
      )
      WHERE tw.cycle_started_at IS NULL
      AND EXISTS (
        SELECT 1 FROM trade_transactions
        WHERE user_id = tw.user_id AND type = 'deposit' AND status = 'completed'
      )
    `);

    // ── Reconcile cumulative bot-profit counters from canonical ledger rows ───
    // total_bot_earnings is a cache of realised profit, never a source of truth.
    // Rebuild it for every funded wallet so withdrawals and old counter resets
    // cannot make the progress bar move backward or under-report prior earnings.
    const profitCounterRepair = await db.execute(sql`
      UPDATE trade_wallets tw
      SET total_bot_earnings = COALESCE((
        SELECT SUM(t.amount_usd::numeric)
        FROM trade_transactions t
        WHERE t.user_id = tw.user_id
          AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
          AND ${canonicalBotProfitPredicate("t")}
      ), 0)::decimal,
      updated_at = NOW()
      WHERE tw.locked_principal::numeric > 0
        AND ABS(
          tw.total_bot_earnings::numeric - COALESCE((
            SELECT SUM(t.amount_usd::numeric)
            FROM trade_transactions t
            WHERE t.user_id = tw.user_id
              AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
              AND ${canonicalBotProfitPredicate("t")}
          ), 0)
        ) > 0.000001
      RETURNING tw.user_id
    `);
    if (profitCounterRepair.rows.length > 0) {
      console.log(`[MIGRATE] Reconciled cumulative bot-profit counters for ${profitCounterRepair.rows.length} funded wallet(s)`);
    }

    // ── Fix roi_complete: SET true for users whose bot-session earnings ≥ profit target ─
    // profitTarget = lockedPrincipal × (1 + profitCapPct):
    //   60-day → ×1.70, 90-day → ×1.80, 120-day → ×2.00
    // Exclusions: referral commissions and admin balance adjustments are not the user's
    // own trading performance and must not count toward the profit cap.
    await db.execute(sql`
      UPDATE trade_wallets tw
      SET roi_complete = TRUE, updated_at = NOW()
      WHERE tw.roi_complete = FALSE
      AND tw.locked_principal::numeric > 0
      AND (
        SELECT COALESCE(SUM(t.amount_usd::numeric) FILTER (
          WHERE ${canonicalBotProfitPredicate("t")}
        ), 0)
        FROM trade_transactions t
        WHERE t.user_id = tw.user_id
        AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
      ) >= tw.locked_principal::numeric * CASE
          WHEN tw.trading_plan_days = 60  THEN 1.70
          WHEN tw.trading_plan_days = 90  THEN 1.80
          ELSE 2.00
        END
    `);

    // ── Revert roi_complete for users incorrectly marked (wrong formula or admin-inflated earnings) ──
    // Covers: old wrong-formula flags, referral commissions, and admin balance adjustments
    // that inflated cycle earnings past the threshold.
    await db.execute(sql`
      UPDATE trade_wallets tw
      SET roi_complete = FALSE, updated_at = NOW()
      WHERE tw.roi_complete = TRUE
      AND tw.locked_principal::numeric > 0
      AND (
        SELECT COALESCE(SUM(t.amount_usd::numeric) FILTER (
          WHERE ${canonicalBotProfitPredicate("t")}
        ), 0)
        FROM trade_transactions t
        WHERE t.user_id = tw.user_id
        AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
      ) < tw.locked_principal::numeric * CASE
          WHEN tw.trading_plan_days = 60  THEN 1.70
          WHEN tw.trading_plan_days = 90  THEN 1.80
          ELSE 2.00
        END
    `);

    // roi_complete represents a closed day-count cycle, not merely reaching
    // the profit cap. Active funded cycles continue through their configured
    // duration even after further earnings have been capped.
    await db.execute(sql`
      UPDATE trade_wallets
      SET roi_complete = FALSE, updated_at = NOW()
      WHERE locked_principal::numeric > 0
        AND COALESCE(early_exit_completed, FALSE) = FALSE
        AND trading_day_number < trading_plan_days
        AND roi_complete = TRUE
    `);
    // Durable replay protection for provider/session identities. PostgreSQL
    // still permits multiple legacy NULL hashes in this composite index.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS trade_transactions_user_tx_hash_unique
      ON trade_transactions (user_id, tx_hash)
    `);

    console.log("[MIGRATE] cycle_started_at column and roi_complete data fix applied");
    console.log("[MIGRATE] Schema migrations applied successfully");
  } catch (e) {
    console.error("[MIGRATE] Migration error:", e);
  }
}

async function seedAdmin() {
  const ADMIN_EMAIL = "admin@tsiforafrica.com";
  const ADMIN_PASSWORD = "admin123";
  try {
    const existing = await storage.getUserByEmailAndRole(ADMIN_EMAIL, "admin");
    if (!existing) {
      const admin = await storage.createUser({
        firstName: "TSIA",
        lastName: "Admin",
        email: ADMIN_EMAIL,
        phone: "",
        password: ADMIN_PASSWORD,
        country: "gb",
        role: "admin",
        referredBy: null,
      });
      await storage.updateUserAffiliateCode(admin.id, "ADMIN-TSIA");
      console.log("[SEED] Admin user created:", ADMIN_EMAIL);
    } else if (existing.password !== ADMIN_PASSWORD) {
      // Password drifted — correct it
      await db.update(users).set({ password: ADMIN_PASSWORD }).where(eq(users.id, existing.id));
      console.log("[SEED] Admin password corrected for:", ADMIN_EMAIL);
    } else {
      console.log("[SEED] Admin user OK:", ADMIN_EMAIL);
    }
  } catch (e) {
    console.error("[SEED] Failed to seed admin:", e);
  }
}

async function startWalletFundPurgeJob() {
  const INTERVAL_MS = 30 * 60 * 1000; // check every 30 minutes
  const runPurge = async () => {
    try {
      const expired = await storage.getStudentsPastFundDeadline();
      for (const student of expired) {
        // Double-check wallet is still not activated
        const wallet = await storage.getOrCreateWallet(student.id);
        if (wallet.activated) {
          // Wallet is activated — clear the deadline and skip
          await storage.setWalletFundDeadline(student.id, null);
          continue;
        }
        try {
          // Send notice email before resetting enrollment
          await sendEmail(
            student.email,
            "Your TSIA Enrollment Has Been Reset — Action Required",
            `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
              <h2 style="color:#d97706">Enrollment Reset — Wallet Not Funded in Time</h2>
              <p style="color:#374151">Hi ${student.firstName},</p>
              <p style="color:#6b7280">Your TSIA enrollment has been reset because your SwiftWallet was not funded within the required <strong>72-hour window</strong> after completing your WAEC validation.</p>
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#92400e">
                <strong>Your account is still active.</strong><br/>
                Your enrollment and WAEC verification records have been cleared. To re-enrol, you will need to log back in and restart the onboarding process — including re-payment of the portal fee.
              </div>
              <p style="font-size:13px;color:#6b7280">We welcome you back whenever you are ready. Simply log in at <a href="https://tsiforafrica.com/login" style="color:#d97706">tsiforafrica.com</a> and follow the onboarding steps again.</p>
              <p style="font-size:13px;color:#6b7280">— The TSIA Team</p>
            </div>`
          );
        } catch { /* non-critical */ }
        await storage.resetStudentEnrollment(student.id);
        console.log(`[PURGE] Reset enrollment for unfunded student ${student.id} (${student.email}) — deadline passed`);
      }
    } catch (e) {
      console.error("[PURGE] Error in wallet fund purge job:", e);
    }
  };
  await runPurge(); // run once at startup to catch any missed purges
  setInterval(runPurge, INTERVAL_MS);
  console.log("[PURGE] Wallet fund purge job started — checking every 30 minutes");
}

// Reviews only unresolved, failed, and expiring identity records. Successful
// unexpired records are deliberately not re-verified every month.
async function startIdentityVerificationReviewJob() {
  const runReview = async () => {
    const now = new Date();
    try {
      const due = await storage.getIdentityVerificationsDueForReview(now);
      for (const record of due) {
        if (record.userId) {
          const user = await storage.getUser(record.userId);
          if (user) {
            const expiring = record.documentExpiresAt && record.documentExpiresAt <= new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
            const title = expiring ? "Identity document review needed" : "Identity verification review needed";
            const message = expiring
              ? "Your identity document is expired or nearing expiry. Please contact support to update your verification."
              : "Your identity verification needs attention. Please contact support so we can help you complete it.";
            const notification = await storage.createNotification({
              userId: user.id, type: "system", title, message,
              data: { identityVerificationId: record.id, reason: expiring ? "document_expiry" : record.status },
              isRead: false,
            });
            try { pushToUser(user.id, "notification", notification); } catch {}
          }
        }
        await storage.markIdentityVerificationReviewed(record.id, now);
      }
      console.log(`[IDENTITY-REVIEW] Reviewed ${due.length} unresolved or expiring identity records.`);
    } catch (error: any) {
      console.error("[IDENTITY-REVIEW] Monthly review failed:", error?.message ?? error);
    }
  };

  await runReview(); // catches a review missed while the app was offline
  const scheduleNext = () => {
    const MAX_TIMEOUT_MS = 24 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const nextFirst = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 10, 0));
    const waitMs = nextFirst.getTime() - Date.now();
    setTimeout(async () => {
      if (Date.now() < nextFirst.getTime()) {
        scheduleNext();
        return;
      }
      await runReview();
      scheduleNext();
    }, Math.min(waitMs, MAX_TIMEOUT_MS)).unref();
    console.log(`[IDENTITY-REVIEW] Next review scheduled: ${nextFirst.toUTCString()}`);
  };
  scheduleNext();
}

async function startAutoRefundJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // check every 60 minutes (reduced from 15 min to cut compute costs)
  setInterval(async () => {
    try {
      const stale = await storage.getPendingWithdrawalsOlderThan24h();
      for (const wd of stale) {
        const refundAmt = parseFloat(wd.amount as string);
        const isTradeWd = (wd.type as string) === "trade_bank";

        // Credit the correct balance — trade_bank refunds go back to trade balance
        if (isTradeWd) {
          await storage.updateTradeBalance(wd.userId, refundAmt.toFixed(6));
        } else {
          const wallet = await storage.getOrCreateWallet(wd.userId);
          const newBalance = (parseFloat(wallet.balance as string) + refundAmt).toFixed(2);
          await storage.updateWalletBalance(wd.userId, newBalance);
          await storage.createTransaction({
            userId: wd.userId, type: "refund",
            amount: refundAmt.toFixed(2), fee: "0",
            paymentMethod: wd.type === "bank" ? "bank_transfer" : "crypto",
            description: "Auto-refund: withdrawal not processed within 24 hours",
          });
        }

        await storage.updateWithdrawalRequest(wd.id, {
          status: "refunded",
          adminNote: "Auto-refunded after 24h timeout",
          processedAt: new Date(),
        });
        const user = await storage.getUser(wd.userId);
        const notif = await storage.createNotification({
          userId: wd.userId, type: "wallet_credit",
          title: "Withdrawal Auto-Refunded",
          message: isTradeWd
            ? `Your trade bank withdrawal of $${refundAmt.toFixed(2)} was not processed within 24 hours and has been returned to your Trade Market balance.`
            : `Your withdrawal of $${refundAmt.toFixed(2)} was not processed within 24 hours and has been returned to your TSIA wallet.`,
          data: { withdrawalId: wd.id }, isRead: false,
        });
        try {
          await sendEmail(
            user!.email,
            "Withdrawal Auto-Refunded — TSIA",
            `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px">
              <h2 style="color:#92400e">Withdrawal Auto-Refunded</h2>
              <p style="color:#6b7280">Hi ${user!.firstName}, your withdrawal request was not processed within 24 hours.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;color:#92400e">
                <strong>$${refundAmt.toFixed(2)}</strong> has been returned to your ${isTradeWd ? "Trade Market balance" : "TSIA wallet"}.
              </div>
              <p style="font-size:13px;color:#6b7280">You can submit a new withdrawal request at any time. Please contact support if you need assistance.</p>
            </div>`
          );
        } catch {}
        console.log(`[AUTO-REFUND] Refunded withdrawal #${wd.id} ($${refundAmt}) for user ${wd.userId} [${wd.type}]`);
      }
    } catch (e) {
      console.error("[AUTO-REFUND] Error:", e);
    }
  }, INTERVAL_MS);
  console.log("[AUTO-REFUND] Job started — checking every 60 minutes");
}

async function startTradeWindowBroadcastJob() {
  const INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes
  const run = async () => {
    try {
      const now = new Date();
      const ukParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(now);
      const get = (t: string) => ukParts.find(p => p.type === t)?.value ?? "";
      const weekday = get("weekday"); // "Mon", "Fri", ...
      const hour = parseInt(get("hour"));
      const minute = parseInt(get("minute"));
      const dateKey = `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD UK

      // Trigger window: 12:30–12:34 GMT on Mon (open) / Fri (close)
      const inWindow = minute >= 30 && minute <= 34 && hour === 12;
      if (!inWindow) return;

      let kind: "open" | "close" | null = null;
      if (weekday === "Mon") kind = "open";
      else if (weekday === "Fri") kind = "close";
      if (!kind) return;

      const settingKey = `trade_window_${kind}_last_broadcast`;
      const last = await storage.getPlatformSetting(settingKey);
      if (last === dateKey) return; // already broadcast today

      const allUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role }).from(users);
      const recipients = allUsers.filter(u => u.role !== "admin");

      const title = kind === "open"
        ? "🟢 Trade Market Window OPEN"
        : "🔴 Trade Market Window CLOSED";
      const message = kind === "open"
        ? "The Itera Trading BOT weekly window is now OPEN (Mon 12:30 PM → Fri 12:30 PM GMT). Activate your bot daily to continue your selected trading cycle."
        : "The Itera Trading BOT weekly window is now CLOSED. The market reopens Monday at 12:30 PM GMT.";

      let sent = 0;
      for (const u of recipients) {
        try {
          await storage.createNotification({
            userId: u.id,
            type: kind === "open" ? "trade_window_open" : "trade_window_close",
            title, message, data: { kind, dateKey }, isRead: false,
          });
          if (kind === "open") {
            await sendTradeWindowOpenEmail(u.email, u.firstName).catch(() => {});
          } else {
            await sendTradeWindowCloseEmail(u.email, u.firstName).catch(() => {});
          }
          sent++;
        } catch { /* skip individual failures */ }
      }

      await storage.setPlatformSetting(settingKey, dateKey);
      console.log(`[TRADE-WINDOW] Broadcast ${kind.toUpperCase()} sent to ${sent}/${recipients.length} users (UK ${dateKey} ${hour}:${minute})`);
    } catch (e) {
      console.error("[TRADE-WINDOW] Broadcast job error:", e);
    }
  };
  await run();
  setInterval(run, INTERVAL_MS);
  console.log("[TRADE-WINDOW] Weekly broadcast job started — Mon/Fri 12:30 PM GMT");
}

// ─────────────────────────────────────────────────────────────────────────────
// Background on-chain verifier for crypto wallet deposits.
// Pending TRC20/BEP20 deposits are checked against TronScan / BscScan
// every 5 min. After a 10-min grace period:
//   • If the txHash matches our recipient address + amount → credit 95% once
//   • If invalid (fake hash, wrong recipient, wrong amount) → reject without credit
// Deposits older than 48h that never resolved → status="expired_unverified".
// ─────────────────────────────────────────────────────────────────────────────
async function startCryptoDepositVerifierJob() {
  const INTERVAL_MS  = 5 * 60 * 1000;
  const GRACE_MS     = 10 * 60 * 1000;

  type ChainVerification =
    | { status: "verified" }
    | { status: "pending"; reason: string }
    | { status: "invalid"; reason: string };

  async function verifyTron(txHash: string, expectedUsd: number): Promise<ChainVerification> {
    try {
      const r = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txHash)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return { status: "pending", reason: `TronScan temporarily returned HTTP ${r.status}` };
      const d: any = await r.json();
      if (!d || Object.keys(d).length === 0) return { status: "pending", reason: "transaction not found on TRON yet" };
      if (d.contractRet && d.contractRet !== "SUCCESS") return { status: "invalid", reason: `transaction status is ${d.contractRet}` };
      if (!hasFinalTronSuccess(d)) return { status: "pending", reason: "TRON transaction is not yet explicitly confirmed and final" };
      const transfer = d.tokenTransferInfo;
      if (!transfer) return { status: "invalid", reason: "transaction does not contain a token transfer" };
      const validated = validateCanonicalUsdtTransfer({
        network: "trc20",
        recipient: String(transfer.to_address || ""),
        contract: String(transfer.contract_address || transfer.contractAddress || ""),
        symbol: String(transfer.symbol || ""),
        rawAmount: String(transfer.amount_str || "0"),
        decimals: parseInt(transfer.decimals || "6", 10) || 6,
        expectedUsd,
      });
      return validated.ok ? { status: "verified" } : { status: "invalid", reason: validated.reason };
    } catch (e: any) {
      return { status: "pending", reason: "TRON verification service is temporarily unavailable" };
    }
  }

  async function verifyBsc(txHash: string, expectedUsd: number): Promise<ChainVerification> {
    try {
      const apiKey = process.env.BSCSCAN_API_KEY ? `&apikey=${process.env.BSCSCAN_API_KEY}` : "";
      // Step 1 — receipt status
      const rs = await fetch(`https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${encodeURIComponent(txHash)}${apiKey}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!rs.ok) return { status: "pending", reason: `BscScan temporarily returned HTTP ${rs.status}` };
      const ds: any = await rs.json();
      if (!ds?.result) return { status: "pending", reason: "transaction not found on BSC yet" };
      if (ds.result.status !== "1") return { status: "invalid", reason: "transaction failed on BSC" };
      // Step 2 — list token transfers TO our address & match this hash
      const rt = await fetch(`https://api.bscscan.com/api?module=account&action=tokentx&address=${TSIA_BEP20_ADDRESS}&startblock=0&endblock=99999999&sort=desc${apiKey}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!rt.ok) return { status: "pending", reason: `BscScan transfer lookup temporarily returned HTTP ${rt.status}` };
      const dt: any = await rt.json();
      if (!Array.isArray(dt?.result)) return { status: "pending", reason: "BSC token transfers are temporarily unavailable" };
      const sameHash = dt.result.filter((t: any) => String(t.hash || "").toLowerCase() === txHash.toLowerCase());
      if (!sameHash.length) return { status: "invalid", reason: "transaction is not an incoming transfer to TSIA" };
      const canonical = sameHash.find((tx: any) => validateCanonicalUsdtTransfer({
        network: "bep20",
        recipient: String(tx.to || ""),
        contract: String(tx.contractAddress || ""),
        symbol: String(tx.tokenSymbol || ""),
        rawAmount: String(tx.value || "0"),
        decimals: parseInt(tx.tokenDecimal || "18", 10) || 18,
        expectedUsd,
      }).ok);
      if (!canonical) return { status: "invalid", reason: "transaction does not contain the exact canonical USDT transfer" };
      if (!hasFinalBscSuccess(canonical)) return { status: "pending", reason: "BSC transaction has not reached required confirmations" };
      return { status: "verified" };
    } catch (e: any) {
      return { status: "pending", reason: "BSC verification service is temporarily unavailable" };
    }
  }

  async function enqueueCryptoOutcome(
    dep: any,
    status: "rejected" | "expired_unverified" | "manual_review",
    reason: string,
  ) {
    const user = await storage.getUser(dep.userId);
    if (!user) return;
    const network = String(dep.walletType).includes("bep20") ? "BEP20" : "TRC20";
    const isRejected = status === "rejected";
    const isExpired = status === "expired_unverified";
    const title = isRejected
      ? "Crypto Deposit Rejected"
      : isExpired
        ? "Crypto Deposit Verification Expired"
        : "Crypto Deposit Needs Manual Review";
    await recordDepositOutcomeAtomic({
      depositId: dep.id,
      userId: dep.userId,
      status,
      reason,
      event: {
        eventKey: `crypto-deposit:${dep.id}:${status}`,
        userId: dep.userId,
        eventType: isRejected ? "deposit_rejected" : isExpired ? "deposit_expired" : "deposit_manual_review",
        payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        receipt: {
          title,
          status: "pending",
          amount: `$${Number(dep.amountUsd).toFixed(2)}`,
          reference: String(dep.txHash),
          rows: [
            { label: "Network", value: network },
            { label: "Destination", value: String(dep.walletType).startsWith("trade_") ? "Trade Market Wallet" : "TSIA SwiftWallet" },
            { label: "Outcome", value: reason, color: "red" },
            { label: "Wallet credit", value: "$0.00", color: "red" },
          ],
          footerNote: "No funds were credited. Contact support if the blockchain transaction is valid.",
        },
        inApp: {
          title,
          message: `${reason}. No funds were credited.`,
          data: { depositId: dep.id, txHash: dep.txHash, status },
        },
        },
      },
    });
  }

  async function markCryptoFinalizationForReview(dep: any, error: unknown) {
    const reason = "The blockchain transfer was confirmed, but wallet finalization could not be completed safely";
    await enqueueCryptoOutcome(dep, "manual_review", reason);
    console.error(
      `[CRYPTO-VERIFY] Deposit #${dep.id} moved to manual review after finalization failure:`,
      error instanceof Error ? error.message : "unknown error",
    );
  }

  const run = async () => {
    try {
      const candidates = await storage.getCryptoDepositsNeedingVerification();
      if (candidates.length === 0) return;
      const now = Date.now();
      for (const dep of candidates) {
        try {
        const createdMs = new Date(dep.createdAt as any).getTime();
        const age = now - createdMs;
        if (age >= 48 * 60 * 60 * 1000) {
          await enqueueCryptoOutcome(dep, "expired_unverified", "No authoritative on-chain confirmation was found within 48 hours");
          continue;
        }
        if (age < GRACE_MS) continue; // wait for tx confirmations
        const wt = String(dep.walletType || "").toLowerCase();
        const network = wt.includes("bep20") ? "bep20" : wt.includes("trc20") ? "trc20" : null;
        const expected = parseFloat(dep.amountUsd as any);
        if (!network || !isFinite(expected) || expected <= 0 || !dep.txHash) continue;

        const result = network === "trc20"
          ? await verifyTron(dep.txHash, expected)
          : await verifyBsc(dep.txHash, expected);

        if (result.status === "verified") {
          const affiliateCut = parseFloat((expected * 0.05).toFixed(2));
          const userCredit = parseFloat((expected - affiliateCut).toFixed(2));
          const isTradeDeposit = wt === "trade_trc20" || wt === "trade_bep20";
          if (isTradeDeposit) {
            let tradeCredit;
            try {
              tradeCredit = await creditTradeDepositAtomic({
                depositId: dep.id,
                userId: dep.userId,
                gross: expected,
                target: wt,
                reference: String(dep.txHash),
                planDays: Number((dep.metadata as any)?.tradingPlanDays ?? 120),
                finalStatus: "verified",
              });
            } catch (error) {
              await markCryptoFinalizationForReview(dep, error);
              continue;
            }
            console.log(tradeCredit.credited
              ? `[CRYPTO-VERIFY] ✓ Trade deposit #${dep.id} (${network}) verified and credited.`
              : `[CRYPTO-VERIFY] Trade deposit #${dep.id} was already credited.`);
            continue;
          }
          let credited;
          try {
            credited = await creditVerifiedDepositAtomic({
              depositId: dep.id,
              userId: dep.userId,
              userCredit,
              fee: affiliateCut,
              provider: network,
              claimProvider: "crypto",
              reference: String(dep.txHash),
              description: `Verified crypto deposit (${String(dep.txHash).slice(0, 12)}…) — $${userCredit.toFixed(2)} credited (95%), $${affiliateCut.toFixed(2)} affiliate pool (5%)`,
              finalStatus: "verified",
            });
          } catch (error) {
            await markCryptoFinalizationForReview(dep, error);
            continue;
          }
          if (!credited.credited || !credited.balance) {
            console.log(`[CRYPTO-VERIFY] Deposit #${dep.id} already credited — skipping.`);
            continue;
          }
          const billing = await reconcileMonthlyBilling(dep.userId, new Date(), { recordAttempt: true });
          const newBalance = billing.chargedNow ? billing.walletBalance.toFixed(2) : credited.balance;
          try { pushToUser(dep.userId, "wallet:updated", { balance: newBalance }); } catch {}
          console.log(`[CRYPTO-VERIFY] ✓ Deposit #${dep.id} (${wt}) verified and credited — $${userCredit.toFixed(2)}`);
        } else if (result.status === "invalid") {
          try {
            await enqueueCryptoOutcome(dep, "rejected", result.reason);
            console.warn(`[CRYPTO-VERIFY] ✗ Deposit #${dep.id} (${wt}) REJECTED — ${result.reason}`);
          } catch (revErr: any) {
            console.error(`[CRYPTO-VERIFY] Failed to reject deposit #${dep.id}:`, revErr?.message ?? revErr);
          }
        } else console.log(`[CRYPTO-VERIFY] Deposit #${dep.id} remains pending — ${result.reason}`);
        } catch (candidateError: any) {
          console.error(
            `[CRYPTO-VERIFY] Candidate #${dep.id} failed independently:`,
            candidateError?.message ?? candidateError,
          );
        }
      }
    } catch (e: any) {
      console.error("[CRYPTO-VERIFY] Job error:", e?.message ?? e);
    }
  };

  setInterval(run, INTERVAL_MS);
  console.log("[CRYPTO-VERIFY] Background on-chain verifier started — checks pending crypto deposits every 5 min");
}

async function startFinancialNotificationJob() {
  const workerId = `financial-outbox-${process.pid}`;
  const run = async () => {
    try {
      const result = await processFinancialEventOutbox(workerId, 30);
      if (result.claimed) console.log(`[FINANCIAL-OUTBOX] Delivered ${result.delivered}/${result.claimed}; deferred ${result.retried}.`);
    } catch (error) {
      console.error("[FINANCIAL-OUTBOX] Worker error:", error instanceof Error ? error.message : "unknown");
    }
  };
  await run();
  setInterval(run, 30_000);
  console.log("[FINANCIAL-OUTBOX] Durable receipt and notification worker started.");
}

async function startMonthlyBillingJob() {
  const INTERVAL_MS = 60 * 60 * 1000;
  const run = async () => {
    try {
      const result = await processCurrentMonthlyBilling();
      if (result.processed > 0) {
        console.log(
          `[MONTHLY-BILLING] Processed ${result.processed}: `
          + `${result.paid} paid, ${result.restricted} restricted, ${result.failed} failed.`,
        );
      }
    } catch (error) {
      console.error("[MONTHLY-BILLING] Job failed:", error);
    }
  };

  await run();
  setInterval(run, INTERVAL_MS);
  console.log("[MONTHLY-BILLING] Reconciliation job started — checks hourly.");
}

(async () => {
  await runMigrations();
  if (process.env.NODE_ENV === "production") {
    const reconciled = await reconcileDuplicateBurstAccounts();
    console.log(`[TRADE-RECONCILIATION] Reconciled ${reconciled} duplicate-burst accounts.`);
  }
  await registerRoutes(httpServer, app);
  await seedAdmin();
  startAutoRefundJob();
  startWalletFundPurgeJob();
  startTradeWindowBroadcastJob();
  startCryptoDepositVerifierJob();
  startFinancialNotificationJob();
  startIdentityVerificationReviewJob();
  startMonthlyBillingJob();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
