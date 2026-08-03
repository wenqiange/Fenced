import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiRuntime } from "@fenced/ai";
import { isAiEnabled } from "@fenced/ai";

let cached: AiRuntime | null | undefined;

function googleApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    undefined
  );
}

function openaiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY ?? process.env.AI_GATEWAY_API_KEY ?? undefined;
}

function resolveProvider(): "google" | "openai" | null {
  const preferred = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (preferred === "google" || preferred === "gemini") {
    return googleApiKey() ? "google" : null;
  }
  if (preferred === "openai") {
    return openaiApiKey() ? "openai" : null;
  }
  // Auto: Gemini key wins when present (Fenced default for local Gemini setup).
  if (googleApiKey()) return "google";
  if (openaiApiKey()) return "openai";
  return null;
}

/**
 * Builds the server-side AI runtime. Returns null when AI is disabled or
 * no key is configured — callers must not hit the provider.
 *
 * Env:
 * - AI_ENABLED=true
 * - AI_PROVIDER=google|openai (optional; auto from keys)
 * - GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY
 * - OPENAI_API_KEY or AI_GATEWAY_API_KEY
 * - AI_MODEL (default: gemini-2.5-flash | gpt-4.1-mini)
 */
export function getAiRuntime(): AiRuntime | null {
  if (cached !== undefined) return cached;
  if (!isAiEnabled()) {
    cached = null;
    return cached;
  }

  const provider = resolveProvider();
  if (provider === "google") {
    const apiKey = googleApiKey()!;
    const google = createGoogleGenerativeAI({ apiKey });
    const modelId = process.env.AI_MODEL ?? "gemini-2.5-flash";
    cached = { model: google(modelId) };
    return cached;
  }

  if (provider === "openai") {
    const apiKey = openaiApiKey()!;
    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.AI_GATEWAY_URL,
    });
    const modelId = process.env.AI_MODEL ?? "gpt-4.1-mini";
    cached = { model: openai(modelId) };
    return cached;
  }

  cached = null;
  return cached;
}

/** Test helper */
export function __resetAiRuntimeCache() {
  cached = undefined;
}
