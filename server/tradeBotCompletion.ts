import { and, eq, sql } from "drizzle-orm";
import {
  financialEvents,
  notifications,
  platformSettings,
  TRADE_MARKET,
  tradeTransactions,
  tradeWallets,
  transactions,
  users,
  wallets,
} from "@shared/schema";
import { db } from "./db";

const PLANS: Record<number, { dailyRate: number; lossMin: number; lossMax: number; profitCapPct: number }> = {
  60: { dailyRate: .04, lossMin: .010, lossMax: .040, profitCapPct: .70 },
  90: { dailyRate: .03, lossMin: .008, lossMax: .030, profitCapPct: .80 },
  120: { dailyRate: .02, lossMin: .005, lossMax: .020, profitCapPct: 1 },
};

const money = (value: number) => Number(value.toFixed(6));
const lossRate = (day: number, plan: number) => {
  const config = PLANS[plan] ?? PLANS[120];
  return config.lossMin + (((day * 37 + 17) % 100) / 100) * (config.lossMax - config.lossMin);
};

export type BotCompletionResult = {
  completed: boolean;
  earning?: string;
  elapsedHours?: string;
  ratePercent?: string;
  newBalance?: string;
  totalBotEarnings?: string;
  isLossDay?: boolean;
  cycleDay?: number;
  cycleDays?: number;
  cycleComplete?: boolean;
  capped?: boolean;
};

/**
 * Settles exactly one persisted bot activation.  The activation timestamp is
 * the durable session identity; callers never supply a session identifier.
 */
export async function completeTradeBotSessionAtomic(userId: number, now = new Date()): Promise<BotCompletionResult> {
  return db.transaction(async (tx) => {
    // Must remain the same lock used by early exit and activation.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${userId})`);
    const [wallet] = await tx.select().from(tradeWallets).where(eq(tradeWallets.userId, userId)).for("update");
    if (!wallet?.botActivatedAt) return { completed: false };

    const activatedAt = new Date(wallet.botActivatedAt);
    const sessionHash = `BOT-SESSION-${userId}-${activatedAt.toISOString()}`;
    // Defensive for legacy/manual marker changes.  Under the wallet lock this
    // also makes a retry after an interrupted older deployment replay-safe.
    const existing = await tx.select({ id: tradeTransactions.id }).from(tradeTransactions)
      .where(and(eq(tradeTransactions.userId, userId), eq(tradeTransactions.txHash, sessionHash))).limit(1);
    if (existing.length) return { completed: false };

    const balance = Number(wallet.tradeBalance);
    if (balance <= 0) throw new Error("No balance to earn from.");
    const planDays = [60, 90, 120].includes(wallet.tradingPlanDays) ? wallet.tradingPlanDays : 120;
    const config = PLANS[planDays];
    const cycleDay = (wallet.tradingDayNumber ?? 0) + 1;
    const isLossDay = (wallet.lossDayNumbers ?? []).includes(cycleDay);
    const elapsedMs = Math.max(0, Math.min(now.getTime() - activatedAt.getTime(), 12 * 3600 * 1000));
    const elapsedHours = (elapsedMs / 3600000).toFixed(1);
    const fraction = elapsedMs / (12 * 3600 * 1000);
    const [setting] = await tx.select({ value: platformSettings.value }).from(platformSettings)
      .where(eq(platformSettings.key, "trade_bot_full_rate")).limit(1);
    const baseRate = planDays === 120 && setting?.value ? Number(setting.value) : config.dailyRate;

    let amount = 0;
    let rate = 0;
    let affiliate = 0;
    let referrerId: number | undefined;
    let referredUserName = "Your referral";
    let capped = false;
    if (isLossDay) {
      rate = lossRate(cycleDay, planDays) * fraction;
      amount = -money(balance * rate);
    } else {
      rate = baseRate * fraction;
      const gross = money(balance * rate);
      const [user] = await tx.select({
        referredBy: users.referredBy,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, userId));
      referredUserName = `${user?.firstName ?? "Your referral"} ${user?.lastName ?? ""}`.trim();
      // Only deduct after a concrete affiliate-code lookup succeeds.  This
      // avoids charging a user for a stale/malformed referral string.
      if (user?.referredBy) {
        const [referrer] = await tx.select({ id: users.id }).from(users)
          .where(eq(users.affiliateCode, user.referredBy.trim().toUpperCase())).limit(1);
        if (referrer && referrer.id !== userId) {
          referrerId = referrer.id;
          affiliate = money(gross * TRADE_MARKET.AFFILIATE_SHARE_RATE);
        }
      }
      amount = money(gross - affiliate);
      // totalBotEarnings contains profit only, so a 100% profit cap on $99 is
      // $99 of earnings—not $198. Daily rates and plan durations are unchanged.
      const target = Number(wallet.lockedPrincipal) * config.profitCapPct;
      const remaining = Math.max(0, target - Number(wallet.totalBotEarnings));
      if (Number(wallet.lockedPrincipal) > 0 && Number(wallet.totalBotEarnings) >= target) {
        amount = 0;
        affiliate = 0;
        referrerId = undefined;
        capped = true;
      } else if (amount > remaining) {
        amount = money(remaining); capped = true;
      }
    }

    await tx.insert(tradeTransactions).values({
      userId, type: "bot_earning", walletType: null, amountUsd: amount.toFixed(6),
      feeUsd: "0.000000", reserveFundDeduction: "0.000000",
      affiliateShareDeduction: affiliate.toFixed(6), netAmount: amount.toFixed(6),
      txHash: sessionHash, status: "completed",
      note: `Bot session day ${cycleDay}/${planDays}${isLossDay ? " (loss)" : ""}: ${elapsedHours}h`,
    });
    if (referrerId && affiliate > 0) {
      await tx.insert(tradeWallets).values({ userId: referrerId, tradeBalance: "0.000000" }).onConflictDoNothing();
      await tx.update(tradeWallets).set({
        referralCommissionBalance: sql`${tradeWallets.referralCommissionBalance} + ${affiliate.toFixed(6)}::decimal`,
        updatedAt: now,
      }).where(eq(tradeWallets.userId, referrerId));
      await tx.insert(tradeTransactions).values({
        userId: referrerId, type: "bot_earning", walletType: null, amountUsd: affiliate.toFixed(6),
        feeUsd: "0.000000", reserveFundDeduction: "0.000000", affiliateShareDeduction: "0.000000",
        netAmount: affiliate.toFixed(6), txHash: `${sessionHash}-REFERRAL`, status: "completed",
        note: `Referral commission for bot session ${sessionHash}`,
      });
      await tx.insert(notifications).values({
        userId: referrerId,
        financialEventKey: `${sessionHash}-REFERRAL`,
        type: "referral",
        title: "Trade Referral Commission",
        message: `${referredUserName} earned with the trading bot. $${affiliate.toFixed(6)} was added to your referral commission balance.`,
        data: { sourceUserId: userId, sessionHash, amount: affiliate.toFixed(6) },
        isRead: false,
      });
    }

    const nextBalance = money(Math.max(0, balance + amount));
    // Existing cap/UI semantics are cumulative positive bot earnings. Losses
    // reduce trade balance but do not reduce the earnings-cap accumulator.
    const nextEarnings = money(Number(wallet.totalBotEarnings) + Math.max(0, amount));
    const nextDay = (wallet.tradingDayNumber ?? 0) + 1;
    const cycleComplete = nextDay >= planDays;
    let payout = 0;
    // A normal completed cycle returns the full remaining balance: original
    // principal plus retained profit. Paying profit only would burn principal
    // when the Trade wallet is zeroed below.
    if (cycleComplete) payout = money(nextBalance);
    if (payout > 0) {
      await tx.insert(wallets).values({ userId, balance: "0.00" }).onConflictDoNothing();
      const [swiftWallet] = await tx.select({ id: wallets.id }).from(wallets)
        .where(eq(wallets.userId, userId)).for("update");
      if (!swiftWallet) throw new Error("Unable to prepare SwiftWallet for cycle settlement");
      const [credited] = await tx.update(wallets)
        .set({ balance: sql`${wallets.balance} + ${payout.toFixed(6)}::decimal` })
        .where(eq(wallets.userId, userId))
        .returning({ balance: wallets.balance });
      if (!credited) throw new Error("Unable to credit completed cycle to SwiftWallet");
      await tx.insert(transactions).values({
        userId, type: "admin_credit", amount: payout.toFixed(2), fee: "0.00",
        paymentMethod: "system",
        description: `${planDays}-day trade cycle settlement — principal and earnings returned to SwiftWallet`,
      });
    }
    const [updated] = await tx.update(tradeWallets).set(cycleComplete ? {
      tradeBalance: "0.000000", lockedPrincipal: "0.000000", totalBotEarnings: nextEarnings.toFixed(6),
      tradingDayNumber: nextDay, roiComplete: true, botActivatedAt: null, updatedAt: now,
    } : {
      tradeBalance: nextBalance.toFixed(6), totalBotEarnings: nextEarnings.toFixed(6),
      tradingDayNumber: nextDay, botActivatedAt: null, updatedAt: now,
    }).where(eq(tradeWallets.userId, userId)).returning();
    await tx.insert(notifications).values({
      userId, type: "system", title: isLossDay ? "Bot Session — Market Loss" : "Bot Session Complete — Earnings Credited",
      message: `Day ${cycleDay}/${planDays}: ${amount.toFixed(6)} settled.`,
      data: { cycleDay, sessionHash, cycleComplete }, isRead: false,
    });
    return {
      completed: true, earning: amount.toFixed(6), elapsedHours, ratePercent: (rate * 100).toFixed(4),
      newBalance: updated.tradeBalance, totalBotEarnings: updated.totalBotEarnings,
      isLossDay, cycleDay, cycleDays: planDays, cycleComplete, capped,
    };
  });
}

/**
 * Request-time server recovery for sessions whose browser timer disappeared.
 * The atomic completion function re-checks and owns the marker under lock.
 */
export async function settleOverdueTradeBotSession(
  userId: number,
  now = new Date(),
): Promise<BotCompletionResult> {
  const [wallet] = await db.select({ botActivatedAt: tradeWallets.botActivatedAt })
    .from(tradeWallets)
    .where(eq(tradeWallets.userId, userId))
    .limit(1);
  if (!wallet?.botActivatedAt) return { completed: false };
  const ageMs = now.getTime() - new Date(wallet.botActivatedAt).getTime();
  if (ageMs < 12 * 60 * 60 * 1000) return { completed: false };
  return completeTradeBotSessionAtomic(userId, now);
}

const USER_TWO_DUPLICATE_SESSION_IDS = [
  3836, 3840, 3843, 3849, 3852, 3854, 3857,
  3859, 3862, 3877, 3878, 3879, 3880, 3899,
] as const;

/**
 * One-time production reconciliation for the Aug 31 session that legacy
 * completion requests applied fourteen extra times. Original ledger rows are
 * retained and marked failed; an immutable financial event records the exact
 * before/after correction. The event key makes startup retries harmless.
 */
export async function reconcileKnownDuplicateTradeSession(): Promise<boolean> {
  const userId = 2;
  const eventKey = "trade-session-reconciliation:user-2:2026-08-31T12:10:45.270Z";
  const preflight = await db.execute(sql`
    SELECT COUNT(*)::int AS source_rows
    FROM trade_transactions
    WHERE user_id = ${userId}
      AND id IN (3836,3840,3843,3849,3852,3854,3857,3859,3862,3877,3878,3879,3880,3899)
      AND status = 'completed'
  `);
  const sourceRows = Number((preflight.rows[0] as any)?.source_rows ?? 0);
  if (sourceRows === 0) return false;
  if (sourceRows !== USER_TWO_DUPLICATE_SESSION_IDS.length) {
    throw new Error("Trade reconciliation found only part of the audited duplicate set");
  }
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${userId})`);
    const [event] = await tx.insert(financialEvents).values({
      eventKey,
      userId,
      eventType: "trade_session_reconciliation",
      payload: { status: "started" },
    }).onConflictDoNothing().returning({ id: financialEvents.id });
    if (!event) return false;

    const [wallet] = await tx.select().from(tradeWallets)
      .where(eq(tradeWallets.userId, userId))
      .for("update");
    if (!wallet) throw new Error("Trade reconciliation wallet is missing");
    const [canonical] = await tx.select({
      id: tradeTransactions.id,
      amountUsd: tradeTransactions.amountUsd,
      status: tradeTransactions.status,
      note: tradeTransactions.note,
      txHash: tradeTransactions.txHash,
    }).from(tradeTransactions)
      .where(and(
        eq(tradeTransactions.id, 3833),
        eq(tradeTransactions.userId, userId),
      ))
      .for("update");
    if (
      !canonical
      || canonical.status !== "completed"
      || Number(canonical.amountUsd) !== -1.175501
      || canonical.txHash !== null
      || !canonical.note?.startsWith("Bot session day 84/120 (loss)")
    ) {
      throw new Error("Trade reconciliation canonical session check failed");
    }
    if (
      Number(wallet.tradeBalance) !== 164.942945
      || Number(wallet.lockedPrincipal) !== 99
      || Number(wallet.totalBotEarnings) !== 173.248741
      || wallet.tradingDayNumber !== 98
      || wallet.tradingPlanDays !== 120
      || wallet.botActivatedAt !== null
      || wallet.roiComplete
      || wallet.earlyExitCompleted
    ) {
      throw new Error("Trade reconciliation wallet baseline changed; manual review required");
    }

    const duplicateRows = await tx.execute(sql`
      SELECT id, amount_usd::numeric AS amount
      FROM trade_transactions
      WHERE user_id = ${userId}
        AND id IN (3836,3840,3843,3849,3852,3854,3857,3859,3862,3877,3878,3879,3880,3899)
        AND status = 'completed'
      ORDER BY id
      FOR UPDATE
    `);
    if (duplicateRows.rows.length !== USER_TWO_DUPLICATE_SESSION_IDS.length) {
      throw new Error("Trade reconciliation source rows do not match the audited duplicate set");
    }
    const ids = duplicateRows.rows.map((row: any) => Number(row.id));
    if (!USER_TWO_DUPLICATE_SESSION_IDS.every((id, index) => ids[index] === id)) {
      throw new Error("Trade reconciliation source identity check failed");
    }
    const balanceOverstatement = money(duplicateRows.rows.reduce(
      (sum, row: any) => sum + Number(row.amount),
      0,
    ));
    const earningsOverstatement = money(duplicateRows.rows.reduce(
      (sum, row: any) => sum + Math.max(0, Number(row.amount)),
      0,
    ));
    if (balanceOverstatement !== 31.775497 || earningsOverstatement !== 35.457652) {
      throw new Error("Trade reconciliation source amounts changed");
    }

    const before = {
      tradeBalance: Number(wallet.tradeBalance),
      totalBotEarnings: Number(wallet.totalBotEarnings),
      tradingDayNumber: wallet.tradingDayNumber,
    };
    const correctedBalance = money(Math.max(
      Number(wallet.lockedPrincipal),
      before.tradeBalance - balanceOverstatement,
    ));
    const plan = PLANS[wallet.tradingPlanDays] ?? PLANS[120];
    const profitCap = money(Number(wallet.lockedPrincipal) * plan.profitCapPct);
    const correctedEarnings = money(Math.min(
      Math.max(0, before.totalBotEarnings - earningsOverstatement),
      profitCap,
    ));
    const correctedDay = Math.max(0, before.tradingDayNumber - USER_TWO_DUPLICATE_SESSION_IDS.length);

    await tx.execute(sql`
      UPDATE trade_transactions
      SET status = 'failed',
          note = CONCAT(COALESCE(note, ''), ' [reversed: duplicate completion of Aug 31 session]')
      WHERE user_id = ${userId}
        AND id IN (3836,3840,3843,3849,3852,3854,3857,3859,3862,3877,3878,3879,3880,3899)
    `);
    await tx.update(tradeWallets).set({
      tradeBalance: correctedBalance.toFixed(6),
      totalBotEarnings: correctedEarnings.toFixed(6),
      tradingDayNumber: correctedDay,
      botActivatedAt: null,
      updatedAt: new Date(),
    }).where(eq(tradeWallets.userId, userId));

    const after = {
      tradeBalance: correctedBalance,
      totalBotEarnings: correctedEarnings,
      tradingDayNumber: correctedDay,
    };
    await tx.update(financialEvents).set({
      payload: {
        reason: "One persisted bot activation was settled fifteen times by legacy concurrent requests",
        canonicalTransactionId: 3833,
        reversedTransactionIds: [...USER_TWO_DUPLICATE_SESSION_IDS],
        balanceOverstatement,
        earningsOverstatement,
        before,
        after,
      },
    }).where(eq(financialEvents.id, event.id));
    await tx.insert(notifications).values({
      userId,
      financialEventKey: eventKey,
      type: "system",
      title: "Trade Wallet Reconciled",
      message: "Duplicate bot-session settlements were removed. Your principal was preserved and your Trade Wallet totals were corrected.",
      data: { eventKey, before, after },
      isRead: false,
    });
    return true;
  });
}

/** Read-only audit.  Legacy rows have no session key, so reversing them would
 * be guesswork and is deliberately not attempted. */
export async function analyzeTradeBotSessionReconciliation(userId?: number) {
  const keyedUserFilter = userId ? sql`AND t.user_id = ${userId}` : sql``;
  const walletsResult = await db.execute(sql`
    WITH keyed AS (
      SELECT t.user_id, t.tx_hash, COUNT(*) AS copies,
        SUM(GREATEST(t.net_amount::numeric, 0)) AS earnings
      FROM trade_transactions t
      JOIN trade_wallets w ON w.user_id = t.user_id
      WHERE t.type = 'bot_earning'
        AND t.tx_hash LIKE 'BOT-SESSION-%'
        AND t.tx_hash NOT LIKE '%-REFERRAL'
        AND t.created_at >= COALESCE(w.cycle_started_at, '1970-01-01'::timestamp)
        ${keyedUserFilter}
      GROUP BY t.user_id, t.tx_hash
    ), ledger AS (
      SELECT user_id, COUNT(*)::int AS keyed_sessions,
        COALESCE(SUM(earnings) FILTER (WHERE copies = 1), 0) AS keyed_earnings
      FROM keyed GROUP BY user_id
    )
    SELECT w.user_id, w.total_bot_earnings,
      COALESCE(l.keyed_sessions, 0) AS keyed_sessions,
      COALESCE(l.keyed_earnings, 0) AS keyed_session_earnings,
      CASE WHEN COALESCE(l.keyed_sessions, 0) = 0 THEN NULL
        ELSE l.keyed_earnings <> w.total_bot_earnings::numeric
      END AS keyed_earnings_mismatch
    FROM trade_wallets w LEFT JOIN ledger l ON l.user_id = w.user_id
    ${userId ? sql`WHERE w.user_id = ${userId}` : sql``}
  `);
  const duplicatesResult = await db.execute(sql`
    SELECT user_id, tx_hash, COUNT(*)::int AS copies, SUM(amount_usd::numeric) AS total_amount
    FROM trade_transactions
    WHERE type = 'bot_earning'
      AND tx_hash LIKE 'BOT-SESSION-%'
      AND tx_hash NOT LIKE '%-REFERRAL'
      ${userId ? sql`AND user_id = ${userId}` : sql``}
    GROUP BY user_id, tx_hash HAVING COUNT(*) > 1
  `);
  return { wallets: walletsResult.rows, duplicateSessionIdentities: duplicatesResult.rows };
}