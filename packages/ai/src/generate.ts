import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";
import { AiAccessError, assertLlmAccess, isAiEnabled } from "./gate";
import {
  COACH_SYSTEM,
  CHAT_SYSTEM,
  PARSE_TASK_SYSTEM,
  REPLAN_SYSTEM,
} from "./prompts";
import {
  minimiseChatPayload,
  minimiseCoachPayload,
  minimiseParsePayload,
  minimiseReplanPayload,
} from "./redact";
import {
  AiParsedTaskSchema,
  type AiParsedTask,
} from "./schemas/parsed-task";
import {
  PlanningChatReplySchema,
  type PlanningChatInput,
  type PlanningChatReply,
} from "./schemas/chat";
import {
  WeeklyCoachBriefSchema,
  WeeklyMetricsSchema,
  type WeeklyCoachBrief,
  type WeeklyMetrics,
} from "./schemas/coach";
import {
  ReplanAdviceSchema,
  ReplanSummaryInputSchema,
  type ReplanAdvice,
  type ReplanSummaryInput,
} from "./schemas/replan";
import type { AgeBand } from "@fenced/core";
import type { Feature } from "@fenced/policy";

export type GenerateObjectFn = <T>(args: {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature: number;
}) => Promise<{ object: T }>;

export interface AiRuntime {
  model: LanguageModel;
  generateObject?: GenerateObjectFn;
}

let providerCallCount = 0;

/** Test helper — resets and exposes provider invocation count. */
export function __resetProviderCallCount() {
  providerCallCount = 0;
}

export function __getProviderCallCount() {
  return providerCallCount;
}

async function runGenerate<T>(
  runtime: AiRuntime | null,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  temperature: number,
): Promise<T> {
  if (!runtime) {
    throw new Error("AI runtime is not configured");
  }
  providerCallCount += 1;

  let object: unknown;
  if (runtime.generateObject) {
    const result = await runtime.generateObject({
      model: runtime.model,
      schema,
      system,
      prompt,
      temperature,
    });
    object = result.object;
  } else {
    const result = await generateObject({
      model: runtime.model,
      schema,
      system,
      prompt,
      temperature,
    });
    object = result.object;
  }

  return schema.parse(object);
}

function requireEnabled(runtime: AiRuntime | null) {
  // Injected runtime (tests) bypasses env kill switch.
  if (runtime) return;
  if (!isAiEnabled()) {
    throw new Error(
      "AI is disabled (set AI_ENABLED=true and GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY)",
    );
  }
}

function gate(ageBand: AgeBand | string | null | undefined, feature: Feature) {
  try {
    assertLlmAccess(ageBand, feature);
  } catch (err) {
    if (err instanceof AiAccessError) throw err;
    throw err;
  }
}

export async function generateParsedTask(
  ageBand: AgeBand | string | null | undefined,
  input: {
    rawText: string;
    referenceDate: string;
    ambiguities?: Array<{ kind: string; text: string }>;
  },
  runtime: AiRuntime | null,
): Promise<AiParsedTask> {
  gate(ageBand, "llm-parsing");
  requireEnabled(runtime);
  const payload = minimiseParsePayload(input);
  return runGenerate(
    runtime,
    AiParsedTaskSchema,
    PARSE_TASK_SYSTEM,
    JSON.stringify(payload),
    0.1,
  );
}

export async function generateReplanAdvice(
  ageBand: AgeBand | string | null | undefined,
  input: ReplanSummaryInput,
  runtime: AiRuntime | null,
): Promise<ReplanAdvice> {
  gate(ageBand, "llm-replan-advice");
  requireEnabled(runtime);
  const parsed = ReplanSummaryInputSchema.parse(input);
  const payload = minimiseReplanPayload(parsed);
  return runGenerate(
    runtime,
    ReplanAdviceSchema,
    REPLAN_SYSTEM,
    JSON.stringify(payload),
    0.2,
  );
}

export async function generateWeeklyCoach(
  ageBand: AgeBand | string | null | undefined,
  metrics: WeeklyMetrics,
  runtime: AiRuntime | null,
): Promise<WeeklyCoachBrief> {
  gate(ageBand, "llm-weekly-coach");
  requireEnabled(runtime);
  const parsed = WeeklyMetricsSchema.parse(metrics);
  const payload = minimiseCoachPayload(parsed);
  return runGenerate(
    runtime,
    WeeklyCoachBriefSchema,
    COACH_SYSTEM,
    JSON.stringify(payload),
    0.3,
  );
}

export async function generatePlanningChat(
  ageBand: AgeBand | string | null | undefined,
  input: PlanningChatInput,
  runtime: AiRuntime | null,
): Promise<PlanningChatReply> {
  gate(ageBand, "llm-planning-chat");
  requireEnabled(runtime);
  const payload = minimiseChatPayload(input.messages);
  return runGenerate(
    runtime,
    PlanningChatReplySchema,
    CHAT_SYSTEM,
    JSON.stringify({ messages: payload }),
    0.3,
  );
}
