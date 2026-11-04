import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isConsentActive } from "../consent";

describe("isConsentActive", () => {
  const at = new Date("2026-11-01T10:00:00Z");

  it("is false with no consent history", () => {
    assert.equal(isConsentActive(undefined), false);
  });

  it("is true when the latest event is a grant", () => {
    assert.equal(isConsentActive({ id: "a", grantedAt: at, revokedAt: null }), true);
  });

  it("is false when the latest event is a revocation, even though an older grant row exists", () => {
    // The webhook appends revocations as their own row with grantedAt null.
    assert.equal(isConsentActive({ id: "b", grantedAt: null, revokedAt: at }), false);
  });

  it("is false for a grant that was later marked revoked in place", () => {
    assert.equal(isConsentActive({ id: "c", grantedAt: at, revokedAt: at }), false);
  });
});
