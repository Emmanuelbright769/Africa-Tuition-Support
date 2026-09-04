import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { identityVerifications } from "../shared/schema";

test("consuming a signup verification clears only the temporary handoff expiry", async () => {
  const tokenHash = `identity-handoff-${Date.now()}-${process.pid}`;
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + 30 * 60 * 1000);
  let identityId = 0;

  try {
    const [created] = await db.insert(identityVerifications).values({
      signupTokenHash: tokenHash,
      documentCountry: "NG",
      documentType: "nin",
      provider: "test",
      providerStatus: "VERIFIED",
      status: "verified",
      livenessStatus: "verified",
      verifiedAt,
      expiresAt,
    }).returning();
    identityId = created.id;

    const consumed = await storage.consumeIdentityVerificationSignupToken(tokenHash);
    assert.equal(consumed?.id, identityId);
    assert.equal(consumed?.signupTokenHash, null);
    assert.equal(consumed?.expiresAt, null);
    assert.equal(consumed?.documentExpiresAt, null);
  } finally {
    if (identityId) {
      await db.delete(identityVerifications).where(eq(identityVerifications.id, identityId));
    }
  }
});