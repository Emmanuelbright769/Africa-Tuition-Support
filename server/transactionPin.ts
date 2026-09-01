import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";

const LOCK_AFTER_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type TransactionPinResult =
  | { ok: true }
  | { ok: false; code: "PIN_REQUIRED" | "PIN_INVALID" | "PIN_LOCKED"; message: string };

export function isValidTransactionPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

export function hashTransactionPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(pin, salt, 64).toString("hex")}`;
}

export function verifyTransactionPin(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(pin, parts[1], 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Verifies a transaction PIN and persists lockout state; never logs the PIN. */
export async function requireTransactionPin(userId: number, pin: unknown): Promise<TransactionPinResult> {
  const [user] = await db.select({
    hash: users.transactionPinHash,
    lockedUntil: users.transactionPinLockedUntil,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.hash) return { ok: false, code: "PIN_REQUIRED", message: "Set a transaction PIN before making transactions." };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { ok: false, code: "PIN_LOCKED", message: "Transaction PIN is locked. Try again in 15 minutes." };
  }
  if (isValidTransactionPin(pin) && verifyTransactionPin(pin, user.hash)) {
    await db.update(users).set({
      transactionPinFailedAttempts: 0,
      transactionPinLockedUntil: null,
    }).where(eq(users.id, userId));
    return { ok: true };
  }

  const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
  await db.update(users).set({
    transactionPinFailedAttempts: sql`CASE WHEN COALESCE(${users.transactionPinFailedAttempts}, 0) + 1 >= ${LOCK_AFTER_FAILURES} THEN 0 ELSE COALESCE(${users.transactionPinFailedAttempts}, 0) + 1 END`,
    transactionPinLockedUntil: sql`CASE WHEN COALESCE(${users.transactionPinFailedAttempts}, 0) + 1 >= ${LOCK_AFTER_FAILURES} THEN ${lockUntil} ELSE NULL END`,
  }).where(eq(users.id, userId));
  const [updated] = await db.select({ lockedUntil: users.transactionPinLockedUntil })
    .from(users).where(eq(users.id, userId)).limit(1);
  return updated?.lockedUntil && updated.lockedUntil.getTime() > Date.now()
    ? { ok: false, code: "PIN_LOCKED", message: "Transaction PIN is locked. Try again in 15 minutes." }
    : { ok: false, code: "PIN_INVALID", message: "Incorrect transaction PIN." };
}