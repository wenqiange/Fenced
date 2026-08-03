import type { AgeBand } from "@fenced/core";
import { canAccess, type Feature } from "@fenced/policy";

export class AiAccessError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "AI features are adult-only") {
    super(message);
    this.name = "AiAccessError";
  }
}

/**
 * Hard gate for every AI entrypoint. Null/undefined band defaults to deny
 * (same posture as analytics). Must run before any provider call.
 */
export function assertLlmAccess(
  ageBand: AgeBand | string | null | undefined,
  feature: Feature = "llm-parsing",
): asserts ageBand is AgeBand {
  const band = (ageBand ?? "child") as AgeBand;
  if (!canAccess(feature, band)) {
    throw new AiAccessError();
  }
}

export function isAiEnabled(): boolean {
  const flag = process.env.AI_ENABLED;
  if (flag === "false" || flag === "0") return false;
  return Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY,
  );
}
