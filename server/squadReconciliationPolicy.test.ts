import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const walletBalance = readFileSync(new URL("./walletBalance.ts", import.meta.url), "utf8");
const depositCredits = readFileSync(new URL("./depositCredits.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url), "utf8");

test("Squad success status is normalized consistently", () => {
  assert.match(routes, /function isSquadPaymentSuccessful/);
  assert.match(routes, /toLowerCase\(\) === "success"/);
  assert.ok((routes.match(/isSquadPaymentSuccessful\(d(?:ata)?\.data\?\.transaction_status\)/g) ?? []).length >= 2);
});

test("admin deposit action reconciles with Squad rather than force-crediting", () => {
  const start = routes.indexOf('app.post("/api/admin/deposit/:id/force-credit"');
  const end = routes.indexOf("// ─── ADMIN: Withdrawal Requests", start);
  const handler = routes.slice(start, end);
  assert.match(handler, /transaction\/verify/);
  assert.match(handler, /transaction_amount/);
  assert.match(handler, /expectedKobo/);
  assert.match(handler, /providerRecoveryVerified: true/);
  assert.match(handler, /deposit\.provider_reconcile/);
  assert.doesNotMatch(handler, /updateWalletBalance/);
  assert.match(dashboard, /> Reconcile/);
  assert.doesNotMatch(dashboard, /Force-credit \$\{/);
});

test("provider-confirmed recovery is limited to rejected and manual-review deposits", () => {
  assert.match(walletBalance, /providerRecoveryVerified/);
  assert.match(walletBalance, /status IN \('rejected', 'manual_review'\)/);
  assert.match(depositCredits, /providerRecoveryVerified/);
  assert.match(depositCredits, /\["rejected", "manual_review"\]/);
});

test("bot activation repairs a stale completion flag when cycle days remain", () => {
  const start = routes.indexOf('app.post("/api/trade/bot/activate"');
  const end = routes.indexOf("// Called by the frontend when the bot session ends", start);
  const handler = routes.slice(start, end);
  assert.match(handler, /cycleCompleteByDays/);
  assert.match(handler, /if \(cycleCompleteByDays\)/);
  assert.match(handler, /roiComplete: false/);
  assert.match(handler, /earlyExitCompleted: false/);
  assert.doesNotMatch(handler, /earlyExitCompleted \|\| wallet\.roiComplete/);
});

test("startup repairs impossible early-exit state only for still-funded incomplete cycles", () => {
  const serverIndex = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(serverIndex, /SET early_exit_completed = FALSE/);
  assert.match(serverIndex, /early_exit_completed = TRUE/);
  assert.match(serverIndex, /trade_balance::numeric > 0/);
  assert.match(serverIndex, /locked_principal::numeric > 0/);
  assert.match(serverIndex, /trading_day_number < trading_plan_days/);
});