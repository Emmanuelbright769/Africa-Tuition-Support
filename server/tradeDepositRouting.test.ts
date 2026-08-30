import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const depositCredits = readFileSync(new URL("./depositCredits.ts", import.meta.url), "utf8");
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
  assert.match(helper, /creditTradeDepositAtomic\(/);
  assert.match(depositCredits, /deposit\.walletType !== input\.target/);
  assert.match(depositCredits, /insert\(walletCreditClaims\)/);
  assert.match(depositCredits, /onConflictDoNothing\(\)/);
  assert.match(depositCredits, /insert\(tradeTransactions\)/);
  assert.match(depositCredits, /update\(tradeWallets\)/);
  assert.doesNotMatch(helper, /updateWalletBalance/);
});

test("direct Trade crypto submissions remain pending until the on-chain verifier credits them", () => {
  const start = routes.indexOf('app.post("/api/trade/deposit"');
  const end = routes.indexOf("// ── Fund Trade Wallet", start);
  const handler = routes.slice(start, end);
  assert.match(handler, /createCryptoDepositIntentAtomic\(/);
  assert.match(depositCredits, /status:\s*"pending"/);
  assert.match(handler, /trade_trc20/);
  assert.match(handler, /trade_bep20/);
  assert.match(handler, /res\.status\(202\)/);
  assert.doesNotMatch(handler, /updateTradeBalance/);
  assert.doesNotMatch(handler, /status:\s*"completed"/);
});

test("provider webhooks require cryptographic signatures", () => {
  assert.match(routes, /if \(!encryptedBodyHeader\) return res\.sendStatus\(401\)/);
  assert.match(routes, /if \(!sigHeader\) return res\.sendStatus\(401\)/);
  assert.match(routes, /timingSafeEqual/);
  assert.match(routes, /createHmac\("sha256", koraSecret\)\.update\(signedData\)/);
  assert.match(routes, /JSON\.stringify\(req\.body\.data\)/);
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
  assert.match(job, /"paystack"/);
  assert.match(job, /expectedKobo/);
  assert.doesNotMatch(job, /!expectedKobo\s*\|\|/);
  assert.match(job, /missing_expected_amount/);
});

test("SwiftWallet and Exchange transfers use atomic conditional debits", () => {
  assert.match(routes, /transferSwiftToExchangeAtomic\(\{ userId, amount \}\)/);
  assert.match(routes, /transferExchangeToSwiftAtomic\(\{ userId, amount \}\)/);
  assert.match(depositCredits, /wallets\.balance} >=/);
  assert.match(depositCredits, /tradeWallets\.exchangeBalance} >=/);
});