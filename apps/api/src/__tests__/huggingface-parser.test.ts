import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTaskWithHuggingFace } from "../ai-huggingface";
import { getAiRuntime, __resetAiRuntimeCache } from "../ai-runtime";
import { generateParsedTask, isAiEnabled } from "@fenced/ai";

describe("Hugging Face local LLM task parser", () => {
  it("parses task with priority, tags and date using local Hugging Face model", async () => {
    const res = await parseTaskWithHuggingFace({
      rawText: "Preparar documentació del projecte demà a les 10h !urgent #feina 30m",
      referenceDate: "2026-11-05T12:00:00.000Z",
    });

    assert.equal(res.title, "Preparar documentació del projecte");
    assert.equal(res.priority, "urgent");
    assert.deepEqual(res.tags, ["feina"]);
    assert.equal(res.estimateMinutes, 30);
    assert.ok(res.dueAt && res.dueAt.startsWith("2026-11-06"));
    assert.ok(res._hf, "Carries Hugging Face model metadata");
    assert.equal(res._hf.model, "Qwen/Qwen2.5-0.5B-Instruct");
  });

  it("integrates with getAiRuntime() when AI_PROVIDER=huggingface", async () => {
    const oldProvider = process.env.AI_PROVIDER;
    const oldEnabled = process.env.AI_ENABLED;
    try {
      process.env.AI_PROVIDER = "huggingface";
      process.env.AI_ENABLED = "true";
      __resetAiRuntimeCache();

      assert.equal(isAiEnabled(), true);
      const runtime = getAiRuntime();
      assert.ok(runtime, "Runtime should be available for huggingface provider");

      const parsed = await generateParsedTask(
        "adult",
        {
          rawText: "Comprar bitllets de tren demà a les 18h !high #viatge",
          referenceDate: "2026-11-05T12:00:00.000Z",
        },
        runtime,
      );

      assert.equal(parsed.title, "Comprar bitllets de tren");
      assert.equal(parsed.priority, "high");
      assert.deepEqual(parsed.tags, ["viatge"]);
      assert.ok(parsed.dueAt && parsed.dueAt.startsWith("2026-11-06"));
    } finally {
      process.env.AI_PROVIDER = oldProvider;
      process.env.AI_ENABLED = oldEnabled;
      __resetAiRuntimeCache();
    }
  });
});
