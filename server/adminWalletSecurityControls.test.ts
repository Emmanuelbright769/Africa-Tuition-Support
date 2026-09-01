import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const transactionPin = readFileSync(new URL("./transactionPin.ts", import.meta.url), "utf8");

function section(start: string, end: string) {
  const startAt = routes.indexOf(start);
  const endAt = routes.indexOf(end, startAt);
  assert.notEqual(startAt, -1, `missing route section: ${start}`);
  assert.notEqual(endAt, -1, `missing end marker: ${end}`);
  return routes.slice(startAt, endAt);
}

const serviceAdjust = section(
  'app.post("/api/admin/service-wallets/:userId/adjust"',
  'app.get("/api/admin/transaction-pins"',
);
const pinStatus = section(
  'app.get("/api/admin/transaction-pins"',
  "const administerTransactionPin",
);
const pinActions = section(
  "const administerTransactionPin",
  'app.get("/api/admin/users"',
);

test("admin service wallet adjustment requires a reason and durable idempotency key", () => {
  assert.match(serviceAdjust, /note\.length < 3/);
  assert.match(serviceAdjust, /reason\/note of at least 3 characters is required/);
  assert.match(serviceAdjust, /suppliedKey\.length < 16 \|\| suppliedKey\.length > 180/);
  assert.match(serviceAdjust, /A valid idempotencyKey is required/);
  assert.match(serviceAdjust, /service-admin-\$\{createHash\("sha256"\)/);
});

test("admin service wallet adjustment is locked, atomic, non-negative, and audited", () => {
  assert.match(serviceAdjust, /db\.transaction\(async \(tx\)/);
  assert.match(serviceAdjust, /pg_advisory_xact_lock\(hashtext\(\$\{`service-wallet:\$\{serviceType\}`\}\), \$\{targetId\}\)/);
  assert.match(serviceAdjust, /balance \+ \$\{amount\.toFixed\(2\)\} >= 0/);
  assert.match(serviceAdjust, /throw new Error\("INSUFFICIENT_BALANCE"\)/);
  assert.match(serviceAdjust, /INSERT INTO service_wallet_transactions/);
  assert.match(serviceAdjust, /'admin_adjustment'/);
  assert.match(serviceAdjust, /tx\.insert\(adminAuditLogs\)\.values/);
  assert.match(serviceAdjust, /action: "service_wallet\.adjusted"/);
  assert.match(serviceAdjust, /beforeState:/);
  assert.match(serviceAdjust, /afterState:/);
  assert.match(serviceAdjust, /WHERE swt\.service_type = \$\{serviceType\} AND swt\.reference = \$\{reference\}/);
});

test("service ledger references and metadata are opaque to user-facing wallet history", () => {
  assert.match(serviceAdjust, /createHash\("sha256"\)/);
  assert.match(serviceAdjust, /\.digest\("hex"\)/);
  assert.match(serviceAdjust, /source: "admin_reconciliation"/);
  assert.doesNotMatch(serviceAdjust, /actorUserId: admin\.id, note, idempotencyKey: suppliedKey/);
  assert.doesNotMatch(serviceAdjust, /admin-service-adjust:\$\{admin\.id\}/);
});

test("admin wallet inventory includes every eligible user at zero when needed", () => {
  const serviceList = section(
    'app.get("/api/admin/service-wallets"',
    'app.post("/api/admin/service-wallets/:userId/adjust"',
  );
  assert.match(serviceList, /WITH selected_users AS/);
  assert.match(serviceList, /CROSS JOIN \(VALUES \$\{serviceValues\}\) AS svc\(service_type\)/);
  assert.match(serviceList, /LEFT JOIN service_wallets sw ON sw\.user_id = u\.id AND sw\.service_type = svc\.service_type/);
  assert.match(serviceList, /COALESCE\(sw\.balance, 0\)::text AS balance/);
  assert.match(serviceList, /INNER JOIN users u ON u\.id = sw\.user_id/);
  assert.match(serviceList, /WHERE u\.role <> 'admin'/);
});

test("transaction PIN status has security state and announcement fields but not a hash", () => {
  assert.match(pinStatus, /announcementSeenAt: users\.transactionPinAnnouncementSeenAt/);
  assert.match(pinStatus, /announcementNotifiedAt: users\.transactionPinAnnouncementNotifiedAt/);
  assert.match(pinStatus, /failedAttempts: users\.transactionPinFailedAttempts/);
  assert.doesNotMatch(pinStatus, /transactionPinHash:/);
  assert.doesNotMatch(pinStatus, /transaction_pin_hash/);
});

test("PIN unlock and reset require idempotency and reason, audit, and notify without exposing secrets", () => {
  assert.match(pinActions, /reason\.length < 3/);
  assert.match(pinActions, /suppliedKey\.length < 16 \|\| suppliedKey\.length > 180/);
  assert.match(pinActions, /pg_advisory_xact_lock\(hashtext\(\$\{"transaction-pin"\}\), \$\{targetId\}\)/);
  assert.match(pinActions, /action: mode === "unlock" \? "transaction_pin\.unlocked" : "transaction_pin\.reset"/);
  assert.match(pinActions, /tx\.insert\(notifications\)\.values/);
  assert.match(pinActions, /title: mode === "unlock" \? "Transaction PIN unlocked" : "Transaction PIN reset"/);
  assert.match(pinActions, /financialEventKey: reference/);
  assert.match(pinActions, /onConflictDoNothing\(\)\.returning\(\)/);
  assert.match(pinActions, /pushToUser\(targetId, "notification", result\.notification\)/);
  assert.match(pinActions, /transaction_pin_hash = NULL/);
  assert.match(pinActions, /res\.json\(\{ success: true, action: mode, reference, replayed: result\.replayed \}\)/);
  assert.doesNotMatch(pinActions, /res\.json\([^)]*transaction_pin_hash/);
  assert.doesNotMatch(pinActions, /res\.json\([^)]*\bpin\b/i);
});

test("PIN authorization, setup, and admin controls share a transaction advisory lock", () => {
  assert.match(transactionPin, /return db\.transaction\(async tx =>/);
  assert.match(transactionPin, /pg_advisory_xact_lock\(hashtext\(\$\{"transaction-pin"\}\), \$\{userId\}\)/);
  assert.match(transactionPin, /await tx\.select\(/);
  assert.match(transactionPin, /await tx\.update\(users\)/);
  const pinSet = section(
    'app.post("/api/security/transaction-pin/set"',
    'app.post("/api/security/transaction-pin/announcement-seen"',
  );
  assert.match(pinSet, /db\.transaction\(async tx =>/);
  assert.match(pinSet, /pg_advisory_xact_lock\(hashtext\(\$\{"transaction-pin"\}\), \$\{userId\}\)/);
});