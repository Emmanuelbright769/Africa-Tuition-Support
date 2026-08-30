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