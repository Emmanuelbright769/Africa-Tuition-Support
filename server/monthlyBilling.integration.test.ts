import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { reconcileMonthlyBilling } from "./monthlyBilling";
import { creditVerifiedDepositAtomic, creditWalletBalanceAtomic } from "./walletBalance";

function rowsOf<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result) {
    return ((result as { rows?: T[] }).rows ?? []);
  }
  return [];
}

test("a same-month signup has access without a billing cycle or fee deduction", async () => {
  const marker = `new-member-${Date.now()}-${process.pid}`;
  let userId: number | null = null;
  try {
    const result = await db.execute(sql`
      INSERT INTO users (
        first_name, last_name, email, phone, password, role,
        account_status, created_at
      )
      VALUES (
        'New', 'Member', ${`${marker}@example.invalid`}, ${marker},
        'otp-only', 'student', 'active', '2026-09-05T12:00:00Z'
      )
      RETURNING id
    `);
    userId = Number(rowsOf<{ id: number }>(result)[0].id);
    const walletResult = await db.execute(sql`
      INSERT INTO wallets (user_id, balance)
      VALUES (${userId}, '0.00')
      RETURNING activated, balance::numeric AS balance
    `);
    const newWallet = rowsOf<{ activated: boolean; balance: string }>(walletResult)[0];
    assert.equal(newWallet.activated, true);
    assert.equal(Number(newWallet.balance), 0);

    const status = await reconcileMonthlyBilling(
      userId,
      new Date("2026-09-20T12:00:00+01:00"),
    );
    assert.equal(status.required, false);
    assert.equal(status.hasAccess, true);
    assert.equal(status.state, "exempt");
    assert.equal(status.amountDue, 0);

    const audit = rowsOf<{ cycles: number; fees: number }>(await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM monthly_billing_cycles WHERE user_id = ${userId}) AS cycles,
        (SELECT COUNT(*)::int FROM transactions
          WHERE user_id = ${userId}
            AND type IN ('subscription_fee', 'maintenance_fee')) AS fees
    `))[0];
    assert.equal(audit.cycles, 0);
    assert.equal(audit.fees, 0);
  } finally {
    if (userId !== null) {
      await db.execute(sql`DELETE FROM monthly_billing_cycles WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});

test("monthly billing is atomic and a missed month never accumulates into arrears", async () => {
  const marker = `${Date.now()}-${process.pid}`;
  let userId: number | null = null;

  try {
    const userResult = await db.execute(sql`
      INSERT INTO users (first_name, last_name, email, phone, password, role, account_status)
      VALUES ('Billing', 'Test', ${`billing-test-${marker}@example.invalid`}, '0000000000', 'otp-only', 'student', 'active')
      RETURNING id
    `);
    userId = Number(rowsOf<{ id: number }>(userResult)[0].id);
    await db.execute(sql`UPDATE users SET created_at = '2026-08-31T12:00:00Z' WHERE id = ${userId}`);
    await db.execute(sql`
      INSERT INTO wallets (user_id, balance, activated, cashback_balance, lien_amount)
      VALUES (${userId}, '1.99', TRUE, '0.00', '0.00')
    `);
    await db.execute(sql`
      INSERT INTO identity_verifications (
        user_id, document_country, document_type, provider, provider_status,
        status, liveness_status, verified_at, expires_at
      ) VALUES (
        ${userId}, 'NG', 'nin', 'test-fixture', 'VERIFIED',
        'verified', 'verified', NOW(), NOW() + INTERVAL '1 year'
      )
    `);

    const september = new Date("2026-09-01T00:05:00+01:00");
    const restricted = await reconcileMonthlyBilling(userId, september);
    assert.equal(restricted.state, "payment_required");
    assert.equal(restricted.hasAccess, false);
    assert.equal(restricted.walletBalance, 1.99);
    assert.equal(restricted.shortfall, 0.01);
    assert.equal(restricted.amountDue, 2);
    assert.equal(restricted.unpaidMonths, 1);

    const unchangedBalanceResult = await db.execute(sql`
      SELECT balance::numeric AS balance FROM wallets WHERE user_id = ${userId}
    `);
    assert.equal(Number(rowsOf<{ balance: string }>(unchangedBalanceResult)[0].balance), 1.99);
    await reconcileMonthlyBilling(userId, september);
    await reconcileMonthlyBilling(userId, september);
    const readOnlyAuditResult = await db.execute(sql`
      SELECT attempt_count
      FROM monthly_billing_cycles
      WHERE user_id = ${userId} AND month_key = '2026-09'
    `);
    assert.equal(rowsOf<{ attempt_count: number }>(readOnlyAuditResult)[0].attempt_count, 1);

    await db.execute(sql`UPDATE wallets SET balance = '2.00' WHERE user_id = ${userId}`);
    const concurrent = await Promise.all([
      reconcileMonthlyBilling(userId, september),
      reconcileMonthlyBilling(userId, september),
      reconcileMonthlyBilling(userId, september),
    ]);
    assert.equal(concurrent.every((status) => status.state === "paid" && status.hasAccess), true);
    assert.equal(concurrent.filter((status) => status.chargedNow).length, 1);

    const septemberLedgerResult = await db.execute(sql`
      SELECT type, amount::numeric AS amount
      FROM transactions
      WHERE user_id = ${userId}
      ORDER BY id
    `);
    const septemberLedger = rowsOf<{ type: string; amount: string }>(septemberLedgerResult);
    assert.deepEqual(
      septemberLedger.map((entry) => [entry.type, Number(entry.amount)]),
      [["subscription_fee", -1.5], ["maintenance_fee", -0.5]],
    );

    await db.execute(sql`UPDATE wallets SET balance = '0.00' WHERE user_id = ${userId}`);
    const october = await reconcileMonthlyBilling(userId, new Date("2026-10-01T00:05:00+01:00"));
    assert.equal(october.state, "payment_required");
    assert.equal(october.amountDue, 2);
    assert.equal(october.unpaidMonths, 1);

    await db.execute(sql`UPDATE wallets SET balance = '2.00' WHERE user_id = ${userId}`);
    const november = new Date("2026-11-01T00:05:00+01:00");
    const currentMonthOnly = await reconcileMonthlyBilling(userId, november);
    assert.equal(currentMonthOnly.state, "paid");
    assert.equal(currentMonthOnly.hasAccess, true);
    assert.equal(currentMonthOnly.amountDue, 0);
    assert.equal(currentMonthOnly.unpaidMonths, 0);
    assert.equal(currentMonthOnly.walletBalance, 0);

    const cyclesResult = await db.execute(sql`
      SELECT month_key, status
      FROM monthly_billing_cycles
      WHERE user_id = ${userId}
      ORDER BY month_key
    `);
    assert.deepEqual(
      rowsOf<{ month_key: string; status: string }>(cyclesResult),
      [
        { month_key: "2026-09", status: "paid" },
        { month_key: "2026-10", status: "waived" },
        { month_key: "2026-11", status: "paid" },
      ],
    );

    const finalLedgerResult = await db.execute(sql`
      SELECT type, amount::numeric AS amount
      FROM transactions
      WHERE user_id = ${userId}
      ORDER BY id
    `);
    assert.deepEqual(
      rowsOf<{ type: string; amount: string }>(finalLedgerResult)
        .map((entry) => [entry.type, Number(entry.amount)]),
      [
        ["subscription_fee", -1.5],
        ["maintenance_fee", -0.5],
        ["subscription_fee", -1.5],
        ["maintenance_fee", -0.5],
      ],
    );

    const depositResult = await db.execute(sql`
      INSERT INTO wallet_deposits (user_id, amount_usd, tx_hash, wallet_type, status)
      VALUES (${userId}, '5.00', ${`verified-ref-${marker}`}, 'squad', 'pending')
      RETURNING id
    `);
    const depositId = rowsOf<{ id: number }>(depositResult)[0].id;
    const verifiedCredit = {
      depositId,
      userId,
      userCredit: 4.75,
      fee: 0.25,
      provider: "squad",
      reference: `verified-ref-${marker}`,
      description: "Concurrent verified funding test",
    };
    await assert.rejects(creditVerifiedDepositAtomic({ ...verifiedCredit, userId: 1 }));
    const duplicateRace = await Promise.all([
      creditVerifiedDepositAtomic(verifiedCredit),
      creditVerifiedDepositAtomic(verifiedCredit),
    ]);
    assert.equal(duplicateRace.filter((result) => result.credited).length, 1);
    const duplicateLedgerResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM transactions
      WHERE user_id = ${userId} AND type = 'deposit'
    `);
    assert.equal(rowsOf<{ count: number }>(duplicateLedgerResult)[0].count, 1);
  } finally {
    if (userId !== null) {
      await db.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM financial_event_outbox
        WHERE financial_event_id IN (SELECT id FROM financial_events WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM financial_events WHERE user_id = ${userId}`);
      await db.execute(sql`
        DELETE FROM affiliate_trade_shares
        WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ${userId})
      `);
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM monthly_billing_cycles WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallet_credit_claims WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallet_deposits WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM identity_verifications WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM wallets WHERE user_id = ${userId}`);
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
  }
});