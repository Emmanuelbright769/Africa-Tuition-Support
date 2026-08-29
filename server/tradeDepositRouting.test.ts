import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const dashboard = readFileSync(
  new URL("../client/src/pages/AffiliateDashboard.tsx", import.meta.url),
  "utf8",
);

test("Trade Market bank deposit UI uses Trade Market payment endpoints", () => {
  assert.match(dashboard, /"\/api\/trade\/korapay\/initiate"/);
  assert.match(dashboard, /"\/api\/trade\/korapay\/verify"/);
  assert.match(dashboard, /"\/api\/trade\/squad\/initiate"/);
  assert.match(dashboard, /"\/api\/trade\/squad\/verify"/);
});

test("Trade Market payment credit is wallet-targeted and replay protected", () => {
  const helperStart = routes.indexOf("async function creditTradeWallet(");
  const helperEnd = routes.indexOf("// ── Trade Market — Squad initiate", helperStart);
  const helper = routes.slice(helperStart, helperEnd);

  assert.notEqual(helperStart, -1);
  assert.match(helper, /eq\(walletDeposits\.walletType,\s*walletType\)/);
  assert.match(helper, /insert\(walletCreditClaims\)/);
  assert.match(helper, /onConflictDoNothing\(\)/);
  assert.match(helper, /insert\(tradeTransactions\)/);
  assert.match(helper, /update\(tradeWallets\)/);
  assert.doesNotMatch(helper, /updateWalletBalance/);
});

test("provider webhooks route Trade Market deposits to the Trade Wallet", () => {
  const squadStart = routes.indexOf('app.post("/api/webhook/squad"');
  const squadEnd = routes.indexOf("KORAPAY INTEGRATION", squadStart);
  const squadWebhook = routes.slice(squadStart, squadEnd);
  assert.match(squadWebhook, /\["squad",\s*"squad_trade"\]/);
  assert.match(squadWebhook, /allDeposits\.wallet_type === "squad_trade"/);
  assert.match(squadWebhook, /creditTradeWallet\(/);

  const koraStart = routes.indexOf('app.post("/api/webhook/korapay"');
  const koraEnd = routes.indexOf("Shared helper: credit deposit to wallet", koraStart);
  const koraWebhook = routes.slice(koraStart, koraEnd);
  assert.match(koraWebhook, /dep\.wallet_type === "korapay_trade"/);
  assert.match(koraWebhook, /creditTradeWallet\(/);
});

test("automatic pending-deposit recheck includes Trade Market payments", () => {
  const jobStart = routes.indexOf("async function runDepositReverify()");
  const jobEnd = routes.indexOf("Run immediately on startup", jobStart);
  const job = routes.slice(jobStart, jobEnd);

  assert.match(job, /"korapay_trade"/);
  assert.match(job, /"squad_trade"/);
  assert.match(job, /creditTradeWallet\(/);
  assert.match(job, /creditWalletWithSplit\(/);
});