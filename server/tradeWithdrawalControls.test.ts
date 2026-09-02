import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  areBankTransfersEnabled,
  formatTradeMoneyMicros,
  getTradeEarlyExitQuote,
  getTradeProfitWithdrawable,
  parseTradeMoneyMicros,
} from "@shared/tradeWithdrawalPolicy";

test("ordinary Trade Market withdrawal exposes profit only", () => {
  assert.equal(getTradeProfitWithdrawable(131.71, 99), 32.71000000000001);
  assert.equal(getTradeProfitWithdrawable(99, 99), 0);
  assert.equal(getTradeProfitWithdrawable(80, 99), 0);
});

test("Trade Market early exit pays half of capital and half of realised profit", () => {
  assert.deepEqual(getTradeEarlyExitQuote(140, 100), {
    capital: 100,
    realisedProfit: 40,
    capitalPayout: 50,
    profitPayout: 20,
    payout: 70,
    forfeited: 70,
  });
  assert.equal(getTradeEarlyExitQuote(80, 100).payout, 40);
  assert.equal(getTradeEarlyExitQuote(80, 100).realisedProfit, 0);
  assert.equal(getTradeEarlyExitQuote(100.01, 100.01).payout, 50);
  assert.equal(getTradeEarlyExitQuote(100.03, 100.01).payout, 50.01);
  assert.equal(getTradeEarlyExitQuote("100.019000", "100.019000").payout, 50);
  assert.equal(getTradeEarlyExitQuote("100.029000", "100.019000").payout, 50);
  assert.equal(getTradeEarlyExitQuote("100.029000", "100.019000").forfeited, 50.029);
  const maxBalanceMicros = parseTradeMoneyMicros("9999999999.999999");
  const maxQuote = getTradeEarlyExitQuote("9999999999.999999", "9999999999.999999");
  const maxPayoutMicros = BigInt(Math.round(maxQuote.payout * 100)) * 10_000n;
  assert.equal(maxQuote.payout, 4999999999.99);
  assert.equal(
    formatTradeMoneyMicros(maxBalanceMicros - maxPayoutMicros),
    "5000000000.009999",
  );
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

test("Trade Market funding controls have server-side active-session gates", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const protectedRoutes = [
    'app.post("/api/trade/wallet/connect"',
    'app.post("/api/trade/deposit"',
    'app.post("/api/trade/fund-from-wallet"',
    'app.post("/api/trade/transfer-to-wallet"',
    'app.post("/api/trade/early-exit"',
    'app.post("/api/trade/withdraw"',
    'app.post("/api/trade/squad/initiate"',
    'app.post("/api/trade/squad/verify"',
    'app.post("/api/trade/korapay/initiate"',
    'app.post("/api/trade/korapay/verify"',
  ];

  for (const route of protectedRoutes) {
    const routeStart = routes.indexOf(route);
    assert.notEqual(routeStart, -1, `${route} should exist`);
    const routeEnd = routes.indexOf("\n  app.", routeStart + route.length);
    const routeBody = routes.slice(routeStart, routeEnd > routeStart ? routeEnd : routeStart + 3000);
    assert.match(routeBody, /isTradeSessionActive\(userId\)/, `${route} should reject active sessions`);
  }
});

test("Trade Market wallet exposes authoritative session state and disables the five controls", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const walletStart = routes.indexOf('app.get("/api/trade/wallet"');
  const walletEnd = routes.indexOf('app.post("/api/trade/wallet/connect"', walletStart);
  assert.match(routes.slice(walletStart, walletEnd), /tradeSessionActive:\s*await isTradeSessionActive\(userId\)/);

  const walletView = readFileSync(
    new URL("../client/src/components/trade/TradeWalletView.tsx", import.meta.url),
    "utf8",
  );
  assert.match(walletView, /const controlsLocked =/);
  assert.match(walletView, /disabled=\{controlsLocked\}/);
  assert.match(walletView, /Locked during active trade/);
});

test("bot balance helpers keep the session marker until completion accounting finishes", () => {
  const storage = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");
  const creditStart = storage.indexOf("async creditBotEarnings");
  const creditEnd = storage.indexOf("async applyBotLoss", creditStart);
  const lossEnd = storage.indexOf("async assignLossDays", creditEnd);
  assert.doesNotMatch(storage.slice(creditStart, creditEnd), /botActivatedAt:\s*null/);
  assert.doesNotMatch(storage.slice(creditEnd, lossEnd), /botActivatedAt:\s*null/);
});

test("bot activation is serialized with early exit and fresh cycles clear stale sessions", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const credits = readFileSync(new URL("./depositCredits.ts", import.meta.url), "utf8");
  const activationStart = routes.indexOf('app.post("/api/trade/bot/activate"');
  const activationEnd = routes.indexOf('app.post("/api/trade/bot/complete"', activationStart);
  const activation = routes.slice(activationStart, activationEnd);
  assert.match(activation, /pg_advisory_xact_lock\(hashtext\(/);
  assert.match(activation, /\.for\("update"\)/);
  assert.match(activation, /earlyExitCompleted/);
  assert.match(credits, /earlyExitCompleted:\s*false,[\s\S]{0,200}botActivatedAt:\s*null/);
});

test("three top-ups keep funding closed until normal cycle settlement resets the cycle", () => {
  const walletView = readFileSync(
    new URL("../client/src/components/trade/TradeWalletView.tsx", import.meta.url),
    "utf8",
  );
  const completion = readFileSync(new URL("./tradeBotCompletion.ts", import.meta.url), "utf8");
  assert.match(walletView, /const topUpDisabled\s+= limitReached/);
  assert.match(walletView, /const topUpIsReinvest = false/);
  assert.match(completion, /cycleStartedAt: null/);
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

test("admin Trade wallet adjustments are atomic and cannot count as bot profit", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const schema = readFileSync("shared/schema.ts", "utf8");
  const serverIndex = readFileSync("server/index.ts", "utf8");
  const adjustmentRoute = routes.slice(
    routes.indexOf('app.post("/api/admin/trade-wallets/:userId/adjust"'),
    routes.indexOf('app.patch("/api/admin/trade-wallet/:userId"'),
  );

  assert.match(schema, /tradeTransactionTypeEnum[^\n]+admin_credit/);
  assert.match(serverIndex, /ALTER TYPE trade_transaction_type ADD VALUE IF NOT EXISTS 'admin_credit'/);
  assert.match(adjustmentRoute, /db\.transaction\(async \(tx\)/);
  assert.match(adjustmentRoute, /type: "admin_credit"/);
  assert.doesNotMatch(adjustmentRoute, /type: "bot_earning"/);
});

test("startup reconciliation rebuilds cached profit counters from canonical evidence", () => {
  const serverIndex = readFileSync("server/index.ts", "utf8");
  const reconciliation = serverIndex.slice(
    serverIndex.indexOf("Reconcile cumulative bot-profit counters"),
    serverIndex.indexOf("Fix roi_complete"),
  );

  assert.match(reconciliation, /SET total_bot_earnings = COALESCE/);
  assert.match(reconciliation, /canonicalBotProfitPredicate\("t"\)/);
  assert.match(reconciliation, /RETURNING tw\.user_id/);
  assert.doesNotMatch(reconciliation, /trade_balance\s*=/);
  assert.doesNotMatch(reconciliation, /locked_principal\s*=/);
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