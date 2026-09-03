import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_CLOSE_CONFIRMATION,
  getAccountClosureBlockers,
  isAccountCloseConfirmationValid,
} from "./accountClosurePolicy";

test("account closure requires the exact destructive confirmation", () => {
  assert.equal(isAccountCloseConfirmationValid(ACCOUNT_CLOSE_CONFIRMATION), true);
  assert.equal(isAccountCloseConfirmationValid("close my account"), false);
  assert.equal(isAccountCloseConfirmationValid("CLOSE MY ACCOUNT "), false);
  assert.equal(isAccountCloseConfirmationValid(undefined), false);
});

test("account closure returns only active financial blockers", () => {
  assert.deepEqual(getAccountClosureBlockers({
    swift_balance: true,
    trade_balance: false,
    service_balance: true,
    manual_position: true,
    pending_order: false,
  }), [
    "positive SwiftWallet balance",
    "positive Manual, Signals, or TS-Mart balance",
    "open Manual Trading position",
  ]);
});

test("account closure has no blockers for a settled account", () => {
  assert.deepEqual(getAccountClosureBlockers({}), []);
  assert.deepEqual(getAccountClosureBlockers(undefined), []);
});