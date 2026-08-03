import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getConsentAge, resolveAgeBand } from "../age-band";
import { canAccess } from "../feature-access";

describe("@fenced/policy - Compliance & Feature Access Rules", () => {
  it("resolves consent age by jurisdiction", () => {
    assert.equal(getConsentAge("US"), 13);
    assert.equal(getConsentAge("GB"), 13);
    assert.equal(getConsentAge("ES"), 14);
    assert.equal(getConsentAge("DE"), 16);
    assert.equal(getConsentAge("UnknownCountry"), 16);
  });

  it("resolves age bands correctly", () => {
    assert.equal(resolveAgeBand(10, "US"), "child");
    assert.equal(resolveAgeBand(14, "US"), "adult");
    assert.equal(resolveAgeBand(15, "DE"), "teen");
    assert.equal(resolveAgeBand(17, "DE"), "adult");
  });

  it("enforces feature access permissions by age band", () => {
    // Child restrictions
    assert.equal(canAccess("focus-sessions", "child"), true);
    assert.equal(canAccess("llm-parsing", "child"), false);
    assert.equal(canAccess("product-analytics", "child"), false);

    // Teen permissions
    assert.equal(canAccess("focus-sessions", "teen"), true);
    assert.equal(canAccess("llm-parsing", "teen"), false);
    assert.equal(canAccess("leaderboards", "teen"), true);

    // Adult permissions
    assert.equal(canAccess("llm-parsing", "adult"), true);
    assert.equal(canAccess("llm-replan-advice", "adult"), true);
    assert.equal(canAccess("llm-weekly-coach", "adult"), true);
    assert.equal(canAccess("llm-planning-chat", "adult"), true);
    assert.equal(canAccess("product-analytics", "adult"), true);

    assert.equal(canAccess("llm-replan-advice", "teen"), false);
    assert.equal(canAccess("llm-weekly-coach", "child"), false);
  });
});
