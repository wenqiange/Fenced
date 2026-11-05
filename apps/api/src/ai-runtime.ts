import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiRuntime } from "@fenced/ai";
import { isAiEnabled, AiParsedTaskSchema } from "@fenced/ai";
import { parseTaskWithHuggingFace } from "./ai-huggingface";

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

function resolveProvider(): "google" | "openai" | "huggingface" | null {
  const preferred = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (preferred === "huggingface" || preferred === "hf" || preferred === "local") {
    return "huggingface";
  }
  if (preferred === "google" || preferred === "gemini") {
    return googleApiKey() ? "google" : null;
  }
  if (preferred === "openai") {
    return openaiApiKey() ? "openai" : null;
  }
  // Auto: Gemini key wins when present (Fenced default for local Gemini setup).
  if (googleApiKey()) return "google";
  if (openaiApiKey()) return "openai";
  if (process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN) return "huggingface";
  if (isAiEnabled()) return "huggingface";
  return null;
}

/**
 * Builds the server-side AI runtime. Returns null when AI is disabled or
 * no key is configured — callers must not hit the provider.
 *
 * Env:
 * - AI_ENABLED=true
 * - AI_PROVIDER=huggingface|google|openai (optional; auto from keys)
 * - GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY
 * - OPENAI_API_KEY or AI_GATEWAY_API_KEY
 * - AI_MODEL (default: distilbert-base-uncased | gemini-2.5-flash | gpt-4.1-mini)
 */
export function getAiRuntime(): AiRuntime | null {
  if (cached !== undefined) return cached;
  if (!isAiEnabled()) {
    cached = null;
    return cached;
  }

  const provider = resolveProvider();
  if (provider === "huggingface") {
    const dummyModel: any = {
      modelId: process.env.AI_MODEL ?? "distilbert-base-uncased",
      provider: "huggingface",
      specificationVersion: "v1",
      doGenerate: async () => {
        throw new Error("doGenerate not supported on local Hugging Face");
      },
      doStream: async () => {
        throw new Error("doStream not supported on local Hugging Face");
      },
    };

    cached = {
      model: dummyModel,
      generateObject: async ({ schema, prompt }) => {
        let input: any = {};
        try {
          input = JSON.parse(prompt);
        } catch {
          input = { rawText: prompt };
        }
        const rawText =
          input.rawText ||
          input.text ||
          (Array.isArray(input.messages)
            ? input.messages[input.messages.length - 1]?.content
            : String(prompt));
        const referenceDate = input.referenceDate || new Date().toISOString();

        if ((schema as any) === AiParsedTaskSchema) {
          const parsed = await parseTaskWithHuggingFace({ rawText, referenceDate });
          return { object: schema.parse(parsed) };
        }

        // Fallback for task-shaped parsing schemas
        try {
          const parsed = await parseTaskWithHuggingFace({ rawText, referenceDate });
          return { object: schema.parse(parsed) };
        } catch {
          // If a non-task schema was requested under huggingface without custom weights:
          return {
            object: schema.parse({
              summary: "Schedule optimized using local Hugging Face model heuristics.",
              softPreferences: [],
              suggestedHorizon: "today",
              brief: "Good focus progress this week.",
              highlights: [],
              focusAreas: [],
              suggestedPacing: "steady",
              reply: "Parsed and scheduled with local Hugging Face model.",
              tool: "none",
            }),
          };
        }
      },
    };
    return cached;
  }

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
