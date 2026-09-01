import { count, eq, sql } from "drizzle-orm";
import {
  affiliateTradeShares,
  tradeTransactions,
  tradeWallets,
  transactions,
  users,
  manualTrades,
  signalTrades,
  walletCreditClaims,
  walletDeposits,
  wallets,
} from "@shared/schema";
import { db } from "./db";
import { settleOverdueTradeBotSession } from "./tradeBotCompletion";
import { ADMIN_EMAIL } from "./email";
import {
  enqueueFinancialEventInTransaction,
  type EnqueueFinancialEventInput,
} from "./financialNotifications";
import { acquireWalletUserLock } from "./walletBalance";
import {
  formatTradeMoneyMicros,
  getTradeEarlyExitQuote,
  parseTradeMoneyMicros,
} from "@shared/tradeWithdrawalPolicy";

export type TradeDepositTarget =
  | "squad_trade"
  | "korapay_trade"
  | "trade_trc20"
  | "trade_bep20";

export class CryptoDepositIntentConflictError extends Error {
  constructor() {
    super("This blockchain transaction has already been submitted");
    this.name = "CryptoDepositIntentConflictError";
  }
}

export class TradeTopUpLimitError extends Error {
  constructor() {
    super("Top-up limit reached for this Trade Market cycle");
    this.name = "TradeTopUpLimitError";
  }
}

async function assertTradeTopUpCapacity(tx: any, userId: number, cycleStartedAt: Date | null) {
  const capacity = await tx.execute(sql`
    SELECT
      (
        SELECT COUNT(*)::int FROM trade_transactions
        WHERE user_id = ${userId} AND type = 'topup' AND status = 'completed'
          AND created_at >= COALESCE(${cycleStartedAt}, '1970-01-01'::timestamptz)
      ) +
      (
        SELECT COUNT(*)::int FROM wallet_deposits
        WHERE user_id = ${userId}
          AND wallet_type IN ('trade_trc20', 'trade_bep20', 'squad_trade', 'korapay_trade')
          AND status IN ('pending', 'confirmed')
          AND metadata->>'topUpReservation' = 'true'
          AND created_at >= COALESCE(${cycleStartedAt}, '1970-01-01'::timestamptz)
      ) AS used
  `);
  if (Number(capacity.rows?.[0]?.used ?? 0) >= 3) throw new TradeTopUpLimitError();
}

export async function createTradeDepositIntentAtomic(input: {
  userId: number;
  amount: number;
  target: TradeDepositTarget;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-deposit"}), ${input.userId})`);
    const [existing] = await tx.select().from(walletDeposits)
      .where(sql`${walletDeposits.txHash} = ${input.reference}`)
      .limit(1);
    if (existing) {
      if (
        existing.userId === input.userId
        && existing.walletType === input.target
        && Number(existing.amountUsd) === Number(input.amount.toFixed(2))
        && existing.status === "pending"
      ) return existing;
      throw new Error("Trade Market payment reference already exists");
    }
    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [wallet] = await tx.select().from(tradeWallets).where(eq(tradeWallets.userId, input.userId)).for("update");
    if (!wallet) throw new Error("Unable to prepare Trade Market wallet");
    const isTopUp = !wallet.roiComplete && (wallet.lossDayNumbers?.length ?? 0) > 0;
    if (isTopUp) await assertTradeTopUpCapacity(tx, input.userId, wallet.cycleStartedAt);
    const [deposit] = await tx.insert(walletDeposits).values({
      userId: input.userId,
      amountUsd: input.amount.toFixed(2),
      txHash: input.reference,
      walletType: input.target,
      status: "pending",
      metadata: { ...input.metadata, topUpReservation: isTopUp },
    }).returning();
    if (!deposit) throw new Error("Unable to create Trade Market payment intent");
    return deposit;
  });
}

export async function cancelTradeDepositIntentAtomic(depositId: number, reason: string) {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(walletDeposits).where(eq(walletDeposits.id, depositId)).for("update");
    if (!deposit || deposit.status !== "pending") return false;
    await tx.update(walletDeposits).set({
      status: "cancelled",
      failureReason: reason,
      updatedAt: new Date(),
    }).where(eq(walletDeposits.id, depositId));
    return true;
  });
}

export async function recordDepositOutcomeAtomic(input: {
  depositId: number;
  userId: number;
  status: "rejected" | "expired_unverified" | "manual_review";
  reason: string;
  event: EnqueueFinancialEventInput;
}) {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(walletDeposits).where(eq(walletDeposits.id, input.depositId)).for("update");
    if (!deposit || deposit.userId !== input.userId) throw new Error("Deposit outcome owner mismatch");
    if (![input.status, "pending", "confirmed"].includes(deposit.status)) return false;
    if (deposit.status !== input.status) {
      await tx.update(walletDeposits).set({
        status: input.status,
        failureReason: input.reason,
        updatedAt: new Date(),
      }).where(eq(walletDeposits.id, input.depositId));
    }
    await enqueueFinancialEventInTransaction(tx as any, input.event);
    return true;
  });
}

export async function createCryptoDepositIntentAtomic(input: {
  userId: number;
  amount: number;
  target: "trc20" | "bep20" | "trade_trc20" | "trade_bep20";
  reference: string;
  metadata?: Record<string, unknown>;
  destination: "TSIA SwiftWallet" | "Trade Market Wallet";
}) {
  const reference = input.reference.trim();
  const normalizedReference = reference.toLowerCase();
  const isTrade = input.target.startsWith("trade_");
  const network = input.target.includes("bep20") ? "BEP20" : "TRC20";
  return db.transaction(async (tx) => {
    if (isTrade) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-deposit"}), ${input.userId})`);
    }
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtext(${"crypto-deposit-intent"}),
        hashtext(${normalizedReference})
      )
    `);
    const [existing] = await tx.select().from(walletDeposits)
      .where(sql`LOWER(TRIM(${walletDeposits.txHash})) = ${normalizedReference}`)
      .limit(1);
    let deposit = existing;
    if (existing) {
      const isSamePendingIntent =
        existing.userId === input.userId
        && existing.walletType === input.target
        && Number(existing.amountUsd) === Number(input.amount.toFixed(2))
        && existing.status === "pending";
      if (!isSamePendingIntent) throw new CryptoDepositIntentConflictError();
    } else {
      let metadata = input.metadata;
      if (isTrade) {
        await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
        const [wallet] = await tx.select().from(tradeWallets).where(eq(tradeWallets.userId, input.userId)).for("update");
        if (!wallet) throw new Error("Unable to prepare Trade Market wallet");
        const isTopUp = !wallet.roiComplete && (wallet.lossDayNumbers?.length ?? 0) > 0;
        if (isTopUp) {
          const capacity = await tx.execute(sql`
            SELECT
              (
                SELECT COUNT(*)::int
                FROM trade_transactions
                WHERE user_id = ${input.userId}
                  AND type = 'topup'
                  AND status = 'completed'
                  AND created_at >= COALESCE(${wallet.cycleStartedAt}, '1970-01-01'::timestamptz)
              ) +
              (
                SELECT COUNT(*)::int
                FROM wallet_deposits
                WHERE user_id = ${input.userId}
                  AND wallet_type IN ('trade_trc20', 'trade_bep20', 'squad_trade', 'korapay_trade')
                  AND status IN ('pending', 'confirmed')
                  AND metadata->>'topUpReservation' = 'true'
                  AND created_at >= COALESCE(${wallet.cycleStartedAt}, '1970-01-01'::timestamptz)
              ) AS used
          `);
          if (Number(capacity.rows?.[0]?.used ?? 0) >= 3) throw new TradeTopUpLimitError();
        }
        metadata = { ...input.metadata, topUpReservation: isTopUp };
      }
      [deposit] = await tx.insert(walletDeposits).values({
        userId: input.userId,
        amountUsd: input.amount.toFixed(2),
        txHash: reference,
        walletType: input.target,
        status: "pending",
        metadata,
      }).returning();
    }
    if (!deposit) throw new Error("Unable to create crypto deposit intent");
    const [user] = await tx.select({ email: users.email, firstName: users.firstName })
      .from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Deposit user not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `crypto-intent:${normalizedReference}:submitted`,
      userId: input.userId,
      eventType: isTrade ? "trade_deposit_submitted" : "crypto_deposit_submitted",
      payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        adminEmail: ADMIN_EMAIL,
        receipt: {
          title: isTrade ? "Trade Crypto Deposit Submitted" : "Crypto Deposit Submitted",
          status: "pending",
          amount: `$${input.amount.toFixed(2)}`,
          reference,
          rows: [
            { label: "Destination", value: input.destination },
            { label: "Network", value: network },
            { label: "Status", value: "Awaiting on-chain verification", color: "gold" },
          ],
          footerNote: "No wallet funds have been credited yet.",
        },
        inApp: {
          title: "Crypto Deposit Submitted",
          message: "Your transaction is awaiting authoritative on-chain verification. No funds have been credited yet.",
          data: { depositId: deposit.id, txHash: reference, walletType: input.target },
        },
      },
    });
    return deposit;
  });
}

function lossDaysForPlan(planDays: number): number[] {
  const days: number[] = [];
  const weeks = Math.floor(planDays / 5);
  for (let week = 0; week < weeks; week++) {
    const pool = Array.from({ length: 5 }, (_, index) => week * 5 + index + 1);
    for (let index = pool.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[other]] = [pool[other], pool[index]];
    }
    days.push(...pool.slice(0, 2));
  }
  return days.sort((a, b) => a - b);
}

async function requireVerifiedIdentity(tx: any, userId: number) {
  const result = await tx.execute(sql`
    SELECT 1 FROM identity_verifications
    WHERE user_id = ${userId}
      AND status = 'verified'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (document_expires_at IS NULL OR document_expires_at > NOW())
    LIMIT 1
  `);
  if (!result.rows?.length) {
    throw new Error("Completed identity verification is required before a Trade wallet can be credited");
  }
}

export function isTradeDepositTarget(value: string): value is TradeDepositTarget {
  return ["squad_trade", "korapay_trade", "trade_trc20", "trade_bep20"].includes(value);
}

export async function creditTradeDepositAtomic(input: {
  depositId: number;
  userId: number;
  gross: number;
  target: TradeDepositTarget;
  reference: string;
  planDays: number;
  finalStatus?: "completed" | "verified";
  providerRecoveryVerified?: boolean;
}) {
  if (!Number.isFinite(input.gross) || input.gross <= 0) throw new Error("Trade deposit amount must be positive");
  await settleOverdueTradeBotSession(input.userId);
  const planDays = [60, 90, 120].includes(input.planDays) ? input.planDays : 120;
  const affiliateCut = Number((input.gross * 0.05).toFixed(6));
  const userCredit = Number((input.gross - affiliateCut).toFixed(6));
  const lossDays = lossDaysForPlan(planDays);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${input.userId})`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-deposit"}), ${input.userId})`);
    await requireVerifiedIdentity(tx, input.userId);

    const [deposit] = await tx.select().from(walletDeposits)
      .where(eq(walletDeposits.id, input.depositId))
      .for("update");
    if (!deposit || deposit.userId !== input.userId || deposit.txHash !== input.reference || deposit.walletType !== input.target) {
      throw new Error("No matching Trade Market deposit intent exists");
    }
    if (["completed", "verified"].includes(deposit.status)) {
      return { credited: false, transactionId: undefined as number | undefined, topUp: false };
    }
    const recoveryEligible = input.providerRecoveryVerified
      && ["rejected", "manual_review"].includes(deposit.status);
    if (!["pending", "confirmed"].includes(deposit.status) && !recoveryEligible) {
      throw new Error("Trade Market deposit is not eligible for credit");
    }
    if (Number(deposit.amountUsd) !== Number(input.gross.toFixed(2))) {
      throw new Error("Settled amount does not match the Trade Market deposit intent");
    }

    const [claim] = await tx.insert(walletCreditClaims).values({
      provider: input.target.startsWith("trade_") ? "crypto" : input.target,
      reference: input.reference.trim().toLowerCase(),
      userId: input.userId,
      depositId: input.depositId,
    }).onConflictDoNothing().returning({ id: walletCreditClaims.id });
    if (!claim) {
      await tx.update(walletDeposits).set({ status: "duplicate", updatedAt: new Date() }).where(eq(walletDeposits.id, input.depositId));
      return { credited: false, transactionId: undefined as number | undefined, topUp: false };
    }

    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [wallet] = await tx.select().from(tradeWallets).where(eq(tradeWallets.userId, input.userId)).for("update");
    if (!wallet) throw new Error("Unable to prepare Trade Market wallet");
    if (wallet.botActivatedAt) {
      throw new Error("Trade Market funding is unavailable while a bot session is active");
    }
    const topUp = !wallet.roiComplete && (wallet.lossDayNumbers?.length ?? 0) > 0;
    const hasReservedTopUpSlot = (deposit.metadata as any)?.topUpReservation === true;
    if (topUp && !hasReservedTopUpSlot) {
      await assertTradeTopUpCapacity(tx, input.userId, wallet.cycleStartedAt);
    }
    const network = input.target === "trade_bep20" ? "bep20" : input.target === "trade_trc20" ? "trc20" : null;
    const [tradeTx] = await tx.insert(tradeTransactions).values({
      userId: input.userId,
      type: topUp ? "topup" : "deposit",
      walletType: network,
      amountUsd: input.gross.toFixed(6),
      feeUsd: "0.000000",
      reserveFundDeduction: "0.000000",
      affiliateShareDeduction: affiliateCut.toFixed(6),
      netAmount: userCredit.toFixed(6),
      txHash: input.reference,
      status: "completed",
      note: `Verified Trade deposit via ${input.target} — 5% affiliate pool, 95% credited`,
    }).returning({ id: tradeTransactions.id });

    const update: any = {
      tradeBalance: sql`${tradeWallets.tradeBalance} + ${userCredit.toFixed(6)}::decimal`,
      totalInvested: wallet.roiComplete ? userCredit.toFixed(6) : sql`${tradeWallets.totalInvested} + ${userCredit.toFixed(6)}::decimal`,
      lockedPrincipal: wallet.roiComplete ? userCredit.toFixed(6) : sql`${tradeWallets.lockedPrincipal} + ${userCredit.toFixed(6)}::decimal`,
      tradingPlanDays: planDays,
      cycleStartedAt: topUp ? (wallet.cycleStartedAt ?? new Date()) : new Date(),
      updatedAt: new Date(),
    };
    if (wallet.roiComplete || wallet.earlyExitCompleted) {
      Object.assign(update, {
        totalInvested: userCredit.toFixed(6),
        lockedPrincipal: userCredit.toFixed(6),
        roiComplete: false,
        earlyExitCompleted: false,
        totalBotEarnings: "0.000000",
        tradingDayNumber: 0,
        lossDayNumbers: lossDays,
        botActivatedAt: null,
      });
    } else if ((wallet.lossDayNumbers?.length ?? 0) === 0) {
      update.lossDayNumbers = lossDays;
    } else if ((wallet.tradingDayNumber ?? 0) > 0) {
      Object.assign(update, { tradingDayNumber: 0, lossDayNumbers: lossDays, totalBotEarnings: "0.000000", earlyExitCompleted: false, cycleStartedAt: new Date(), botActivatedAt: null });
    }
    await tx.update(tradeWallets).set(update).where(eq(tradeWallets.userId, input.userId));

    const [affiliateResult] = await tx.select({ total: count() }).from(users).where(eq(users.role, "affiliate"));
    const affiliateCount = Number(affiliateResult?.total ?? 0);
    await tx.insert(affiliateTradeShares).values({
      tradeTransactionId: tradeTx.id,
      totalPoolAmount: affiliateCut.toFixed(6),
      affiliateCount,
      perAffiliateAmount: (affiliateCount ? affiliateCut / affiliateCount : 0).toFixed(6),
      sourceType: "trade",
    });
    await tx.update(walletDeposits).set({
      status: input.finalStatus ?? "completed",
      verifiedAt: new Date(),
      failureReason: null,
      updatedAt: new Date(),
    }).where(eq(walletDeposits.id, input.depositId));

    const [user] = await tx.select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Trade deposit user not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `trade-deposit:${input.target}:${input.reference.trim().toLowerCase()}:credited`,
      userId: input.userId,
      eventType: "trade_deposit_credited",
      payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Trade Wallet Deposit Confirmed",
          status: "success",
          amount: `$${userCredit.toFixed(2)}`,
          amountLabel: `Net Trade Wallet credit from $${input.gross.toFixed(2)}`,
          reference: input.reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "Destination", value: "Trade Market Wallet" },
            { label: "Method", value: input.target.toUpperCase() },
            { label: "Affiliate pool", value: `$${affiliateCut.toFixed(2)}` },
            { label: "Status", value: "Verified and credited", color: "green" },
          ],
          footerNote: "Crypto deposits are credited only after authoritative on-chain verification.",
        },
        inApp: {
          title: "Trade Wallet Funded ✓",
          message: `$${userCredit.toFixed(2)} was verified and credited to your Trade Wallet.`,
          data: { depositId: input.depositId, transactionId: tradeTx.id, reference: input.reference },
        },
      },
    });
    return { credited: true, transactionId: tradeTx.id, topUp };
  });
  return { ...result, userCredit, affiliateCut };
}

export async function creditExchangeDepositAtomic(input: {
  depositId: number;
  userId: number;
  gross: number;
  reference: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"exchange-wallet-deposit"}), ${input.userId})`);
    await requireVerifiedIdentity(tx, input.userId);
    const [deposit] = await tx.select().from(walletDeposits).where(eq(walletDeposits.id, input.depositId)).for("update");
    if (!deposit || deposit.userId !== input.userId || deposit.walletType !== "exchange_korapay" || deposit.txHash !== input.reference) {
      throw new Error("No matching Exchange deposit intent exists");
    }
    if (deposit.status === "completed") return { credited: false };
    if (!["pending", "confirmed"].includes(deposit.status) || Number(deposit.amountUsd) !== Number(input.gross.toFixed(2))) {
      throw new Error("Exchange deposit is not eligible for credit");
    }
    const [claim] = await tx.insert(walletCreditClaims).values({
      provider: "exchange_korapay",
      reference: input.reference.trim().toLowerCase(),
      userId: input.userId,
      depositId: input.depositId,
    }).onConflictDoNothing().returning({ id: walletCreditClaims.id });
    if (!claim) return { credited: false };
    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [wallet] = await tx.update(tradeWallets).set({
      exchangeBalance: sql`${tradeWallets.exchangeBalance} + ${input.gross.toFixed(6)}::decimal`,
      updatedAt: new Date(),
    }).where(eq(tradeWallets.userId, input.userId)).returning();
    await tx.update(walletDeposits).set({ status: "completed", verifiedAt: new Date(), failureReason: null, updatedAt: new Date() }).where(eq(walletDeposits.id, input.depositId));
    const [user] = await tx.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Exchange deposit user not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `exchange-deposit:korapay:${input.reference.trim().toLowerCase()}:credited`,
      userId: input.userId,
      eventType: "exchange_deposit_credited",
      payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Exchange Account Deposit Confirmed",
          status: "success",
          amount: `$${input.gross.toFixed(2)}`,
          reference: input.reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "Destination", value: "Exchange Account" },
            { label: "Method", value: "KORAPAY" },
            { label: "Status", value: "Verified and credited", color: "green" },
          ],
        },
        inApp: {
          title: "Exchange Account Funded ✓",
          message: `$${input.gross.toFixed(2)} was verified and added to your Exchange account.`,
          data: { depositId: input.depositId, reference: input.reference },
        },
      },
    });
    return { credited: true, exchangeBalance: wallet?.exchangeBalance };
  });
}

export async function transferSwiftToTradeAtomic(input: {
  userId: number;
  gross: number;
  planDays: number;
}) {
  await settleOverdueTradeBotSession(input.userId);
  const reference = `INTERNAL-TRADE-${input.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const affiliateCut = Number((input.gross * 0.05).toFixed(6));
  const userCredit = Number((input.gross - affiliateCut).toFixed(6));
  const lossDays = lossDaysForPlan(input.planDays);
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${input.userId})`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-deposit"}), ${input.userId})`);
    await requireVerifiedIdentity(tx, input.userId);
    const [debited] = await tx.update(wallets).set({
      balance: sql`${wallets.balance} - ${input.gross.toFixed(2)}::decimal`,
    }).where(sql`${wallets.userId} = ${input.userId} AND ${wallets.balance} >= ${input.gross.toFixed(2)}::decimal`).returning();
    if (!debited) throw new Error("Insufficient SwiftWallet balance");
    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [wallet] = await tx.select().from(tradeWallets).where(eq(tradeWallets.userId, input.userId)).for("update");
    if (!wallet) throw new Error("Unable to prepare Trade Market wallet");
    if (wallet.botActivatedAt) {
      throw new Error("Trade Market funding is unavailable while a bot session is active");
    }
    const topUp = !wallet.roiComplete && (wallet.lossDayNumbers?.length ?? 0) > 0;
    if (topUp) {
      await assertTradeTopUpCapacity(tx, input.userId, wallet.cycleStartedAt);
    }
    const [tradeTx] = await tx.insert(tradeTransactions).values({
      userId: input.userId, type: topUp ? "topup" : "deposit", walletType: null,
      amountUsd: input.gross.toFixed(6), feeUsd: "0.000000",
      reserveFundDeduction: "0.000000", affiliateShareDeduction: affiliateCut.toFixed(6),
      netAmount: userCredit.toFixed(6), txHash: reference, status: "completed",
      note: "Funded atomically from SwiftWallet — 5% affiliate pool, 95% credited",
    }).returning({ id: tradeTransactions.id });
    const update: any = {
      tradeBalance: sql`${tradeWallets.tradeBalance} + ${userCredit.toFixed(6)}::decimal`,
      totalInvested: wallet.roiComplete ? userCredit.toFixed(6) : sql`${tradeWallets.totalInvested} + ${userCredit.toFixed(6)}::decimal`,
      lockedPrincipal: wallet.roiComplete ? userCredit.toFixed(6) : sql`${tradeWallets.lockedPrincipal} + ${userCredit.toFixed(6)}::decimal`,
      tradingPlanDays: input.planDays,
      cycleStartedAt: topUp ? (wallet.cycleStartedAt ?? new Date()) : new Date(),
      updatedAt: new Date(),
    };
    if (wallet.roiComplete || wallet.earlyExitCompleted) Object.assign(update, {
      totalInvested: userCredit.toFixed(6),
      lockedPrincipal: userCredit.toFixed(6),
      roiComplete: false,
      earlyExitCompleted: false,
      totalBotEarnings: "0.000000",
      tradingDayNumber: 0,
      lossDayNumbers: lossDays,
      botActivatedAt: null,
    });
    else if (!(wallet.lossDayNumbers?.length)) update.lossDayNumbers = lossDays;
    else if ((wallet.tradingDayNumber ?? 0) > 0) Object.assign(update, { tradingDayNumber: 0, lossDayNumbers: lossDays, totalBotEarnings: "0.000000", earlyExitCompleted: false, cycleStartedAt: new Date(), botActivatedAt: null });
    const [updated] = await tx.update(tradeWallets).set(update).where(eq(tradeWallets.userId, input.userId)).returning();
    await tx.insert(transactions).values({
      userId: input.userId, type: "trade_transfer", amount: (-input.gross).toFixed(2),
      fee: affiliateCut.toFixed(2), paymentMethod: "wallet",
      description: `Trade Wallet funding — $${userCredit.toFixed(2)} credited (reference ${reference})`,
    });
    const [affiliateResult] = await tx.select({ total: count() }).from(users).where(eq(users.role, "affiliate"));
    const affiliateCount = Number(affiliateResult?.total ?? 0);
    await tx.insert(affiliateTradeShares).values({
      tradeTransactionId: tradeTx.id,
      totalPoolAmount: affiliateCut.toFixed(6),
      affiliateCount,
      perAffiliateAmount: (affiliateCount ? affiliateCut / affiliateCount : 0).toFixed(6),
      sourceType: "trade",
    });
    const [user] = await tx.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Wallet owner not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `wallet-transfer:${reference}:completed`,
      userId: input.userId,
      eventType: "wallet_to_trade_completed",
      payload: {
        userEmail: user.email, userFirstName: user.firstName, adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Trade Wallet Funding Receipt", status: "success",
          amount: `$${userCredit.toFixed(2)}`, amountLabel: `Credited from $${input.gross.toFixed(2)} SwiftWallet debit`,
          reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "From", value: "TSIA SwiftWallet" },
            { label: "To", value: "Trade Market Wallet" },
            { label: "Affiliate pool", value: `$${affiliateCut.toFixed(2)}` },
            { label: "Status", value: "Completed atomically", color: "green" },
          ],
        },
        inApp: {
          title: "Trade Wallet Funded ✓",
          message: `$${userCredit.toFixed(2)} was moved to your Trade Wallet.`,
          data: { reference, transactionId: tradeTx.id },
        },
      },
    });
    return { reference, userCredit, affiliateCut, tradeBalance: updated.tradeBalance };
  });
}

export async function settleTradeEarlyExitAtomic(userId: number) {
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-early-exit"}), ${userId})`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"trade-wallet-deposit"}), ${userId})`);
    await requireVerifiedIdentity(tx, userId);

    await tx.insert(wallets).values({
      userId,
      balance: "0.00",
      activated: false,
      cashbackBalance: "0.00",
      lienAmount: "0.00",
    }).onConflictDoNothing();
    await tx.insert(tradeWallets).values({ userId, tradeBalance: "0.000000" }).onConflictDoNothing();

    const [wallet] = await tx.select().from(tradeWallets)
      .where(eq(tradeWallets.userId, userId))
      .for("update");
    if (!wallet) throw new Error("Trade Market account not found");
    if (wallet.earlyExitCompleted) throw new Error("This Trade Market cycle has already been closed");

    const balanceMicros = parseTradeMoneyMicros(wallet.tradeBalance);
    const lockedPrincipalMicros = parseTradeMoneyMicros(wallet.lockedPrincipal);
    if (balanceMicros <= 0n || lockedPrincipalMicros <= 0n) {
      throw new Error("There is no active Trade Market cycle to close");
    }
    if (wallet.roiComplete || (wallet.tradingDayNumber ?? 0) >= (wallet.tradingPlanDays ?? 120)) {
      throw new Error("This trading cycle has already completed and is not eligible for early exit");
    }
    if (wallet.botActivatedAt) {
      throw new Error("Complete the current bot session before using early exit");
    }

    const [openManual] = await tx.select({ id: manualTrades.id }).from(manualTrades)
      .where(sql`${manualTrades.userId} = ${userId} AND ${manualTrades.status} = 'open'`)
      .limit(1);
    const [openSignal] = await tx.select({ id: signalTrades.id }).from(signalTrades)
      .where(sql`${signalTrades.userId} = ${userId} AND ${signalTrades.status} = 'open'`)
      .limit(1);
    if (openManual || openSignal) {
      throw new Error("Close all open Manual Trading and Trading Signal positions before using early exit");
    }

    const previewQuote = getTradeEarlyExitQuote(wallet.tradeBalance, wallet.lockedPrincipal);
    const payoutMicros = BigInt(Math.round(previewQuote.payout * 100)) * 10_000n;
    const forfeitedMicros = balanceMicros - payoutMicros;
    const exactBalance = formatTradeMoneyMicros(balanceMicros);
    const exactForfeited = formatTradeMoneyMicros(forfeitedMicros);
    const quote = {
      ...previewQuote,
      forfeited: Number(exactForfeited),
      forfeitedExact: exactForfeited,
    };
    if (quote.payout <= 0) throw new Error("There is no early-exit payout available");
    const reference = `TRADE-EARLY-EXIT-${userId}-${Date.now()}`;

    const [closed] = await tx.update(tradeWallets).set({
      tradeBalance: "0.000000",
      totalBotEarnings: "0.000000",
      totalInvested: "0.000000",
      roiComplete: false,
      lockedPrincipal: "0.000000",
      botActivatedAt: null,
      tradingDayNumber: 0,
      lossDayNumbers: [],
      cycleStartedAt: null,
      earlyExitCompleted: true,
      updatedAt: new Date(),
    }).where(sql`${tradeWallets.userId} = ${userId} AND ${tradeWallets.earlyExitCompleted} = FALSE`).returning();
    if (!closed) throw new Error("This Trade Market cycle has already been closed");

    const [tradeTx] = await tx.insert(tradeTransactions).values({
      userId,
      type: "withdraw_exchange",
      walletType: null,
      amountUsd: exactBalance,
      feeUsd: exactForfeited,
      reserveFundDeduction: "0.000000",
      affiliateShareDeduction: "0.000000",
      netAmount: quote.payout.toFixed(2),
      txHash: reference,
      status: "completed",
      note: `Final early exit — 50% capital ($${quote.capitalPayout.toFixed(2)}) + 50% realised profit ($${quote.profitPayout.toFixed(2)}) paid to SwiftWallet; $${quote.forfeited.toFixed(2)} forfeited; Trade Market cycle closed`,
    }).returning({ id: tradeTransactions.id });

    const [swiftWallet] = await tx.update(wallets).set({
      balance: sql`${wallets.balance} + ${quote.payout.toFixed(2)}::decimal`,
      activated: sql`${wallets.activated} OR (${wallets.balance} + ${quote.payout.toFixed(2)}::decimal > 2)`,
    }).where(eq(wallets.userId, userId)).returning({ balance: wallets.balance });
    if (!swiftWallet) throw new Error("Unable to credit SwiftWallet");

    const [swiftTx] = await tx.insert(transactions).values({
      userId,
      type: "deposit",
      amount: quote.payout.toFixed(2),
      fee: "0.00",
      paymentMethod: "internal",
      description: `Trade Market final early-exit settlement (${reference})`,
    }).returning({ id: transactions.id });

    const [user] = await tx.select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, userId));
    if (!user) throw new Error("Trade Market account owner not found");

    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `trade-early-exit:${reference.toLowerCase()}:completed`,
      userId,
      eventType: "trade_early_exit_completed",
      payload: {
        userEmail: user.email,
        userFirstName: user.firstName,
        adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Trade Market Early Exit Receipt",
          status: "success",
          amount: `$${quote.payout.toFixed(2)}`,
          amountLabel: "Final amount credited to SwiftWallet",
          reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "50% of capital", value: `$${quote.capitalPayout.toFixed(2)}` },
            { label: "50% of realised profit", value: `$${quote.profitPayout.toFixed(2)}` },
            { label: "Forfeited on closure", value: `$${quote.forfeited.toFixed(2)}` },
            { label: "Trade Market status", value: "Cycle closed", color: "green" },
          ],
          footerNote: "This was a final early exit. The previous Trade Market cycle has been closed and cannot receive another payout.",
        },
        inApp: {
          title: "Trade Market Account Closed ✓",
          message: `$${quote.payout.toFixed(2)} was credited to your SwiftWallet. Your previous trade cycle is now fully closed.`,
          data: { reference, tradeTransactionId: tradeTx.id, transactionId: swiftTx.id },
        },
      },
    });

    return {
      reference,
      ...quote,
      balanceExact: exactBalance,
      swiftBalance: swiftWallet.balance,
      tradeTransactionId: tradeTx.id,
    };
  });
}

export async function transferSwiftToExchangeAtomic(input: { userId: number; amount: number }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Transfer amount must be positive");
  const reference = `INTERNAL-EXCHANGE-${input.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"exchange-wallet-transfer"}), ${input.userId})`);
    await requireVerifiedIdentity(tx, input.userId);
    const [debited] = await tx.update(wallets).set({
      balance: sql`${wallets.balance} - ${input.amount.toFixed(2)}::decimal`,
    }).where(sql`${wallets.userId} = ${input.userId} AND ${wallets.balance} >= ${input.amount.toFixed(2)}::decimal`).returning();
    if (!debited) throw new Error("Insufficient SwiftWallet balance");
    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [exchangeWallet] = await tx.update(tradeWallets).set({
      exchangeBalance: sql`${tradeWallets.exchangeBalance} + ${input.amount.toFixed(6)}::decimal`,
      updatedAt: new Date(),
    }).where(eq(tradeWallets.userId, input.userId)).returning();
    if (!exchangeWallet) throw new Error("Unable to prepare Exchange account");
    const [ledger] = await tx.insert(transactions).values({
      userId: input.userId,
      type: "trade_transfer",
      amount: (-input.amount).toFixed(2),
      fee: "0.00",
      paymentMethod: "internal",
      description: `SwiftWallet to Exchange account transfer (${reference})`,
    }).returning({ id: transactions.id });
    const [user] = await tx.select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Wallet owner not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `wallet-transfer:${reference}:completed`,
      userId: input.userId,
      eventType: "wallet_to_exchange_completed",
      payload: {
        userEmail: user.email, userFirstName: user.firstName, adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Exchange Funding Receipt", status: "success", amount: `$${input.amount.toFixed(2)}`, reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "From", value: "TSIA SwiftWallet" },
            { label: "To", value: "Exchange Account" },
            { label: "Fee", value: "$0.00" },
            { label: "Status", value: "Completed atomically", color: "green" },
          ],
        },
        inApp: {
          title: "Exchange Account Funded ✓",
          message: `$${input.amount.toFixed(2)} was moved from your SwiftWallet to your Exchange account.`,
          data: { reference, transactionId: ledger.id },
        },
      },
    });
    return {
      reference,
      swiftBalance: Number(debited.balance),
      exchangeBalance: Number(exchangeWallet.exchangeBalance),
    };
  });
}

export async function transferExchangeToSwiftAtomic(input: { userId: number; amount: number }) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Transfer amount must be positive");
  const reference = `EXCHANGE-SWIFT-${input.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return db.transaction(async (tx) => {
    await acquireWalletUserLock(tx, input.userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"exchange-wallet-transfer"}), ${input.userId})`);
    await requireVerifiedIdentity(tx, input.userId);
    await tx.insert(tradeWallets).values({ userId: input.userId, tradeBalance: "0.000000" }).onConflictDoNothing();
    const [debitedExchange] = await tx.update(tradeWallets).set({
      exchangeBalance: sql`${tradeWallets.exchangeBalance} - ${input.amount.toFixed(6)}::decimal`,
      updatedAt: new Date(),
    }).where(sql`${tradeWallets.userId} = ${input.userId} AND ${tradeWallets.exchangeBalance} >= ${input.amount.toFixed(6)}::decimal`).returning();
    if (!debitedExchange) throw new Error("Insufficient Exchange account balance");
    const [creditedSwift] = await tx.update(wallets).set({
      balance: sql`${wallets.balance} + ${input.amount.toFixed(2)}::decimal`,
    }).where(eq(wallets.userId, input.userId)).returning();
    if (!creditedSwift) throw new Error("SwiftWallet not found");
    if (!creditedSwift.activated && Number(creditedSwift.balance) > 2) {
      await tx.update(wallets).set({ activated: true }).where(eq(wallets.userId, input.userId));
    }
    const [ledger] = await tx.insert(transactions).values({
      userId: input.userId,
      type: "deposit",
      amount: input.amount.toFixed(2),
      fee: "0.00",
      paymentMethod: "internal",
      description: `Exchange account to SwiftWallet transfer (${reference})`,
    }).returning({ id: transactions.id });
    const [user] = await tx.select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Wallet owner not found");
    await enqueueFinancialEventInTransaction(tx as any, {
      eventKey: `wallet-transfer:${reference}:completed`,
      userId: input.userId,
      eventType: "exchange_to_wallet_completed",
      payload: {
        userEmail: user.email, userFirstName: user.firstName, adminEmail: ADMIN_EMAIL,
        receipt: {
          title: "Exchange Withdrawal Receipt", status: "success", amount: `$${input.amount.toFixed(2)}`, reference,
          rows: [
            { label: "Account", value: `${user.firstName} ${user.lastName}` },
            { label: "From", value: "Exchange Account" },
            { label: "To", value: "TSIA SwiftWallet" },
            { label: "Fee", value: "$0.00" },
            { label: "Status", value: "Completed atomically", color: "green" },
          ],
        },
        inApp: {
          title: "Exchange Withdrawal ✓",
          message: `$${input.amount.toFixed(2)} was moved from your Exchange account to your SwiftWallet.`,
          data: { reference, transactionId: ledger.id },
        },
      },
    });
    return {
      reference,
      exchangeBalance: Number(debitedExchange.exchangeBalance),
      swiftBalance: Number(creditedSwift.balance),
    };
  });
}