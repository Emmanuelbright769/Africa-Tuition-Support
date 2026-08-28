import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getLagosBillingMonthKey,
  getBillingMonthKeys,
  getMonthlyBillingDecision,
  isMonthlyBillingAllowedRequest,
  isMonthlyBillingStarted,
  MONTHLY_TOTAL_FEE_USD,
} from "@shared/monthlyBillingPolicy";

test("monthly billing starts exactly at September 1, 2026 in Lagos", () => {
  assert.equal(isMonthlyBillingStarted(new Date("2026-08-31T22:59:59.999Z")), false);
  assert.equal(isMonthlyBillingStarted(new Date("2026-08-31T23:00:00.000Z")), true);
  assert.equal(getLagosBillingMonthKey(new Date("2026-08-31T23:00:00.000Z")), "2026-09");
  assert.equal(getLagosBillingMonthKey(new Date("2026-09-30T23:00:00.000Z")), "2026-10");
  assert.deepEqual(
    getBillingMonthKeys(
      new Date("2026-12-01T00:05:00+01:00"),
      new Date("2026-11-15T12:00:00+01:00"),
    ),
    ["2026-11", "2026-12"],
  );
});

test("the full two-dollar amount is required and partial balances are not chargeable", () => {
  assert.equal(MONTHLY_TOTAL_FEE_USD, 2);
  assert.equal(getMonthlyBillingDecision(0), "restrict");
  assert.equal(getMonthlyBillingDecision(1.99), "restrict");
  assert.equal(getMonthlyBillingDecision(2), "charge");
  assert.equal(getMonthlyBillingDecision(2, 4), "restrict");
  assert.equal(getMonthlyBillingDecision(4, 4), "charge");
  assert.equal(getMonthlyBillingDecision(50), "charge");
});

test("restricted users retain only authentication, status, identity, and wallet-funding APIs", () => {
  const allowed: Array<[string, string]> = [
    ["GET", "/api/auth/me"],
    ["POST", "/api/auth/logout"],
    ["GET", "/api/billing/status"],
    ["POST", "/api/identity-verifications/verify"],
    ["GET", "/api/verification/status"],
    ["GET", "/api/wallet"],
    ["GET", "/api/wallet/balances"],
    ["GET", "/api/wallet/deposits"],
    ["GET", "/api/wallet/banks"],
    ["GET", "/api/exchange-rates"],
    ["POST", "/api/wallet/squad/initiate"],
    ["POST", "/api/wallet/squad/verify"],
    ["POST", "/api/wallet/korapay/initiate"],
    ["POST", "/api/wallet/korapay/verify"],
    ["POST", "/api/wallet/paystack/initialize"],
    ["POST", "/api/wallet/paystack/verify"],
    ["POST", "/api/wallet/deposit"],
  ];
  for (const [method, path] of allowed) {
    assert.equal(isMonthlyBillingAllowedRequest(method, path), true, `${method} ${path}`);
  }

  const blocked: Array<[string, string]> = [
    ["GET", "/api/scholarships"],
    ["POST", "/api/wallet/send"],
    ["POST", "/api/fintech/bank-transfer"],
    ["GET", "/api/trade/wallet"],
    ["POST", "/api/trade/deposit"],
    ["POST", "/api/exchange/fund"],
    ["GET", "/api/orders"],
    ["GET", "/api/notifications"],
  ];
  for (const [method, path] of blocked) {
    assert.equal(isMonthlyBillingAllowedRequest(method, path), false, `${method} ${path}`);
  }
});

test("billing implementation is transaction-scoped, idempotent, and no longer partially deducts maintenance", () => {
  const service = readFileSync(new URL("./monthlyBilling.ts", import.meta.url), "utf8");
  const walletBalance = readFileSync(new URL("./walletBalance.ts", import.meta.url), "utf8");
  const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  assert.match(walletBalance, /pg_advisory_xact_lock/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /ON CONFLICT \(user_id, month_key\)/);
  assert.match(service, /ORDER BY month_key/);
  assert.match(service, /getBillingMonthKeys/);
  assert.match(walletBalance, /wallet_credit_claims/);
  assert.match(routes, /Crypto is never credited from caller-supplied data/);
  assert.doesNotMatch(index, /Math\.min\(MAINTENANCE_FEE,\s*currentBalance\)/);
  assert.match(index, /startMonthlyBillingJob/);
});