import assert from "node:assert/strict";
import test from "node:test";
import { getTradeRoiProgress } from "./tradeWithdrawalPolicy";

test("ROI progress uses net profit rather than cumulative positive sessions", () => {
  const result = getTradeRoiProgress(133.164499, 99, 120);

  assert.equal(result.netProfit.toFixed(6), "34.164499");
  assert.equal(result.netRoiPct.toFixed(2), "34.51");
  assert.equal(result.progressPct.toFixed(2), "34.51");
  assert.equal(result.remainingToCap.toFixed(2), "64.84");
  assert.equal(result.capReached, false);
});

test("ROI progress scales net profit against each plan's profit cap", () => {
  const sixtyDay = getTradeRoiProgress(74.410879, 50.35, 60);
  assert.equal(sixtyDay.netRoiPct.toFixed(2), "47.79");
  assert.equal(sixtyDay.progressPct.toFixed(2), "68.27");
  assert.equal(sixtyDay.capReached, false);

  const ninetyDay = getTradeRoiProgress(180, 100, 90);
  assert.equal(ninetyDay.progressPct, 100);
  assert.equal(ninetyDay.capReached, true);
});

test("losses cannot produce false ROI progress", () => {
  const result = getTradeRoiProgress(29.385037, 30, 120);

  assert.equal(result.netProfit, 0);
  assert.equal(result.netRoiPct, 0);
  assert.equal(result.progressPct, 0);
  assert.equal(result.capReached, false);
});