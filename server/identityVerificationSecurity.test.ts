import assert from "node:assert/strict";
import test from "node:test";
import {
  doesVerifiedNameMatch,
  hashVerifiedName,
  isExplicitlyLive,
} from "./identityVerificationSecurity";

test("profile name must match the provider-derived identity name", () => {
  const evidence = { verifiedNameHash: hashVerifiedName("Amara", "Okafor") };

  assert.equal(doesVerifiedNameMatch(evidence, "AMARA", "Okafor"), true);
  assert.equal(doesVerifiedNameMatch(evidence, "Amara", "Nwosu"), false);
  assert.equal(doesVerifiedNameMatch({}, "Amara", "Okafor"), false);
});

test("only explicit provider liveness is accepted", () => {
  assert.equal(isExplicitlyLive("LIVE"), true);
  assert.equal(isExplicitlyLive("verified"), true);
  assert.equal(isExplicitlyLive("pending"), false);
  assert.equal(isExplicitlyLive(undefined), false);
});