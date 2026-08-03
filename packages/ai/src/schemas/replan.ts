import { z } from "zod";

/**
 * Closed preference set. The LLM may only emit these — never free-form
 * startAt/endAt. The deterministic scheduler interprets them.
 */
export const SoftPreferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prefer-mornings") }).strict(),
  z.object({ kind: z.literal("prefer-afternoons") }).strict(),
  z.object({ kind: z.literal("protect-fenced-hours") }).strict(),
  z.object({ kind: z.literal("defer-low-priority") }).strict(),
  z.object({ kind: z.literal("batch-tag"), tag: z.string().min(1).max(40) }).strict(),
]);

export type SoftPreference = z.infer<typeof SoftPreferenceSchema>;

export const ReplanSummaryInputSchema = z.object({
  horizon: z.enum(["today", "week"]),
  freeMinutes: z.number().int().min(0),
  usedMinutes: z.number().int().min(0),
  reasonCounts: z.record(z.string(), z.number().int().min(0)).default({}),
  unplaced: z
    .array(
      z.object({
        title: z.string().max(80),
        unmetMinutes: z.number().int().min(0),
        reason: z.string().max(40),
      }),
    )
    .max(30),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

export type ReplanSummaryInput = z.infer<typeof ReplanSummaryInputSchema>;

export const ReplanAdviceSchema = z.object({
  summary: z.string().min(1).max(600),
  softPreferences: z.array(SoftPreferenceSchema).max(6),
  suggestedHorizon: z.enum(["today", "week"]),
});

export type ReplanAdvice = z.infer<typeof ReplanAdviceSchema>;
