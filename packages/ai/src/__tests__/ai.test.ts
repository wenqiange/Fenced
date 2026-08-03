import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AiAccessError,
  assertLlmAccess,
  minimiseParsePayload,
  softPreferencesToKnobs,
  stripPii,
  generateParsedTask,
  __getProviderCallCount,
  __resetProviderCallCount,
  AiParsedTaskSchema,
  type AiRuntime,
} from "../index";

describe("@fenced/ai - gate", () => {
  it("denies child and teen before any provider call", () => {
    assert.throws(() => assertLlmAccess("child", "llm-parsing"), AiAccessError);
    assert.throws(() => assertLlmAccess("teen", "llm-parsing"), AiAccessError);
    assert.throws(() => assertLlmAccess(null, "llm-parsing"), AiAccessError);
    assert.doesNotThrow(() => assertLlmAccess("adult", "llm-parsing"));
  });

  it("never invokes the provider when gated", async () => {
    __resetProviderCallCount();
    const runtime: AiRuntime = {
      model: {} as AiRuntime["model"],
      generateObject: async () => {
        throw new Error("provider must not be called");
      },
    };
    await assert.rejects(
      () =>
        generateParsedTask(
          "teen",
          { rawText: "essay tomorrow", referenceDate: "2026-08-03" },
          runtime,
        ),
      AiAccessError,
    );
    assert.equal(__getProviderCallCount(), 0);
  });
});

describe("@fenced/ai - redact", () => {
  it("strips emails and phones from parse payloads", () => {
    const payload = minimiseParsePayload({
      rawText: "Call ada@example.com at +1 555-123-4567 about the deck",
      referenceDate: "2026-08-03T10:00:00.000Z",
      ambiguities: [{ kind: "meridiem", text: "at 9" }],
    });
    assert.match(payload.rawText, /\[email\]/);
    assert.match(payload.rawText, /\[phone\]/);
    assert.equal(payload.referenceDate, "2026-08-03");
  });

  it("stripPii is idempotent on clean text", () => {
    assert.equal(stripPii("Submit PR tomorrow"), "Submit PR tomorrow");
  });
});

describe("@fenced/ai - soft preferences", () => {
  it("maps closed prefs to scheduler knobs without inventing times", () => {
    const knobs = softPreferencesToKnobs([
      { kind: "prefer-mornings" },
      { kind: "defer-low-priority" },
      { kind: "batch-tag", tag: "Uni" },
    ]);
    assert.equal(knobs.dayStartHour, 8);
    assert.equal(knobs.dayEndHour, 12);
    assert.equal(knobs.deferLowPriority, true);
    assert.equal(knobs.batchTag, "uni");
    assert.equal("startAt" in knobs, false);
  });
});

describe("@fenced/ai - schema", () => {
  it("accepts a valid ParsedTask-shaped object", () => {
    const parsed = AiParsedTaskSchema.parse({
      title: "Essay",
      dueAt: "2026-08-04T15:00:00.000Z",
      estimateMinutes: 45,
      priority: "high",
      tags: ["uni"],
      rrule: null,
      recurrence: null,
      ambiguities: [],
      isAmbiguous: false,
    });
    assert.equal(parsed.title, "Essay");
  });

  it("rejects free-form schedule fields smuggled into advice shape", async () => {
    const { ReplanAdviceSchema } = await import("../schemas/replan");
    assert.throws(() =>
      ReplanAdviceSchema.parse({
        summary: "Move things",
        softPreferences: [{ kind: "prefer-mornings", startAt: "2026-08-03T09:00:00Z" }],
        suggestedHorizon: "today",
      }),
    );
  });
});
