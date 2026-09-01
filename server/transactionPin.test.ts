import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { hashTransactionPin, isValidTransactionPin, verifyTransactionPin } from "./transactionPin";

test("transaction PIN accepts exactly four decimal digits", () => {
  assert.equal(isValidTransactionPin("0000"), true);
  assert.equal(isValidTransactionPin("4829"), true);
  assert.equal(isValidTransactionPin("123"), false);
  assert.equal(isValidTransactionPin("12345"), false);
  assert.equal(isValidTransactionPin("12a4"), false);
  assert.equal(isValidTransactionPin(1234), false);
});

test("transaction PIN hashes are salted scrypt values and never contain the PIN", () => {
  const first = hashTransactionPin("4829");
  const second = hashTransactionPin("4829");
  assert.match(first, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.notEqual(first, second);
  assert.notEqual(first, "4829");
  assert.equal(verifyTransactionPin("4829", first), true);
  assert.equal(verifyTransactionPin("0000", first), false);
  assert.equal(verifyTransactionPin("4829", "not-a-valid-hash"), false);
});

test("PIN lock expiry is typed by PostgreSQL instead of binding a JavaScript Date in CASE", () => {
  const source = readFileSync(new URL("./transactionPin.ts", import.meta.url), "utf8");
  assert.match(source, /NOW\(\) \+ INTERVAL '15 minutes'/);
  assert.doesNotMatch(source, /THEN \$\{lockUntil\}/);
});