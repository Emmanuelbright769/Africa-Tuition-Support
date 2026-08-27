import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { adminAuditLogs, adminManualCreditGuards, users } from "@shared/schema";

test("manual-credit references survive account deletion without blocking it", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const reference = `ADMIN-CONTROL-TEST-${suffix}`;
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  assert.ok(admin, "an admin account is required for audit attribution");

  const [target] = await db.insert(users).values({
    firstName: "Control",
    lastName: "Test",
    email: `admin-control-${suffix}@example.test`,
    phone: `test-${suffix}`,
    password: "otp-only",
    role: "student",
  }).returning();

  try {
    const [firstGuard] = await db.insert(adminManualCreditGuards)
      .values({ reference, userId: target.id })
      .onConflictDoNothing()
      .returning();
    assert.ok(firstGuard, "first use of a payment reference must be accepted");

    const secondGuard = await db.insert(adminManualCreditGuards)
      .values({ reference, userId: target.id })
      .onConflictDoNothing()
      .returning();
    assert.equal(secondGuard.length, 0, "replayed payment reference must be rejected");

    await storage.deleteUserById(target.id, {
      actorUserId: admin.id,
      reason: "Automated deletion integrity test",
      metadata: { testReference: reference },
    });

    const [preservedGuard] = await db.select().from(adminManualCreditGuards).where(eq(adminManualCreditGuards.reference, reference));
    assert.ok(preservedGuard, "replay guard must remain after account deletion");
    assert.equal(preservedGuard.userId, null, "deleted account link must be anonymized");

    const [audit] = await db.select().from(adminAuditLogs).where(and(
      eq(adminAuditLogs.actorUserId, admin.id),
      eq(adminAuditLogs.action, "account.deleted"),
      sql`${adminAuditLogs.metadata}->>'testReference' = ${reference}`,
    )).limit(1);
    assert.ok(audit, "deletion must retain an audit record");
  } finally {
    await db.delete(adminManualCreditGuards).where(eq(adminManualCreditGuards.reference, reference));
    await db.delete(adminAuditLogs).where(sql`${adminAuditLogs.metadata}->>'testReference' = ${reference}`);
    await db.delete(users).where(eq(users.id, target.id));
  }
});