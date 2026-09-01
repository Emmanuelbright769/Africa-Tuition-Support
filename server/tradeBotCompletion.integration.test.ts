import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { completeTradeBotSessionAtomic, settleOverdueTradeBotSession } from "./tradeBotCompletion";
import { transferSwiftToTradeAtomic } from "./depositCredits";

const rows = <T>(result: any): T[] => result?.rows ?? [];

test("keyed bot completion is concurrent-safe, repeat-safe, and credits referral once", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  let owner = 0;
  let referrer = 0;
  try {
    for (const [name, code] of [["Owner", null], ["Referrer", `BOT${marker}`]] as const) {
      const result = await db.execute(sql`
        INSERT INTO users (first_name, last_name, email, phone, password, role, account_status, affiliate_code)
        VALUES (${name}, 'Test', ${`${name}-${marker}@example.invalid`}, ${`${marker}${name}`},
          'otp-only', 'affiliate', 'active', ${code}) RETURNING id
      `);
      if (name === "Owner") owner = Number(rows<{ id: number }>(result)[0].id);
      else referrer = Number(rows<{ id: number }>(result)[0].id);
    }
    await db.execute(sql`UPDATE users SET referred_by = ${`BOT${marker}`} WHERE id = ${owner}`);
    await db.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${owner}, '25.00', TRUE, '0.00', '0.00')`);
    await db.execute(sql`
      INSERT INTO identity_verifications (user_id, document_country, document_type, provider,
        provider_status, status, liveness_status, verified_at, expires_at)
      VALUES (${owner}, 'NG', 'nin', 'test', 'VERIFIED', 'verified', 'verified', NOW(), NOW() + interval '1 year')`);
    const activated = new Date("2025-01-01T00:00:00.000Z");
    await db.execute(sql`
      INSERT INTO trade_wallets (user_id, trade_balance, locked_principal, total_invested,
        trading_plan_days, loss_day_numbers, bot_activated_at, cycle_started_at)
      VALUES (${owner}, '100.000000', '100.000000', '100.000000', 120, ARRAY[2]::integer[],
        ${activated}, ${activated})`);

    const now = new Date("2025-01-01T12:00:00.000Z");
    const results = await Promise.all([
      completeTradeBotSessionAtomic(owner, now),
      completeTradeBotSessionAtomic(owner, now),
    ]);
    assert.equal(results.filter(x => x.completed).length, 1);
    assert.equal((await completeTradeBotSessionAtomic(owner, now)).completed, false);
    const state = rows<any>(await db.execute(sql`
      SELECT tw.trade_balance::numeric AS balance, tw.total_bot_earnings::numeric AS earned,
        tw.trading_day_number, tw.bot_activated_at,
        (SELECT COUNT(*)::int FROM trade_transactions WHERE user_id = ${owner}
          AND tx_hash LIKE 'BOT-SESSION-%') AS owner_sessions,
        (SELECT COUNT(*)::int FROM trade_transactions WHERE user_id = ${referrer}
          AND tx_hash LIKE 'BOT-SESSION-%REFERRAL') AS referral_sessions,
        (SELECT referral_commission_balance::numeric FROM trade_wallets WHERE user_id = ${referrer}) AS commission
      FROM trade_wallets tw WHERE tw.user_id = ${owner}`))[0];
    assert.equal(Number(state.balance), 101.9);
    assert.equal(Number(state.earned), 1.9);
    assert.equal(state.trading_day_number, 1);
    assert.equal(state.bot_activated_at, null);
    assert.equal(state.owner_sessions, 1);
    assert.equal(state.referral_sessions, 1);
    assert.equal(Number(state.commission), .1);

    // A mid-cycle top-up starts a real new accounting boundary in the same
    // wallet update that resets day/earnings; it cannot inherit old sessions.
    const before = rows<any>(await db.execute(sql`SELECT cycle_started_at FROM trade_wallets WHERE user_id = ${owner}`))[0];
    await transferSwiftToTradeAtomic({ userId: owner, gross: 10, planDays: 120 });
    const rolled = rows<any>(await db.execute(sql`
      SELECT trading_day_number, total_bot_earnings::numeric AS earnings, cycle_started_at
      FROM trade_wallets WHERE user_id = ${owner}`))[0];
    assert.equal(rolled.trading_day_number, 0);
    assert.equal(Number(rolled.earnings), 0);
    assert.ok(new Date(rolled.cycle_started_at).getTime() > new Date(before.cycle_started_at).getTime());

    await db.execute(sql`
      UPDATE trade_wallets SET bot_activated_at = NOW() WHERE user_id = ${owner}`);
    const swiftBefore = Number(rows<any>(await db.execute(sql`
      SELECT balance::numeric FROM wallets WHERE user_id = ${owner}`))[0].balance);
    await assert.rejects(
      () => transferSwiftToTradeAtomic({ userId: owner, gross: 5, planDays: 120 }),
      /bot session is active/i,
    );
    const swiftAfter = Number(rows<any>(await db.execute(sql`
      SELECT balance::numeric FROM wallets WHERE user_id = ${owner}`))[0].balance);
    assert.equal(swiftAfter, swiftBefore);

    // Server-side recovery does not depend on this browser's localStorage.
    await db.execute(sql`
      UPDATE trade_wallets
      SET bot_activated_at = NOW() - interval '13 hours'
      WHERE user_id = ${owner}`);
    const recovered = await settleOverdueTradeBotSession(owner);
    assert.equal(recovered.completed, true);
    const fundedAfterRecovery = await transferSwiftToTradeAtomic({
      userId: owner,
      gross: 5,
      planDays: 120,
    });
    assert.ok(fundedAfterRecovery);
  } finally {
    if (owner || referrer) {
      const ids = [owner, referrer].filter(Boolean);
      await db.execute(sql`DELETE FROM notifications WHERE user_id IN ${ids}`);
      await db.execute(sql`
        DELETE FROM financial_event_outbox
        WHERE financial_event_id IN (SELECT id FROM financial_events WHERE user_id IN ${ids})`);
      await db.execute(sql`DELETE FROM financial_events WHERE user_id IN ${ids}`);
      await db.execute(sql`
        DELETE FROM affiliate_trade_shares
        WHERE trade_transaction_id IN (SELECT id FROM trade_transactions WHERE user_id IN ${ids})
           OR transaction_id IN (SELECT id FROM transactions WHERE user_id IN ${ids})`);
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id IN ${ids}`);
      await db.execute(sql`DELETE FROM transactions WHERE user_id IN ${ids}`);
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id IN ${ids}`);
      await db.execute(sql`DELETE FROM identity_verifications WHERE user_id IN ${ids}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id IN ${ids}`);
      await db.execute(sql`DELETE FROM users WHERE id IN ${ids}`);
    }
  }
});

test("final day atomically returns principal and earnings even without an existing SwiftWallet", async () => {
  const marker = `${Date.now()}-${process.pid}-final`;
  let userId = 0;
  try {
    const inserted = await db.execute(sql`
      INSERT INTO users (first_name, last_name, email, phone, password, role, account_status)
      VALUES ('Final', 'Day', ${`final-${marker}@example.invalid`}, ${marker},
        'otp-only', 'affiliate', 'active') RETURNING id`);
    userId = Number(rows<{ id: number }>(inserted)[0].id);
    const activated = new Date("2025-01-01T00:00:00.000Z");
    await db.execute(sql`
      INSERT INTO trade_wallets (
        user_id, trade_balance, locked_principal, total_invested,
        total_bot_earnings, trading_day_number, trading_plan_days,
        loss_day_numbers, bot_activated_at, cycle_started_at
      ) VALUES (
        ${userId}, '150.000000', '100.000000', '100.000000',
        '50.000000', 59, 60, ARRAY[]::integer[], ${activated}, ${activated}
      )`);

    const result = await completeTradeBotSessionAtomic(
      userId,
      new Date("2025-01-01T12:00:00.000Z"),
    );
    assert.equal(result.completed, true);
    assert.equal(result.cycleComplete, true);

    const state = rows<any>(await db.execute(sql`
      SELECT tw.trade_balance::numeric AS trade_balance,
        tw.locked_principal::numeric AS locked_principal,
        tw.trading_day_number, tw.roi_complete,
        w.balance::numeric AS swift_balance,
        (SELECT amount::numeric FROM transactions
          WHERE user_id = ${userId} AND description LIKE '%principal and earnings%'
          ORDER BY id DESC LIMIT 1) AS settlement_amount
      FROM trade_wallets tw
      JOIN wallets w ON w.user_id = tw.user_id
      WHERE tw.user_id = ${userId}`))[0];
    assert.equal(Number(state.trade_balance), 0);
    assert.equal(Number(state.locked_principal), 0);
    assert.equal(state.trading_day_number, 60);
    assert.equal(state.roi_complete, true);
    assert.equal(Number(state.swift_balance), 156);
    assert.equal(Number(state.settlement_amount), 156);
  } finally {
    if (userId) {
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});

test("a frozen active session cannot settle or mutate its financial state", async () => {
  const marker = `Frozen-${Date.now()}-${process.pid}`;
  let userId = 0;
  try {
    const inserted = rows<{ id: number }>(await db.execute(sql`
      INSERT INTO users (first_name, last_name, email, phone, password, role, account_status)
      VALUES ('Frozen', 'Test', ${`${marker}@example.invalid`}, ${marker},
        'otp-only', 'affiliate', 'active') RETURNING id
    `));
    userId = Number(inserted[0].id);
    const activatedAt = new Date("2025-02-01T00:00:00.000Z");
    await db.execute(sql`
      INSERT INTO trade_wallets (
        user_id, trade_balance, locked_principal, total_bot_earnings,
        trading_day_number, trading_plan_days, bot_activated_at, bot_locked
      ) VALUES (
        ${userId}, '125.000000', '100.000000', '25.000000',
        7, 120, ${activatedAt}, TRUE
      )
    `);

    const result = await completeTradeBotSessionAtomic(
      userId,
      new Date("2025-02-01T13:00:00.000Z"),
    );
    assert.equal(result.completed, false);

    const after = rows<any>(await db.execute(sql`
      SELECT trade_balance, locked_principal, total_bot_earnings,
        trading_day_number, bot_activated_at,
        (SELECT COUNT(*)::int FROM trade_transactions WHERE user_id = ${userId}) AS ledger_rows
      FROM trade_wallets WHERE user_id = ${userId}
    `))[0];
    assert.equal(Number(after.trade_balance), 125);
    assert.equal(Number(after.locked_principal), 100);
    assert.equal(Number(after.total_bot_earnings), 25);
    assert.equal(after.trading_day_number, 7);
    assert.equal(new Date(after.bot_activated_at).toISOString(), activatedAt.toISOString());
    assert.equal(after.ledger_rows, 0);
  } finally {
    if (userId) {
      await db.execute(sql`DELETE FROM trade_transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM trade_wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});