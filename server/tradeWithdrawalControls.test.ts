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
  assert.match(tradeWithdrawRoute, /bankTransfersDisabled:\s*true/);
  assert.match(tradeWithdrawRoute, /getTradeProfitWithdrawable\(currentBalance,\s*wdLocked\)/);
  assert.doesNotMatch(tradeWithdrawRoute, /0\.5\s*\+\s*realisedProfit\s*\*\s*0\.5/);
});