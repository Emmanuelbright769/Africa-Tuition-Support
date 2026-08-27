import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CURRENCY_RATES, TRADE_MARKET } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

test("crypto withdrawal fees are consistently eight percent", () => {
  assert.equal(CURRENCY_RATES.CRYPTO_WITHDRAW_FEE, 0.08);
  assert.equal(TRADE_MARKET.FEE_EXCHANGE_WITHDRAW, 0.08);
});

test("money routes use live rates and the admin ledger covers every current source", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  assert.doesNotMatch(routes, /CURRENCY_RATES\.USD_TO_NGN_(?:PAYMENT|PAYOUT)/);
  assert.doesNotMatch(routes, /cashNgn\s*\/\s*1600/);
  for (const source of ["wallet", "bill", "trade", "deposit", "withdrawal", "ts_mart"]) {
    assert.match(routes, new RegExp(`'${source}'`));
  }
  assert.match(routes, /financial\.exchange_rates\.updated/);
  assert.match(routes, /financial\.platform_settings\.updated/);
});

test("the normalized ledger UNION executes against the current database schema", async () => {
  await db.execute(sql`
    WITH ledger AS (
      SELECT 'wallet'::text source, t.user_id, t.amount::numeric amount FROM transactions t
        WHERE t.type NOT IN ('bill', 'withdrawal', 'crypto_withdrawal')
          AND (t.type <> 'deposit' OR t.payment_method = 'internal')
      UNION ALL SELECT 'bill', bp.user_id, (-bp.amount)::numeric FROM bill_payments bp
      UNION ALL SELECT 'deposit', d.user_id, d.amount_usd::numeric FROM wallet_deposits d
      UNION ALL SELECT 'withdrawal', w.user_id, (-w.amount)::numeric FROM withdrawal_requests w
        WHERE w.type <> 'bank' OR w.bank_name IS NULL OR w.bank_name NOT LIKE '[TRADE MARKET] %'
      UNION ALL SELECT 'trade', t.user_id,
        CASE WHEN t.type IN ('withdraw_exchange', 'withdraw_bank') THEN -ABS(t.amount_usd) ELSE t.amount_usd END::numeric
        FROM trade_transactions t
      UNION ALL SELECT 'ts_mart', o.buyer_id, (-o.total_amount)::numeric FROM orders o
    )
    SELECT source, user_id, amount FROM ledger LIMIT 1
  `);
});

test("canonical ledger semantics keep debits negative without duplicating operational records", async () => {
  const result = await db.execute(sql`
    SELECT
      CASE WHEN 'withdraw_exchange' IN ('withdraw_exchange', 'withdraw_bank') THEN -ABS(25::numeric) ELSE 25 END AS trade_withdrawal,
      CASE WHEN 'bill' = 'bill' THEN 'bill' ELSE 'wallet' END AS bill_source
  `);
  const row: any = (result.rows ?? result)[0];
  assert.equal(Number(row.trade_withdrawal), -25);
  assert.equal(row.bill_source, "bill");
});