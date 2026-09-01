import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../client/src/components/trade/TradingSignals.tsx", import.meta.url), "utf8");

function routeBlock(startMarker: string, endMarker: string) {
  const start = routes.indexOf(startMarker);
  const end = routes.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must exist`);
  return routes.slice(start, end);
}

test("signal cards display provider confidence and entered trades display live P&L", () => {
  assert.match(client, /signal\.confidence\}%/);
  assert.match(client, /unrealizedPnlUsd/);
  assert.match(client, /Open signal positions/);
  assert.match(client, /Live P&amp;L refreshes every 15 seconds/);
});

test("signal generation uses the in-process market feed and only valid provider prices", () => {
  const block = routeBlock('app.get("/api/trade/signals"', 'app.get("/api/trade/signals/history"');
  assert.match(block, /await getTradeMarketPrices\(\)/);
  assert.match(block, /Number\(market\.price\) > 0/);
  assert.doesNotMatch(block, /fetch\(`\$\{req\.protocol\}/);
});

test("signal positions expose add-money and close controls", () => {
  assert.match(client, /\/api\/trade\/signals\/add\/\$\{addTarget!\.id\}/);
  assert.match(client, /\/api\/trade\/signals\/close\/\$\{closeTarget!\.id\}/);
  assert.match(client, /signal-add-confirm-/);
  assert.match(client, /signal-close-confirm-/);
});

test("adding signal funds is locked, replay-safe, and isolated to the signals wallet", () => {
  const block = routeBlock('app.post("/api/trade/signals/add/:id"', 'app.get("/api/trade/bot-position"');
  assert.match(block, /\.for\("update"\)/);
  assert.match(block, /service_wallet_transactions/);
  assert.match(block, /idempotencyKey/);
  assert.match(block, /debitServiceWalletInTransaction/);
  assert.match(block, /serviceType: "signals"/);
  assert.match(block, /position_add_margin/);
  assert.match(block, /weightedEntry/);
});

test("closing a signal settles through the signals wallet exactly once", () => {
  const block = routeBlock("const resolveSignalTrade", 'app.post("/api/trade/signals/add/:id"');
  assert.match(block, /status !== "open"/);
  assert.match(block, /\.for\("update"\)/);
  assert.match(block, /reference: `signal-resolve-\$\{t\.id\}`/);
  assert.match(block, /creditServiceWalletInTransaction/);
  assert.match(block, /serviceType: "signals"/);
});