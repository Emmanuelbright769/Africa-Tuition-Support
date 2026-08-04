import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail, sendTradeWindowOpenEmail, sendTradeWindowCloseEmail, sendMaintenanceFeeEmail } from "./email";
import { pushToUser } from "./realtime";

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runMigrations() {
  try {
    await db.execute(sql`
      ALTER TABLE co_affiliates
        ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(14,6) NOT NULL DEFAULT 0
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
    // Seed default plan prices and tier payouts (skip if already set)
    // Add maintenance_fee to the transaction_type enum (safe to re-run; skipped if already exists)
    await db.execute(sql`ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'maintenance_fee'`);
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

    // ── cycle_started_at column (tracks start of current deposit cycle) ────────
    await db.execute(sql`
      ALTER TABLE trade_wallets
        ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMP
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

    // ── Fix roi_complete: SET true for users whose bot-session earnings ≥ profit target ─
    // Only counts actual bot trading sessions — referral commissions are excluded because
    // they inflate the cap calculation and are not the user's own trading performance.
    await db.execute(sql`
      UPDATE trade_wallets tw
      SET roi_complete = TRUE, updated_at = NOW()
      WHERE tw.roi_complete = FALSE
      AND tw.locked_principal::numeric > 0
      AND (
        SELECT COALESCE(SUM(t.amount_usd::numeric) FILTER (
          WHERE t.amount_usd::numeric > 0
          AND COALESCE(t.note, '') NOT LIKE 'Referral commission%'
        ), 0)
        FROM trade_transactions t
        WHERE t.user_id = tw.user_id AND t.type = 'bot_earning'
        AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
      ) >= tw.locked_principal::numeric * CASE
          WHEN tw.trading_plan_days = 60  THEN 0.70
          WHEN tw.trading_plan_days = 90  THEN 0.80
          ELSE 1.00
        END
    `);

    // ── Revert roi_complete for users incorrectly set by a previous migration ────────
    // The previous migration included referral commissions in the cap sum, which could
    // push users over the threshold when their actual bot-session earnings were below it.
    await db.execute(sql`
      UPDATE trade_wallets tw
      SET roi_complete = FALSE, updated_at = NOW()
      WHERE tw.roi_complete = TRUE
      AND tw.locked_principal::numeric > 0
      AND (
        SELECT COALESCE(SUM(t.amount_usd::numeric) FILTER (
          WHERE t.amount_usd::numeric > 0
          AND COALESCE(t.note, '') NOT LIKE 'Referral commission%'
        ), 0)
        FROM trade_transactions t
        WHERE t.user_id = tw.user_id AND t.type = 'bot_earning'
        AND t.created_at >= COALESCE(tw.cycle_started_at, '1970-01-01'::timestamptz)
      ) < tw.locked_principal::numeric * CASE
          WHEN tw.trading_plan_days = 60  THEN 0.70
          WHEN tw.trading_plan_days = 90  THEN 0.80
          ELSE 1.00
        END
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
        ? "The Itera Trading BOT weekly window is now OPEN (Mon 12:30 PM → Fri 12:30 PM GMT). Activate your bot daily to capture the 2% return."
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
// Auto-credited TRC20/BEP20 deposits are checked against TronScan / BscScan
// every 5 min. After a 10-min grace period:
//   • If the txHash matches our recipient address + amount → status="verified"
//   • If invalid (fake hash, wrong recipient, wrong amount) → wallet is debited,
//     status="reversed", user is notified.
// Deposits older than 48h that never resolved → status="expired_unverified".
// ─────────────────────────────────────────────────────────────────────────────
async function startCryptoDepositVerifierJob() {
  const INTERVAL_MS  = 5 * 60 * 1000;
  const GRACE_MS     = 10 * 60 * 1000;
  const TSIA_TRC20   = "TGwtyWAmBkcQiuD4CFavKr8ySTJ8zFt9Mj";
  const TSIA_BEP20   = "0x37d325aec8d4d0f8f103b9173dbb2ab732c85977".toLowerCase();
  const AMOUNT_TOLERANCE = 0.5; // dollars

  async function verifyTron(txHash: string, expectedUsd: number): Promise<{ ok: boolean; reason?: string }> {
    try {
      const r = await fetch(`https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txHash)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return { ok: false, reason: `tronscan http ${r.status}` };
      const d: any = await r.json();
      if (!d || Object.keys(d).length === 0) return { ok: false, reason: "tx not found on TRON" };
      if (d.contractRet && d.contractRet !== "SUCCESS") return { ok: false, reason: `tx status: ${d.contractRet}` };
      const transfer = d.tokenTransferInfo;
      if (!transfer) return { ok: false, reason: "no token transfer in this tx" };
      if (transfer.to_address !== TSIA_TRC20) return { ok: false, reason: `recipient mismatch (${transfer.to_address || "unknown"})` };
      const symbol = String(transfer.symbol || "").toUpperCase();
      if (symbol !== "USDT") return { ok: false, reason: `not USDT (got ${symbol || "unknown"})` };
      const decimals = parseInt(transfer.decimals || "6", 10) || 6;
      const amt = parseFloat(transfer.amount_str || "0") / Math.pow(10, decimals);
      if (Math.abs(amt - expectedUsd) > AMOUNT_TOLERANCE) {
        return { ok: false, reason: `amount mismatch (chain ${amt.toFixed(2)} vs claimed ${expectedUsd.toFixed(2)})` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: `tron api error: ${e?.message ?? "network"}` };
    }
  }

  async function verifyBsc(txHash: string, expectedUsd: number): Promise<{ ok: boolean; reason?: string }> {
    try {
      const apiKey = process.env.BSCSCAN_API_KEY ? `&apikey=${process.env.BSCSCAN_API_KEY}` : "";
      // Step 1 — receipt status
      const rs = await fetch(`https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${encodeURIComponent(txHash)}${apiKey}`, {
        signal: AbortSignal.timeout(15000),
      });
      const ds: any = await rs.json();
      if (ds?.result?.status !== "1") return { ok: false, reason: "tx failed or not found on BSC" };
      // Step 2 — list token transfers TO our address & match this hash
      const rt = await fetch(`https://api.bscscan.com/api?module=account&action=tokentx&address=${TSIA_BEP20}&startblock=0&endblock=99999999&sort=desc${apiKey}`, {
        signal: AbortSignal.timeout(15000),
      });
      const dt: any = await rt.json();
      if (!Array.isArray(dt?.result)) return { ok: false, reason: "could not fetch token transfers" };
      const tx = dt.result.find((t: any) => String(t.hash || "").toLowerCase() === txHash.toLowerCase());
      if (!tx) return { ok: false, reason: "tx not found among our address inflows" };
      if (String(tx.to || "").toLowerCase() !== TSIA_BEP20) return { ok: false, reason: "recipient mismatch" };
      const sym = String(tx.tokenSymbol || "").toUpperCase();
      if (!["USDT", "BUSD", "USDC"].includes(sym)) return { ok: false, reason: `unsupported token (${sym})` };
      const decimals = parseInt(tx.tokenDecimal || "18", 10) || 18;
      const amt = parseFloat(tx.value || "0") / Math.pow(10, decimals);
      if (Math.abs(amt - expectedUsd) > AMOUNT_TOLERANCE) {
        return { ok: false, reason: `amount mismatch (chain ${amt.toFixed(2)} vs claimed ${expectedUsd.toFixed(2)})` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: `bsc api error: ${e?.message ?? "network"}` };
    }
  }

  const run = async () => {
    try {
      const candidates = await storage.getCryptoDepositsNeedingVerification();
      if (candidates.length === 0) return;
      const now = Date.now();
      for (const dep of candidates) {
        const createdMs = new Date(dep.createdAt as any).getTime();
        const age = now - createdMs;
        if (age < GRACE_MS) continue; // wait for tx confirmations
        const wt = String(dep.walletType || "").toLowerCase();
        const expected = parseFloat(dep.amountUsd as any);
        if (!isFinite(expected) || expected <= 0) continue;

        let result: { ok: boolean; reason?: string };
        if (wt === "trc20") result = await verifyTron(dep.txHash, expected);
        else if (wt === "bep20") result = await verifyBsc(dep.txHash, expected);
        else continue;

        if (result.ok) {
          await storage.updateWalletDeposit(dep.id, { status: "verified" } as any);
          console.log(`[CRYPTO-VERIFY] ✓ Deposit #${dep.id} (${wt}) verified on-chain — $${expected.toFixed(2)}`);
        } else {
          // Reverse the credit
          try {
            const wallet = await storage.getOrCreateWallet(dep.userId);
            const newBal = Math.max(0, parseFloat(wallet.balance as any) - expected).toFixed(2);
            await storage.updateWalletBalance(dep.userId, newBal);
            await storage.updateWalletDeposit(dep.id, { status: "reversed" } as any);
            await storage.createTransaction({
              userId: dep.userId,
              type: "refund",
              amount: (-expected).toFixed(2),
              fee: "0.00",
              paymentMethod: wt,
              description: `Crypto deposit reversed — could not verify on-chain. Reason: ${result.reason}. Tx: ${String(dep.txHash).slice(0, 14)}…`,
            } as any);
            const notif = await storage.createNotification({
              userId: dep.userId,
              type: "deposit",
              title: "❌ Crypto Deposit Reversed",
              message: `We could not verify your ${wt.toUpperCase()} deposit on-chain (${result.reason}). $${expected.toFixed(2)} has been removed from your wallet. New balance: $${newBal}. If you believe this is a mistake, contact support with your tx hash.`,
              data: { depositId: dep.id, reason: result.reason, txHash: dep.txHash },
              isRead: false,
            } as any);
            try { pushToUser(dep.userId, "notification", notif); } catch {}
            try { pushToUser(dep.userId, "wallet:updated", { balance: newBal }); } catch {}
            console.warn(`[CRYPTO-VERIFY] ✗ Deposit #${dep.id} (${wt}) REVERSED — ${result.reason}`);
          } catch (revErr: any) {
            console.error(`[CRYPTO-VERIFY] Failed to reverse deposit #${dep.id}:`, revErr?.message ?? revErr);
          }
        }
      }
    } catch (e: any) {
      console.error("[CRYPTO-VERIFY] Job error:", e?.message ?? e);
    }
  };

  setInterval(run, INTERVAL_MS);
  console.log("[CRYPTO-VERIFY] Background on-chain verifier started — checks confirmed crypto deposits every 5 min");
}

async function startMaintenanceFeeJob() {
  const MAINTENANCE_FEE = 0.50;
  const SETTING_KEY = "maintenance_fee_last_run";

  const runDeduction = async () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    // Check if already run this month
    const lastRun = await storage.getPlatformSetting(SETTING_KEY);
    if (lastRun === monthKey) {
      console.log(`[MAINTENANCE-FEE] Already collected for ${monthLabel} — skipping.`);
      return;
    }

    const allUsers = await db.select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role }).from(users);
    const targets = allUsers.filter(u => u.role !== "admin");
    let deducted = 0;

    for (const u of targets) {
      try {
        const wallet = await storage.getOrCreateWallet(u.id);
        const currentBalance = parseFloat(wallet.balance as string);
        if (currentBalance <= 0) continue;

        // Deduct up to $0.50 — can dip below the $2 floor (intentional per product spec)
        const feeAmount = Math.min(MAINTENANCE_FEE, currentBalance);
        const newBalance = Math.max(0, currentBalance - feeAmount).toFixed(2);

        await storage.updateWalletBalance(u.id, newBalance);
        await storage.createTransaction({
          userId: u.id,
          type: "maintenance_fee",
          amount: (-feeAmount).toFixed(2),
          fee: "0.00",
          paymentMethod: "wallet",
          description: `Monthly maintenance fee — ${monthLabel}`,
        });
        const notif = await storage.createNotification({
          userId: u.id,
          type: "wallet_credit",
          title: "Monthly Maintenance Fee",
          message: `$${feeAmount.toFixed(2)} has been deducted from your TSIA SwiftWallet as the monthly maintenance fee (${monthLabel}). New balance: $${newBalance}.`,
          data: { fee: feeAmount.toFixed(2), newBalance, month: monthLabel },
          isRead: false,
        });
        try { pushToUser(u.id, "notification", notif); } catch {}
        try { pushToUser(u.id, "wallet:updated", { balance: newBalance }); } catch {}
        sendMaintenanceFeeEmail(u.email, u.firstName, feeAmount.toFixed(2), newBalance, monthLabel).catch(() => {});
        deducted++;
      } catch (e: any) {
        console.error(`[MAINTENANCE-FEE] Failed for user ${u.id}: ${e?.message ?? e}`);
      }
    }

    await storage.setPlatformSetting(SETTING_KEY, monthKey);
    console.log(`[MAINTENANCE-FEE] ${monthLabel} — deducted $${MAINTENANCE_FEE} from ${deducted}/${targets.length} users.`);
  };

  // Run immediately (catches any month whose 1st has already passed)
  await runDeduction();

  // Schedule future runs: fire at 00:05 on the 1st of every subsequent month
  const scheduleNext = () => {
    const now = new Date();
    const next1st = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 5, 0));
    const delay = next1st.getTime() - Date.now();
    setTimeout(async () => {
      await runDeduction();
      scheduleNext();
    }, delay);
    console.log(`[MAINTENANCE-FEE] Next collection scheduled: ${next1st.toUTCString()}`);
  };
  scheduleNext();
}

(async () => {
  await runMigrations();
  await registerRoutes(httpServer, app);
  await seedAdmin();
  startAutoRefundJob();
  startWalletFundPurgeJob();
  startTradeWindowBroadcastJob();
  startCryptoDepositVerifierJob();
  startMaintenanceFeeJob();

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
