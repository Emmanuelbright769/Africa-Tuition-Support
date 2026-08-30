import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FINANCIAL_DELIVERY_ATTEMPTS,
  financialRetryDelayMs,
  safeDeliveryError,
} from "./financialNotificationPolicy";

test("financial outbox retry delay is bounded and increases per attempt", () => {
  assert.equal(financialRetryDelayMs(1), 30_000);
  assert.equal(financialRetryDelayMs(2), 60_000);
  assert.equal(financialRetryDelayMs(99), 60 * 60 * 1000);
  assert.equal(MAX_FINANCIAL_DELIVERY_ATTEMPTS, 8);
});

test("financial outbox diagnostics redact credentials before persistence or logs", () => {
  const diagnostic = safeDeliveryError(new Error("authorization: Bearer secret-value password=hunter2 postgres://app:db-secret@db.local"));
  assert.doesNotMatch(diagnostic, /secret-value|hunter2|db-secret/);
  assert.match(diagnostic, /\[redacted\]/);
});