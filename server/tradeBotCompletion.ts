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
    const [account] = await tx.select({ accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (wallet.botLocked || account?.accountStatus === "suspended") {
      return { completed: false };
    }

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

const DUPLICATE_BURST_REVIEW_CASES = [
  { userId: 1, rows: 15, firstDay: 1, lastDay: 15, fingerprint: "38e236cb866e08e14384c85732041d06", canonicalId: 3723, expectedHashOwnerId: null, expectedBalance: 684.174351, correctedEarnings: 26.314351, lienIncrease: 0, sessionAt: "2026-08-31T12:00:35.843Z", cycleStartedAt: "2026-08-29T23:38:17.735Z", baseline: [780.446375, 774.25, 181.111978, 6, 60, false, false, 0] },
  { userId: 2, rows: 15, firstDay: 84, lastDay: 98, fingerprint: "17fb86920cf63ad1fc59bba7ebf81d69", canonicalId: 3833, expectedHashOwnerId: 3899, expectedBalance: 133.164499, correctedEarnings: 99, lienIncrease: 0, sessionAt: "2026-08-31T12:10:45.270Z", cycleStartedAt: "2026-04-22T12:07:42.418Z", baseline: [124.942945, 99, 134.248741, 82, 120, false, false, 0] },
  { userId: 60, rows: 11, firstDay: 19, lastDay: 29, fingerprint: "553e1f3aeba0860eaf9aa9aed793c280", canonicalId: 3695, expectedHashOwnerId: null, expectedBalance: 106.079961, correctedEarnings: 18.472889, lienIncrease: 0, sessionAt: "2026-08-31T12:03:58.152Z", cycleStartedAt: "2026-08-04T08:49:19.416Z", baseline: [114.598962, 93.75, 35.672634, 29, 120, false, false, 0] },
  { userId: 649, rows: 52, firstDay: 30, lastDay: 81, fingerprint: "eddf1e3733a5e58edcc448557231c837", canonicalId: 3741, expectedHashOwnerId: null, expectedBalance: 71.832059, correctedEarnings: 34.083558, lienIncrease: 0, sessionAt: "2026-08-31T12:02:54.913Z", cycleStartedAt: "2026-07-22T09:17:16.710Z", baseline: [78.717896, 63.8115, 75.8607, 31, 90, false, true, 0] },
  { userId: 741, rows: 69, firstDay: 10, lastDay: 78, fingerprint: "ec6cb1ca5b76f94f7c6e59141eac2522", canonicalId: 3706, expectedHashOwnerId: null, expectedBalance: 71.911693, correctedEarnings: 24.430774, lienIncrease: 74.67, sessionAt: "2026-08-31T12:21:22.067Z", cycleStartedAt: "2026-08-18T19:49:13.468Z", baseline: [154.13014, 146.585, 44.563183, 11, 90, false, false, 47.04] },
] as const;

/**
 * Reconciles the proven Sep 1 legacy completion bursts. Duplicate value is
 * recovered only from Trade balance above locked principal. A lien is added
 * only for an independently proven outflow that cannot be recovered without
 * reducing principal.
 */
export async function reconcileDuplicateBurstAccounts(): Promise<number> {
  let reconciled = 0;
  for (const reviewCase of DUPLICATE_BURST_REVIEW_CASES) {
    const changed = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${reviewCase.userId})`);
      const [user] = await tx.select().from(users)
        .where(eq(users.id, reviewCase.userId))
        .for("update");
      const [wallet] = await tx.select().from(tradeWallets)
        .where(eq(tradeWallets.userId, reviewCase.userId))
        .for("update");
      const [swiftWallet] = await tx.select().from(wallets)
        .where(eq(wallets.userId, reviewCase.userId))
        .for("update");
      if (!user || user.role === "admin" || !wallet) {
        throw new Error(`Trade reconciliation identity check failed for user ${reviewCase.userId}`);
      }
      const eventKey = `trade-duplicate-burst-reconciliation:2026-09-01:user-${reviewCase.userId}`;
      const [existingEvent] = await tx.select({ id: financialEvents.id }).from(financialEvents)
        .where(eq(financialEvents.eventKey, eventKey))
        .limit(1);
      if (existingEvent) return false;
      const targetHash = `BOT-SESSION-${reviewCase.userId}-${reviewCase.sessionAt}`;
      const hashOwners = await tx.select({
        id: tradeTransactions.id,
        status: tradeTransactions.status,
      }).from(tradeTransactions)
        .where(and(
          eq(tradeTransactions.userId, reviewCase.userId),
          eq(tradeTransactions.txHash, targetHash),
        ))
        .for("update");
      const hashOwner = hashOwners[0] ?? null;
      if (
        hashOwners.length > 1
        || (reviewCase.expectedHashOwnerId === null && hashOwner !== null)
        || (reviewCase.expectedHashOwnerId !== null && (
          hashOwner?.id !== reviewCase.expectedHashOwnerId
          || hashOwner.status !== "completed"
        ))
      ) {
        console.warn(`[TRADE-RECONCILIATION] Session hash ownership changed for user ${reviewCase.userId}; skipped for manual review.`);
        return false;
      }
      const [canonical] = await tx.select({
        id: tradeTransactions.id,
        txHash: tradeTransactions.txHash,
      }).from(tradeTransactions)
        .where(and(
          eq(tradeTransactions.id, reviewCase.canonicalId),
          eq(tradeTransactions.userId, reviewCase.userId),
        ))
        .for("update");
      if (!canonical || canonical.txHash !== null) {
        console.warn(`[TRADE-RECONCILIATION] Canonical transaction changed for user ${reviewCase.userId}; skipped for manual review.`);
        return false;
      }

      const evidence = await tx.execute(sql`
        SELECT COUNT(*)::int AS rows,
          MIN((regexp_match(note, 'day ([0-9]+)/'))[1]::int) AS first_day,
          MAX((regexp_match(note, 'day ([0-9]+)/'))[1]::int) AS last_day,
          MIN(id)::int AS first_transaction_id,
          MAX(id)::int AS last_transaction_id,
          MIN(created_at) AS first_at,
          MAX(created_at) AS last_at,
          md5(string_agg(id::text || ':' || amount_usd::text || ':' || created_at::text || ':' || COALESCE(note, ''), '|' ORDER BY id)) AS fingerprint
        FROM trade_transactions
        WHERE user_id = ${reviewCase.userId}
          AND type = 'bot_earning'
          AND status = 'completed'
          AND note LIKE 'Bot session day %'
          AND created_at >= '2026-09-01 00:00:00'::timestamp
          AND created_at < '2026-09-02 00:00:00'::timestamp
      `);
      const proof = evidence.rows[0] as any;
      if (
        Number(proof?.rows) !== reviewCase.rows
        || Number(proof?.first_day) !== reviewCase.firstDay
        || Number(proof?.last_day) !== reviewCase.lastDay
        || Number(proof?.first_transaction_id) !== reviewCase.canonicalId
        || proof?.fingerprint !== reviewCase.fingerprint
      ) {
        console.warn(`[TRADE-RECONCILIATION] Evidence changed for user ${reviewCase.userId}; skipped for manual review.`);
        return false;
      }

      const [expectedBalance, expectedPrincipal, expectedEarnings, expectedDay, expectedPlan, expectedRoi, expectedExit, expectedLien] = reviewCase.baseline;
      const currentSession = wallet.botActivatedAt?.toISOString() ?? null;
      const expectedSession = reviewCase.userId === 2 ? null : reviewCase.sessionAt;
      if (
        Number(wallet.tradeBalance) !== expectedBalance
        || Number(wallet.lockedPrincipal) !== expectedPrincipal
        || Number(wallet.totalBotEarnings) !== expectedEarnings
        || wallet.tradingDayNumber !== expectedDay
        || wallet.tradingPlanDays !== expectedPlan
        || wallet.roiComplete !== expectedRoi
        || wallet.earlyExitCompleted !== expectedExit
        || Number(swiftWallet?.lienAmount ?? 0) !== expectedLien
        || wallet.cycleStartedAt?.toISOString() !== reviewCase.cycleStartedAt
        || currentSession !== expectedSession
        || wallet.botLocked
        || user.accountStatus !== "active"
      ) {
        console.warn(`[TRADE-RECONCILIATION] Wallet lifecycle changed for user ${reviewCase.userId}; skipped for manual review.`);
        return false;
      }
      if (reviewCase.userId === 741) {
        const [withdrawal] = await tx.select().from(tradeTransactions)
          .where(and(
            eq(tradeTransactions.id, 3841),
            eq(tradeTransactions.userId, 741),
          ))
          .for("update");
        if (
          !withdrawal
          || withdrawal.type !== "withdraw_exchange"
          || withdrawal.status !== "completed"
          || Number(withdrawal.amountUsd) !== 79
          || Number(withdrawal.netAmount) !== 79
          || withdrawal.createdAt.toISOString() !== "2026-09-01T01:03:34.104Z"
        ) {
          console.warn("[TRADE-RECONCILIATION] User 741 withdrawal proof changed; skipped for manual review.");
          return false;
        }
      }
      const before = {
        accountStatus: user.accountStatus,
        botLocked: wallet.botLocked,
        botActivatedAt: wallet.botActivatedAt,
        tradeBalance: Number(wallet.tradeBalance),
        lockedPrincipal: Number(wallet.lockedPrincipal),
        totalBotEarnings: Number(wallet.totalBotEarnings),
        tradingDayNumber: wallet.tradingDayNumber,
        lienAmount: Number(swiftWallet?.lienAmount ?? 0),
      };
      const [event] = await tx.insert(financialEvents).values({
        eventKey,
        userId: reviewCase.userId,
        eventType: "trade_duplicate_burst_reconciliation",
        payload: {
          reason: "Multiple bot settlements were recorded within one legacy session window",
          action: "Proven duplicates reversed; principal preserved; proven unrecovered outflow placed under lien",
          evidence: proof,
          before,
        },
      }).onConflictDoNothing().returning({ id: financialEvents.id });
      if (!event) return false;

      const canonicalId = reviewCase.canonicalId;
      await tx.execute(sql`
        UPDATE trade_transactions
        SET status = 'failed',
          tx_hash = CONCAT('REVERSED-DUPLICATE-', id::text),
          note = CONCAT(COALESCE(note, ''), ' [reversed: duplicate settlement from Sep 1 legacy burst]')
        WHERE user_id = ${reviewCase.userId}
          AND type = 'bot_earning'
          AND status = 'completed'
          AND note LIKE 'Bot session day %'
          AND created_at >= '2026-09-01 00:00:00'::timestamp
          AND created_at < '2026-09-02 00:00:00'::timestamp
          AND id <> ${canonicalId}
      `);
      await tx.update(tradeTransactions).set({
        txHash: targetHash,
      }).where(and(
        eq(tradeTransactions.id, canonicalId),
        eq(tradeTransactions.userId, reviewCase.userId),
      ));

      const protectedTarget = Math.max(Number(wallet.lockedPrincipal), reviewCase.expectedBalance);
      const correctedBalance = money(Math.min(Number(wallet.tradeBalance), protectedTarget));
      const correctedDay = Math.min(wallet.tradingDayNumber, reviewCase.firstDay);
      await tx.update(tradeWallets).set({
        tradeBalance: correctedBalance.toFixed(6),
        totalBotEarnings: reviewCase.correctedEarnings.toFixed(6),
        tradingDayNumber: correctedDay,
        botActivatedAt: null,
        botLocked: false,
        updatedAt: new Date(),
      }).where(eq(tradeWallets.userId, reviewCase.userId));
      let resultingLien = before.lienAmount;
      if (reviewCase.lienIncrease > 0) {
        if (!swiftWallet) throw new Error(`Trade reconciliation wallet lien target missing for user ${reviewCase.userId}`);
        resultingLien = money(before.lienAmount + reviewCase.lienIncrease);
        await tx.update(wallets).set({
          lienAmount: resultingLien.toFixed(2),
          lienReason: "Unrecovered proceeds from duplicate Trade bot settlements",
          lienPlacedAt: new Date(),
        }).where(eq(wallets.userId, reviewCase.userId));
      }
      const after = {
        tradeBalance: correctedBalance,
        lockedPrincipal: before.lockedPrincipal,
        totalBotEarnings: reviewCase.correctedEarnings,
        tradingDayNumber: correctedDay,
        botActivatedAt: null,
        botLocked: false,
        lienAmount: resultingLien,
      };
      await tx.update(financialEvents).set({
        payload: {
          reason: "Multiple bot settlements were recorded within one legacy session window",
          canonicalTransactionId: canonicalId,
          duplicateCount: reviewCase.rows - 1,
          expectedBalanceAfterCanonicalActions: reviewCase.expectedBalance,
          recoveryPolicy: "Preserve locked principal and lien only proven unrecovered outflow",
          lienIncrease: reviewCase.lienIncrease,
          evidence: proof,
          before,
          after,
        },
      }).where(eq(financialEvents.id, event.id));
      await tx.insert(notifications).values({
        userId: reviewCase.userId,
        financialEventKey: eventKey,
        type: "system",
        title: "Trade Wallet Reconciled",
        message: reviewCase.lienIncrease > 0
          ? "Duplicate bot settlements were corrected without reducing your locked principal. Funds already withdrawn are held as an account lien pending recovery."
          : "Duplicate bot settlements were corrected and your locked principal was preserved.",
        data: { eventKey, reason: "duplicate_trade_session_reconciliation", after },
        isRead: false,
      });
      return true;
    });
    if (changed) reconciled += 1;
  }
  return reconciled;
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