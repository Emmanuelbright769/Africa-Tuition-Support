import { sql } from "drizzle-orm";
import { db } from "./db";
import { pushToUser } from "./realtime";
import { acquireWalletUserLock } from "./walletBalance";
import {
  getBillingMonthKeys,
  getLagosBillingMonthKey,
  getMonthlyBillingDecision,
  isMonthlyBillingStarted,
  MONTHLY_MAINTENANCE_FEE_USD,
  MONTHLY_SUBSCRIPTION_FEE_USD,
  MONTHLY_TOTAL_FEE_USD,
  type MonthlyBillingStatus,
} from "@shared/monthlyBillingPolicy";

type BillingDbResult = MonthlyBillingStatus & {
  userId: number;
  chargedNow: boolean;
};

const paidBillingCache = new Map<string, MonthlyBillingStatus>();

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []);
  }
  return Array.isArray(result) ? result as T[] : [];
}

function feeMetadata() {
  return {
    subscriptionFee: MONTHLY_SUBSCRIPTION_FEE_USD,
    maintenanceFee: MONTHLY_MAINTENANCE_FEE_USD,
    totalFee: MONTHLY_TOTAL_FEE_USD,
  };
}

export async function reconcileMonthlyBilling(
  userId: number,
  now = new Date(),
  options: { recordAttempt?: boolean } = {},
): Promise<MonthlyBillingStatus> {
  if (!isMonthlyBillingStarted(now)) {
    return {
      required: false,
      hasAccess: true,
      state: "not_started",
      monthKey: null,
      ...feeMetadata(),
      amountDue: 0,
      unpaidMonths: 0,
      walletBalance: 0,
      shortfall: 0,
      chargedNow: false,
    };
  }

  const monthKey = getLagosBillingMonthKey(now);
  const cacheKey = `${userId}:${monthKey}`;
  const cachedPaid = paidBillingCache.get(cacheKey);
  if (cachedPaid) return { ...cachedPaid, chargedNow: false };

  const result = await db.transaction(async (tx): Promise<BillingDbResult> => {
    await acquireWalletUserLock(tx, userId);

    const userResult = await tx.execute(sql`
      SELECT id, role, account_status, created_at
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `);
    const user = rowsOf<{ id: number; role: string; account_status: string; created_at: string | Date }>(userResult)[0];
    if (!user) throw new Error("User not found");

    if (user.role === "admin" || user.account_status !== "active") {
      return {
        userId,
        required: false,
        hasAccess: true,
        state: "exempt",
        monthKey,
        ...feeMetadata(),
        amountDue: 0,
        unpaidMonths: 0,
        walletBalance: 0,
        shortfall: 0,
        chargedNow: false,
      };
    }

    await tx.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${userId}, 0, FALSE, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `);
    const walletResult = await tx.execute(sql`
      SELECT balance::numeric AS balance
      FROM wallets
      WHERE user_id = ${userId}
      FOR UPDATE
    `);
    const walletBalance = Number(rowsOf<{ balance: string | number }>(walletResult)[0]?.balance ?? 0);

    for (const requiredMonth of getBillingMonthKeys(now, new Date(user.created_at))) {
      await tx.execute(sql`
        INSERT INTO monthly_billing_cycles (
          user_id, month_key, subscription_fee, maintenance_fee, total_fee,
          status, balance_at_attempt, attempt_count, last_attempt_at, updated_at
        )
        VALUES (
          ${userId}, ${requiredMonth}, ${MONTHLY_SUBSCRIPTION_FEE_USD},
          ${MONTHLY_MAINTENANCE_FEE_USD}, ${MONTHLY_TOTAL_FEE_USD},
          'payment_required', ${walletBalance.toFixed(2)}, 1, NOW(), NOW()
        )
        ON CONFLICT (user_id, month_key) DO NOTHING
      `);
    }

    const unpaidResult = await tx.execute(sql`
      SELECT month_key
      FROM monthly_billing_cycles
      WHERE user_id = ${userId}
        AND month_key <= ${monthKey}
        AND status = 'payment_required'
      ORDER BY month_key
      FOR UPDATE
    `);
    const unpaidMonths = rowsOf<{ month_key: string }>(unpaidResult).map((row) => row.month_key);
    const amountDue = Number((unpaidMonths.length * MONTHLY_TOTAL_FEE_USD).toFixed(2));

    if (unpaidMonths.length === 0) {
      return {
        userId,
        required: true,
        hasAccess: true,
        state: "paid",
        monthKey,
        ...feeMetadata(),
        amountDue: 0,
        unpaidMonths: 0,
        walletBalance,
        shortfall: 0,
        chargedNow: false,
      };
    }

    if (getMonthlyBillingDecision(walletBalance, amountDue) === "restrict") {
      if (options.recordAttempt) {
        await tx.execute(sql`
          UPDATE monthly_billing_cycles SET
          balance_at_attempt = ${walletBalance.toFixed(2)},
          attempt_count = monthly_billing_cycles.attempt_count + 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
          WHERE user_id = ${userId}
            AND month_key <= ${monthKey}
            AND status = 'payment_required'
        `);
      }
      return {
        userId,
        required: true,
        hasAccess: false,
        state: "payment_required",
        monthKey,
        ...feeMetadata(),
        amountDue,
        unpaidMonths: unpaidMonths.length,
        walletBalance,
        shortfall: Number(Math.max(0, amountDue - walletBalance).toFixed(2)),
        chargedNow: false,
      };
    }

    const newBalance = Number((walletBalance - amountDue).toFixed(2));
    await tx.execute(sql`
      UPDATE wallets
      SET balance = ${newBalance.toFixed(2)}
      WHERE user_id = ${userId}
    `);
    for (const paidMonth of unpaidMonths) {
      await tx.execute(sql`
        INSERT INTO transactions (user_id, type, amount, fee, payment_method, description)
        VALUES
          (${userId}, 'subscription_fee', ${(-MONTHLY_SUBSCRIPTION_FEE_USD).toFixed(2)}, '0.00', 'wallet',
            ${`Monthly platform subscription — ${paidMonth}`}),
          (${userId}, 'maintenance_fee', ${(-MONTHLY_MAINTENANCE_FEE_USD).toFixed(2)}, '0.00', 'wallet',
            ${`Monthly wallet maintenance — ${paidMonth}`})
      `);
      await tx.execute(sql`
        UPDATE monthly_billing_cycles SET
          status = 'paid',
          balance_at_attempt = ${walletBalance.toFixed(2)},
          attempt_count = monthly_billing_cycles.attempt_count + 1,
          charged_at = NOW(),
          last_attempt_at = NOW(),
          updated_at = NOW()
        WHERE user_id = ${userId}
          AND month_key = ${paidMonth}
          AND status = 'payment_required'
      `);
    }
    await tx.execute(sql`
      INSERT INTO notifications (user_id, type, title, message, data, is_read)
      VALUES (
        ${userId},
        'system',
        'Monthly Platform Access Active',
        ${`$${amountDue.toFixed(2)} was collected for ${unpaidMonths.length} monthly billing cycle(s). Your platform access is active.`},
        ${JSON.stringify({
          monthKey,
          paidMonths: unpaidMonths,
          subscriptionFee: MONTHLY_SUBSCRIPTION_FEE_USD,
          maintenanceFee: MONTHLY_MAINTENANCE_FEE_USD,
          totalFee: amountDue,
          newBalance: newBalance.toFixed(2),
        })}::jsonb,
        FALSE
      )
    `);

    return {
      userId,
      required: true,
      hasAccess: true,
      state: "paid",
      monthKey,
      ...feeMetadata(),
      amountDue: 0,
      unpaidMonths: 0,
      walletBalance: newBalance,
      shortfall: 0,
      chargedNow: true,
    };
  });

  if (result.chargedNow) {
    try {
      pushToUser(userId, "wallet:updated", { balance: result.walletBalance.toFixed(2) });
      pushToUser(userId, "billing:updated", result);
    } catch {}
  }

  const { userId: _userId, ...status } = result;
  if (status.state === "paid") {
    paidBillingCache.set(cacheKey, { ...status, chargedNow: false });
  }
  return status;
}

export async function processCurrentMonthlyBilling(now = new Date()): Promise<{
  processed: number;
  paid: number;
  restricted: number;
  failed: number;
}> {
  if (!isMonthlyBillingStarted(now)) {
    return { processed: 0, paid: 0, restricted: 0, failed: 0 };
  }

  const result = await db.execute(sql`
    SELECT id
    FROM users
    WHERE role <> 'admin' AND account_status = 'active'
    ORDER BY id
  `);
  const targets = rowsOf<{ id: number }>(result);
  let paid = 0;
  let restricted = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const status = await reconcileMonthlyBilling(target.id, now);
      if (status.hasAccess) paid += 1;
      else restricted += 1;
    } catch (error) {
      failed += 1;
      console.error(`[MONTHLY-BILLING] Failed for user ${target.id}:`, error);
    }
  }

  return { processed: targets.length, paid, restricted, failed };
}