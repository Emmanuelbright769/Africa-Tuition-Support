import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  areBankTransfersEnabled,
  getTradeProfitWithdrawable,
} from "@shared/tradeWithdrawalPolicy";

test("ordinary Trade Market withdrawal exposes profit only", () => {
  assert.equal(getTradeProfitWithdrawable(131.71, 99), 32.71000000000001);
  assert.equal(getTradeProfitWithdrawable(99, 99), 0);
  assert.equal(getTradeProfitWithdrawable(80, 99), 0);
});

test("bank transfer setting is closed only by the persisted false value", () => {
  assert.equal(areBankTransfersEnabled("false"), false);
  assert.equal(areBankTransfersEnabled("true"), true);
  assert.equal(areBankTransfersEnabled(undefined), true);
});

test("Trade Market bank withdrawals enforce the global admin switch", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const routeStart = routes.indexOf('app.post("/api/trade/withdraw"');
  const routeEnd = routes.indexOf('app.get("/api/trade/withdrawals"', routeStart);
  const tradeWithdrawRoute = routes.slice(routeStart, routeEnd > routeStart ? routeEnd : routeStart + 12000);

  assert.match(tradeWithdrawRoute, /getPlatformSetting\("bank_transfers_enabled"\)/);
  assert.match(tradeWithdrawRoute, /message:\s*"Network error\. Please try again later\."/);
  assert.doesNotMatch(tradeWithdrawRoute, /bankTransfersDisabled/);
  assert.match(tradeWithdrawRoute, /getTradeProfitWithdrawable\(currentBalance,\s*wdLocked\)/);
  assert.doesNotMatch(tradeWithdrawRoute, /0\.5\s*\+\s*realisedProfit\s*\*\s*0\.5/);
});

test("Trade Market does not reveal the bank-transfer shutdown before submission", () => {
  const dashboard = readFileSync(
    new URL("../client/src/pages/AffiliateDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(dashboard, /Bank transfers are temporarily closed/);
  assert.doesNotMatch(dashboard, /Bank Closed/);
  assert.doesNotMatch(dashboard, /bankTransfersOpen/);
});

test("Trade Market bank withdrawals reject active liens at check and debit time", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const routeStart = routes.indexOf('app.post("/api/trade/withdraw"');
  const routeEnd = routes.indexOf('app.get("/api/trade/withdrawals"', routeStart);
  const tradeWithdrawRoute = routes.slice(routeStart, routeEnd > routeStart ? routeEnd : routeStart + 14000);

  assert.match(tradeWithdrawRoute, /accountWallet\.lienAmount/);
  assert.match(tradeWithdrawRoute, /wallets\.lien_amount::numeric > 0/);
  assert.match(tradeWithdrawRoute, /platform_settings\.value = 'false'/);
});

test("disabled bank-transfer responses expose no internal shutdown metadata", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  assert.doesNotMatch(routes, /bankTransfersDisabled:\s*true/);

  const financialHub = readFileSync(
    new URL("../client/src/pages/FinancialHub.tsx", import.meta.url),
    "utf8",
  );
  assert.match(financialHub, /"Network error\. Please try again later\."/);
});

test("admin lien dialog offers account lien removal", () => {
  const dashboard = readFileSync(
    new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(dashboard, /data-testid="button-remove-lien-from-account"/);
  assert.match(dashboard, /api\/admin\/wallet-liens\/\$\{releaseConfirm\.userId\}/);
});

test("exchange-rate save remains clickable and validates its audit reason on click", () => {
  const dashboard = readFileSync(
    new URL("../client/src/pages/AdminDashboard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /id="exchange-rate-change-reason"/);
  assert.match(dashboard, /disabled=\{saveMultiRatesMutation\.isPending\}/);
  assert.match(dashboard, /title:\s*"Reason required"/);
});