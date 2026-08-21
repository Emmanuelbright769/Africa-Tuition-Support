import { createHash } from "crypto";

export function hashVerifiedName(firstName: unknown, lastName: unknown): string | null {
  if (typeof firstName !== "string" || typeof lastName !== "string") return null;
  const normalized = `${firstName} ${lastName}`
    .normalize("NFKD")
    .replace(/[\s\-_.''’]+/g, "")
    .toLocaleLowerCase();
  return normalized.length >= 2
    ? createHash("sha256").update(normalized).digest("hex")
    : null;
}

export function isExplicitlyLive(liveness: unknown): boolean {
  return ["VERIFIED", "SUCCESS", "LIVE"].includes(String(liveness ?? "").toUpperCase());
}

export function doesVerifiedNameMatch(
  providerEvidence: unknown,
  firstName: unknown,
  lastName: unknown,
): boolean {
  const expected = hashVerifiedName(firstName, lastName);
  const verified = providerEvidence &&
    typeof providerEvidence === "object" &&
    typeof (providerEvidence as { verifiedNameHash?: unknown }).verifiedNameHash === "string"
    ? (providerEvidence as { verifiedNameHash: string }).verifiedNameHash
    : null;
  return !!expected && !!verified && expected === verified;
}