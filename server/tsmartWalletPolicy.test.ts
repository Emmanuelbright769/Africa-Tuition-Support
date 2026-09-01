import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const orders = routes.slice(routes.indexOf('app.post("/api/orders"'), routes.indexOf('app.post("/api/orders/:id/tracking"'));

test("TS-Mart order escrow uses only tsmart service wallet movements", () => {
  assert.match(orders, /debitServiceWalletInTransaction\(tx, \{ userId, serviceType: "tsmart"/);
  assert.match(orders, /creditServiceWalletInTransaction\(tx, \{ userId: current\.buyer_id, serviceType: "tsmart"/);
  assert.match(orders, /creditServiceWalletInTransaction\(tx, \{ userId: current\.seller_id, serviceType: "tsmart"/);
  assert.doesNotMatch(orders, /updateWalletBalance|wallets\.balance|getOrCreateWallet/);
});

test("TS-Mart refund and proceeds state transitions are guarded in their wallet transaction", () => {
  assert.match(orders, /UPDATE orders SET status = 'cancelled'[\s\S]*status IN \('pending', 'confirmed'\) AND escrow_released = FALSE/);
  assert.match(orders, /UPDATE orders SET status = 'delivered', escrow_released = TRUE[\s\S]*escrow_released = FALSE AND status IN \('confirmed', 'shipped'\)/);
  assert.match(orders, /tsmart-order-refund-\$\{current\.id\}/);
  assert.match(orders, /tsmart-order-proceeds-\$\{current\.id\}/);
});

test("service-wallet transfers and deposits reject fractional-cent value creation", () => {
  const serviceWallets = readFileSync(new URL("./serviceWallets.ts", import.meta.url), "utf8");
  assert.match(serviceWallets, /function assertCentAmount/);
  assert.match(serviceWallets, /transferSwiftToServiceWalletAtomic[\s\S]*assertCentAmount\(input\.amount\)/);
  assert.match(serviceWallets, /transferServiceToSwiftWalletAtomic[\s\S]*assertCentAmount\(input\.amount\)/);
  assert.match(serviceWallets, /createServiceDepositIntentAtomic[\s\S]*assertCentAmount\(input\.amount\)/);
  assert.match(serviceWallets, /createServiceDepositIntentAtomic[\s\S]*await verified\(tx, input\.userId\)/);
});

test("signal entries derive financial terms from a live server-issued signal", () => {
  assert.match(routes, /trustedSignal = signalCache\.signals\.find/);
  assert.match(routes, /trustedSignal\.expiresAt/);
  assert.match(routes, /symbol: trustedSignal\.symbol/);
  assert.match(routes, /entryPrice: String\(trustedSignal\.entryPrice\)/);
});