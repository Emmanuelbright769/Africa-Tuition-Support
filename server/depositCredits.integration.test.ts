import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  createCryptoDepositIntentAtomic,
  createTradeDepositIntentAtomic,
  creditExchangeDepositAtomic,
  creditTradeDepositAtomic,
  CryptoDepositIntentConflictError,
  TradeTopUpLimitError,
  transferExchangeToSwiftAtomic,
  transferSwiftToExchangeAtomic,
  transferSwiftToTradeAtomic,
  settleTradeEarlyExitAtomic,
  recordDepositOutcomeAtomic,
  type TradeDepositTarget,
} from "./depositCredits";

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []);
  }
  return [];
}

test("deposit intents and wallet transfers remain single-credit under concurrent retries", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  const userIds: number[] = [];
  try {
    for (const suffix of ["owner", "other"]) {
      const result = await db.execute(sql`
        INSERT INTO users (first_name, last_name, email, phone, password, role, account_status)
        VALUES (
          'Deposit', 'Race', ${`deposit-race-${suffix}-${marker}@example.invalid`},
          ${`0000${suffix === "owner" ? "1" : "2"}${Date.now()}`}, 'otp-only', 'student', 'active'
        )
        RETURNING id
      `);
      userIds.push(Number(rowsOf<{ id: number }>(result)[0].id));
    }
    const [userId, otherUserId] = userIds;
    await db.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${userId}, '100.00', TRUE, '0.00', '0.00')
    `);
    for (const id of userIds) {
      await db.execute(sql`
        INSERT INTO identity_verifications (
          user_id, document_country, document_type, provider, provider_status,
          status, liveness_status, verified_at, expires_at
        ) VALUES (
          ${id}, 'NG', 'nin', 'test-fixture', 'VERIFIED',
          'verified', 'verified', NOW(), NOW() + INTERVAL '1 year'
        )
      `);
    }

    const intentReference = `0xintent-${marker}`;
    const intentInput = {
      userId,
      amount: 20,
      target: "trade_trc20" as const,
      reference: intentReference,
      metadata: { tradingPlanDays: 60 },
      destination: "Trade Market Wallet" as const,
    };
    const duplicateIntents = await Promise.all([
      createCryptoDepositIntentAtomic(intentInput),
      createCryptoDepositIntentAtomic(intentInput),
    ]);
    assert.equal(duplicateIntents[0].id, duplicateIntents[1].id);
    const eventResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT fe.id)::int AS events,
        COUNT(fo.id)::int AS deliveries
      FROM financial_events fe
      LEFT JOIN financial_event_outbox fo ON fo.financial_event_id = fe.id
      WHERE fe.event_key = ${`crypto-intent:${intentReference.toLowerCase()}:submitted`}
    `);
    assert.deepEqual(rowsOf<{ events: number; deliveries: number }>(eventResult)[0], {
      events: 1,
      deliveries: 3,
    });
    await assert.rejects(
      createCryptoDepositIntentAtomic({ ...intentInput, userId: otherUserId }),
      CryptoDepositIntentConflictError,
    );

    const tradeCredits = await Promise.all([
      creditTradeDepositAtomic({
        depositId: duplicateIntents[0].id,
        userId,
        gross: 20,
        target: "trade_trc20",
        reference: intentReference,
        planDays: 60,
        finalStatus: "verified",
      }),
      creditTradeDepositAtomic({
        depositId: duplicateIntents[0].id,
        userId,
        gross: 20,
        target: "trade_trc20",
        reference: intentReference,
        planDays: 60,
        finalStatus: "verified",
      }),
    ]);
    assert.equal(tradeCredits.filter(result => result.credited).length, 1);

    const reservationTargets: TradeDepositTarget[] = [
      "squad_trade",
      "korapay_trade",
      "trade_trc20",
      "trade_bep20",
    ];
    const finalSlotIntents = await Promise.allSettled(
      reservationTargets.map((target, index) =>
        createTradeDepositIntentAtomic({
          userId,
          amount: 10,
          target,
          reference: `0xtopup-${index}-${marker}`,
          metadata: { tradingPlanDays: 60 },
        }),
      ),
    );
    const reservedIntents = finalSlotIntents.flatMap(result =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const rejectedReservations = finalSlotIntents.flatMap(result =>
      result.status === "rejected" ? [result.reason] : [],
    );
    assert.equal(reservedIntents.length, 3);
    assert.equal(rejectedReservations.length, 1);
    assert.ok(rejectedReservations[0] instanceof TradeTopUpLimitError);

    const firstReserved = reservedIntents[0];
    const firstFinalization = await creditTradeDepositAtomic({
      depositId: firstReserved.id,
      userId,
      gross: 10,
      target: firstReserved.walletType as TradeDepositTarget,
      reference: firstReserved.txHash,
      planDays: 60,
      finalStatus: "verified",
    });
    assert.equal(firstFinalization.credited, true);

    const concurrentSwiftTopUps = await Promise.allSettled([
      transferSwiftToTradeAtomic({ userId, gross: 10, planDays: 60 }),
      transferSwiftToTradeAtomic({ userId, gross: 10, planDays: 60 }),
    ]);
    assert.equal(concurrentSwiftTopUps.filter(result => result.status === "fulfilled").length, 0);
    for (const result of concurrentSwiftTopUps) {
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") assert.ok(result.reason instanceof TradeTopUpLimitError);
    }

    const remainingFinalizations = await Promise.all(
      reservedIntents.slice(1).map(intent =>
        creditTradeDepositAtomic({
          depositId: intent.id,
          userId,
          gross: 10,
          target: intent.walletType as TradeDepositTarget,
          reference: intent.txHash,
          planDays: 60,
          finalStatus: "verified",
        }),
      ),
    );
    assert.equal(remainingFinalizations.filter(result => result.credited).length, 2);

    const outcomeReference = `OUTCOME-ROLLBACK-${marker}`;
    const outcomeDepositResult = await db.execute(sql`
      INSERT INTO wallet_deposits (user_id, amount_usd, tx_hash, wallet_type, status)
      VALUES (${userId}, '7.00', ${outcomeReference}, 'paystack', 'pending')
      RETURNING id
    `);
    const outcomeDepositId = Number(rowsOf<{ id: number }>(outcomeDepositResult)[0].id);
    const outcomeEvent = {
      eventKey: `test-outcome:${outcomeReference}`,
      userId,
      eventType: "deposit_rejected",
      payload: {
        userEmail: `deposit-race-owner-${marker}@example.invalid`,
        userFirstName: "Deposit",
        receipt: {
          title: "Deposit Rejected",
          status: "pending" as const,
          amount: "$7.00",
          reference: outcomeReference,
          rows: [],
        },
        inApp: { title: "Deposit Rejected", message: "No credit." },
      },
    };
    await assert.rejects(recordDepositOutcomeAtomic({
      depositId: outcomeDepositId,
      userId,
      status: "rejected",
      reason: "test rejection",
      event: { ...outcomeEvent, eventKey: " " },
    }));
    const rolledBackOutcome = await db.execute(sql`
      SELECT status FROM wallet_deposits WHERE id = ${outcomeDepositId}
    `);
    assert.equal(rowsOf<{ status: string }>(rolledBackOutcome)[0].status, "pending");
    await recordDepositOutcomeAtomic({
      depositId: outcomeDepositId,
      userId,
      status: "rejected",
      reason: "test rejection",
      event: outcomeEvent,
    });
    const durableOutcome = await db.execute(sql`
      SELECT wd.status, COUNT(fo.id)::int AS deliveries
      FROM wallet_deposits wd
      JOIN financial_events fe ON fe.event_key = ${outcomeEvent.eventKey}
      JOIN financial_event_outbox fo ON fo.financial_event_id = fe.id
      WHERE wd.id = ${outcomeDepositId}
      GROUP BY wd.status
    `);
    assert.deepEqual(rowsOf<{ status: string; deliveries: number }>(durableOutcome)[0], {
      status: "rejected",
      deliveries: 3,
    });

    const exchangeReference = `EXCHANGE-RACE-${marker}`;
    const exchangeIntentResult = await db.execute(sql`
      INSERT INTO wallet_deposits (user_id, amount_usd, tx_hash, wallet_type, status)
      VALUES (${userId}, '30.00', ${exchangeReference}, 'exchange_korapay', 'pending')
      RETURNING id
    `);
    const exchangeDepositId = Number(rowsOf<{ id: number }>(exchangeIntentResult)[0].id);
    const exchangeCredits = await Promise.all([
      creditExchangeDepositAtomic({ depositId: exchangeDepositId, userId, gross: 30, reference: exchangeReference }),
      creditExchangeDepositAtomic({ depositId: exchangeDepositId, userId, gross: 30, reference: exchangeReference }),
    ]);
    assert.equal(exchangeCredits.filter(result => result.credited).length, 1);

    const swiftToExchange = await Promise.allSettled([
      transferSwiftToExchangeAtomic({ userId, amount: 100 }),
      transferSwiftToExchangeAtomic({ userId, amount: 100 }),
    ]);
    assert.equal(swiftToExchange.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(swiftToExchange.filter(result => result.status === "rejected").length, 1);

    const exchangeToSwift = await Promise.allSettled([
      transferExchangeToSwiftAtomic({ userId, amount: 130 }),
      transferExchangeToSwiftAtomic({ userId, amount: 130 }),
    ]);
    assert.equal(exchangeToSwift.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(exchangeToSwift.filter(result => result.status === "rejected").length, 1);

    const balances = await db.execute(sql`
      SELECT
        w.balance::numeric AS swift_balance,
        tw.trade_balance::numeric AS trade_balance,
        tw.exchange_balance::numeric AS exchange_balance
      FROM wallets w
      JOIN trade_wallets tw ON tw.user_id = w.user_id
      WHERE w.user_id = ${userId}
    `);
    const finalBalances = rowsOf<{
      swift_balance: string;
      trade_balance: string;
      exchange_balance: string;
    }>(balances)[0];
    assert.equal(Number(finalBalances.swift_balance), 130);
    assert.equal(Number(finalBalances.trade_balance), 47.5);
    assert.equal(Number(finalBalances.exchange_balance), 0);
  } finally {
    for (const userId of userIds) {
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM financial_event_outbox
        WHERE financial_event_id IN (SELECT id FROM financial_events WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM financial_events WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM affiliate_trade_shares
        WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ${userId})
           OR trade_transaction_id IN (SELECT id FROM trade_transactions WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM wallet_credit_claims WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallet_deposits WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM identity_verifications WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});

test("Trade Market early exit closes the cycle once and fresh funding starts over", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  let userId = 0;
  try {
    const userResult = await db.execute(sql`
      INSERT INTO users (first_name, last_name, email, phone, password, role, account_status)
      VALUES (
        'Early', 'Exit', ${`early-exit-${marker}@example.invalid`},
        ${`0099${Date.now()}`}, 'otp-only', 'student', 'active'
      )
      RETURNING id
    `);
    userId = Number(rowsOf<{ id: number }>(userResult)[0].id);
    await db.execute(sql`
      INSERT INTO identity_verifications (
        user_id, document_country, document_type, provider, provider_status,
        status, liveness_status, verified_at, expires_at
      ) VALUES (
        ${userId}, 'NG', 'nin', 'test-fixture', 'VERIFIED',
        'verified', 'verified', NOW(), NOW() + INTERVAL '1 year'
      )
    `);
    await db.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${userId}, '10.00', TRUE, '0.00', '0.00')
    `);
    await db.execute(sql`
      INSERT INTO trade_wallets (
        user_id, trade_balance, total_bot_earnings, total_invested,
        locked_principal, trading_day_number, trading_plan_days,
        loss_day_numbers, cycle_started_at, early_exit_completed
      ) VALUES (
        ${userId}, '140.000000', '40.000000', '100.000000',
        '100.000000', 8, 60, ARRAY[2, 4, 7, 9], NOW() - INTERVAL '8 days', FALSE
      )
    `);
    await db.execute(sql`
      UPDATE trade_wallets
      SET bot_activated_at = NOW() - INTERVAL '13 hours'
      WHERE user_id = ${userId}
    `);
    await assert.rejects(
      settleTradeEarlyExitAtomic(userId),
      /Complete the current bot session/,
    );
    await db.execute(sql`
      UPDATE trade_wallets SET bot_activated_at = NULL WHERE user_id = ${userId}
    `);

    const openManualResult = await db.execute(sql`
      INSERT INTO manual_trades (
        user_id, symbol, symbol_label, direction, leverage, margin_usd,
        size_usd, entry_price, status
      ) VALUES (
        ${userId}, 'BTC-USD', 'Bitcoin', 'long', 1, '5.000000',
        '5.000000', '50000.00000000', 'open'
      )
      RETURNING id
    `);
    const openManualId = Number(rowsOf<{ id: number }>(openManualResult)[0].id);
    await assert.rejects(
      settleTradeEarlyExitAtomic(userId),
      /Close all open Manual Trading and Trading Signal positions/,
    );
    await db.execute(sql`UPDATE manual_trades SET status = 'cancelled' WHERE id = ${openManualId}`);

    const attempts = await Promise.allSettled([
      settleTradeEarlyExitAtomic(userId),
      settleTradeEarlyExitAtomic(userId),
    ]);
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter(result => result.status === "rejected").length, 1);
    const completed = attempts.find(result => result.status === "fulfilled");
    assert.equal(completed?.status, "fulfilled");
    if (completed?.status === "fulfilled") {
      assert.equal(completed.value.capitalPayout, 50);
      assert.equal(completed.value.profitPayout, 20);
      assert.equal(completed.value.payout, 70);
      assert.equal(completed.value.forfeited, 70);
    }

    const closedResult = await db.execute(sql`
      SELECT
        w.balance::numeric AS swift_balance,
        tw.trade_balance::numeric AS trade_balance,
        tw.locked_principal::numeric AS locked_principal,
        tw.total_invested::numeric AS total_invested,
        tw.total_bot_earnings::numeric AS total_bot_earnings,
        tw.trading_day_number,
        tw.cycle_started_at,
        tw.early_exit_completed,
        (SELECT COUNT(*)::int FROM trade_transactions
          WHERE user_id = ${userId} AND tx_hash LIKE 'TRADE-EARLY-EXIT-%') AS settlements
      FROM wallets w
      JOIN trade_wallets tw ON tw.user_id = w.user_id
      WHERE w.user_id = ${userId}
    `);
    const closed = rowsOf<any>(closedResult)[0];
    assert.equal(Number(closed.swift_balance), 80);
    assert.equal(Number(closed.trade_balance), 0);
    assert.equal(Number(closed.locked_principal), 0);
    assert.equal(Number(closed.total_invested), 0);
    assert.equal(Number(closed.total_bot_earnings), 0);
    assert.equal(closed.trading_day_number, 0);
    assert.equal(closed.cycle_started_at, null);
    assert.equal(closed.early_exit_completed, true);
    assert.equal(closed.settlements, 1);

    const fresh = await transferSwiftToTradeAtomic({ userId, gross: 20, planDays: 90 });
    assert.equal(fresh.userCredit, 19);
    const freshResult = await db.execute(sql`
      SELECT trade_balance::numeric, locked_principal::numeric,
        total_invested::numeric, trading_day_number, trading_plan_days,
        early_exit_completed, cycle_started_at IS NOT NULL AS has_cycle
      FROM trade_wallets WHERE user_id = ${userId}
    `);
    const freshWallet = rowsOf<any>(freshResult)[0];
    assert.equal(Number(freshWallet.trade_balance), 19);
    assert.equal(Number(freshWallet.locked_principal), 19);
    assert.equal(Number(freshWallet.total_invested), 19);
    assert.equal(freshWallet.trading_day_number, 0);
    assert.equal(freshWallet.trading_plan_days, 90);
    assert.equal(freshWallet.early_exit_completed, false);
    assert.equal(freshWallet.has_cycle, true);
  } finally {
    if (userId) {
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM financial_event_outbox
        WHERE financial_event_id IN (SELECT id FROM financial_events WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM financial_events WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM affiliate_trade_shares
        WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ${userId})
           OR trade_transaction_id IN (SELECT id FROM trade_transactions WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM wallet_credit_claims WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallet_deposits WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM manual_trades WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM signal_trades WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM identity_verifications WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});