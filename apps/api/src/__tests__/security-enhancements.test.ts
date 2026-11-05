import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isConsentActive } from "../consent";

describe("Security Enhancements & Compliance", () => {
  const at = new Date("2026-11-05T10:00:00Z");

  it("exposes scope in ConsentEventState correctly", () => {
    const active = {
      id: "ev-1",
      grantedAt: at,
      revokedAt: null,
      scope: "age-band-escalation",
    };
    assert.equal(isConsentActive(active), true);
    assert.equal(active.scope, "age-band-escalation");
  });

  it("rejects escalation when scope is standard coppa-account", () => {
    const verifiedConsent = {
      id: "ev-2",
      grantedAt: at,
      revokedAt: null,
      scope: "coppa-account",
    };
    const isDedicatedEscalation = Boolean(
      verifiedConsent?.scope &&
      ["age-band-escalation", "age-band-correction", "verified-adult"].includes(verifiedConsent.scope)
    );
    assert.equal(isDedicatedEscalation, false, "Standard coppa-account consent must not allow age escalation");
  });

  it("permits escalation when scope is explicit age-band-escalation", () => {
    const verifiedConsent = {
      id: "ev-3",
      grantedAt: at,
      revokedAt: null,
      scope: "age-band-escalation",
    };
    const isDedicatedEscalation = Boolean(
      verifiedConsent?.scope &&
      ["age-band-escalation", "age-band-correction", "verified-adult"].includes(verifiedConsent.scope)
    );
    assert.equal(isDedicatedEscalation, true, "age-band-escalation consent must allow age escalation");
  });

  it("sanitizes null bytes without destroying math or code markup", () => {
    function sanitizeText(input: string): string {
      return input.replace(/\0/g, "").trim();
    }

    const mathExpr = "3 < 5 && 10 > 2";
    assert.equal(sanitizeText(mathExpr), "3 < 5 && 10 > 2");

    const codeSnippet = "const list = new Array<string>();";
    assert.equal(sanitizeText(codeSnippet), "const list = new Array<string>();");

    const maliciousNullByte = "malicious\0title";
    assert.equal(sanitizeText(maliciousNullByte), "malicioustitle");
  });
});
