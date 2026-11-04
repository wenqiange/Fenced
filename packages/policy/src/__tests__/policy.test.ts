import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getConsentAge, isMinor, resolveAgeBand, resolveConsentBand } from "../age-band";
import { canAccess, requiresParentalConsent } from "../feature-access";

describe("@fenced/policy - Compliance & Feature Access Rules", () => {
  it("resolves consent age by jurisdiction", () => {
    assert.equal(getConsentAge("US"), 13);
    assert.equal(getConsentAge("GB"), 13);
    assert.equal(getConsentAge("ES"), 14);
    assert.equal(getConsentAge("DE"), 16);
    assert.equal(getConsentAge("UnknownCountry"), 16);
  });

  it("resolves age bands correctly and protects minors under 18", () => {
    assert.equal(resolveAgeBand(10, "US"), "child");
    assert.equal(resolveAgeBand(14, "US"), "teen");
    assert.equal(resolveAgeBand(15, "ES"), "teen");
    assert.equal(resolveAgeBand(17, "DE"), "teen");
    assert.equal(resolveAgeBand(18, "US"), "adult");
    assert.equal(resolveAgeBand(25, "ES"), "adult");

    assert.equal(isMinor(14), true);
    assert.equal(isMinor(17), true);
    assert.equal(isMinor(18), false);

    assert.equal(resolveConsentBand(14, "US"), "adult");
    assert.equal(resolveConsentBand(15, "DE"), "teen");
  });

  it("enforces feature access permissions by age band", () => {
    // Child restrictions
    assert.equal(canAccess("focus-sessions", "child"), true);
    assert.equal(canAccess("llm-parsing", "child"), false);
    assert.equal(canAccess("product-analytics", "child"), false);

    // Teen restrictions (minors under 18)
    assert.equal(canAccess("focus-sessions", "teen"), true);
    assert.equal(canAccess("llm-parsing", "teen"), false);
    assert.equal(canAccess("leaderboards", "teen"), true);

    // Minors are denied adult-only features even if flagged adult
    assert.equal(canAccess("llm-parsing", "adult", { isMinor: true }), false);
    assert.equal(canAccess("product-analytics", "adult", { isMinor: true }), false);
    assert.equal(canAccess("focus-sessions", "adult", { isMinor: true }), true);

    // True adult permissions (18+)
    assert.equal(canAccess("llm-parsing", "adult"), true);
    assert.equal(canAccess("llm-replan-advice", "adult"), true);
    assert.equal(canAccess("llm-weekly-coach", "adult"), true);
    assert.equal(canAccess("llm-planning-chat", "adult"), true);
    assert.equal(canAccess("product-analytics", "adult"), true);

    assert.equal(canAccess("llm-replan-advice", "teen"), false);
    assert.equal(canAccess("llm-weekly-coach", "child"), false);

    // Fail closed on unknown age bands
    assert.equal(canAccess("focus-sessions", "invalid_band" as any), false);
    assert.equal(canAccess("llm-parsing", "unknown" as any), false);
  });

  it("withholds external calendar linking from children only", () => {
    // A child's schedule must not be shipped to a provider account without
    // verifiable parental consent; a teen's own account is theirs to link.
    assert.equal(canAccess("external-calendar-sync", "child"), false);
    assert.equal(canAccess("external-calendar-sync", "teen"), true);
    assert.equal(canAccess("external-calendar-sync", "adult"), true);
  });

  it("restricts publishing a shareable calendar link to adults", () => {
    // The feed URL is a capability anyone can hold, and the UK Children's Code
    // covers every under-18 — so neither minor band may publish one.
    assert.equal(canAccess("calendar-feed-publish", "child"), false);
    assert.equal(canAccess("calendar-feed-publish", "teen"), false);
    assert.equal(canAccess("calendar-feed-publish", "adult"), true);
  });

  it("keeps the one-off data export available to every band", () => {
    // Portability is a right, and the file goes to the user, not the internet.
    assert.equal(canAccess("data-export", "child"), true);
    assert.equal(canAccess("data-export", "teen"), true);
    assert.equal(canAccess("data-export", "adult"), true);
  });
});

it("every child account needs guardian consent, in any jurisdiction", () => {
  for (const j of ["US", "GB", "DE", "ES", "BR"]) {
    assert.equal(requiresParentalConsent("child", j), true, j);
    assert.equal(requiresParentalConsent("teen", j), false, j);
    assert.equal(requiresParentalConsent("adult", j), false, j);
  }
});
