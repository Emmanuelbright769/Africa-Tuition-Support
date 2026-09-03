import assert from "node:assert/strict";
import test from "node:test";
import { lagosDayRange, sortStatementRows } from "./statementHelpers";

test("Lagos statement days use inclusive persisted timestamp boundaries", () => {
  const { start, endExclusive } = lagosDayRange("2025-01-15", "2025-01-15");
  assert.equal(start.toISOString(), "2025-01-14T23:00:00.000Z");
  assert.equal(endExclusive.toISOString(), "2025-01-15T23:00:00.000Z");
  assert.ok(new Date("2025-01-15T22:59:59.999Z") >= start);
  assert.ok(new Date("2025-01-15T22:59:59.999Z") < endExclusive);
  assert.ok(new Date("2025-01-15T23:00:00.000Z") >= endExclusive);
});

test("statement helpers reject reversed or excessive ranges and sort chronologically", () => {
  assert.throws(() => lagosDayRange("2025-01-02", "2025-01-01"));
  assert.throws(() => lagosDayRange("2024-01-01", "2025-01-01"));
  assert.deepEqual(sortStatementRows([
    { timestamp: "2025-01-02T00:00:00Z" },
    { timestamp: "2025-01-01T00:00:00Z" },
  ] as any).map(row => row.timestamp), ["2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z"]);
});