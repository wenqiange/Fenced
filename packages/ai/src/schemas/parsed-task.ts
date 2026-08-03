import { z } from "zod";
import { Priority } from "@fenced/core";

export const AmbiguityKindSchema = z.enum([
  "empty-title",
  "dangling-temporal",
  "meridiem",
  "recurrence-end",
]);

export const AmbiguitySchema = z.object({
  kind: AmbiguityKindSchema,
  text: z.string(),
  message: z.string(),
  options: z.array(z.string()).optional(),
});

export const RecurrenceFreqSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

export const ParsedRecurrenceSchema = z.object({
  rrule: z.string(),
  freq: RecurrenceFreqSchema,
  interval: z.number().int().positive(),
  byDay: z.array(z.string()),
  byMonthDay: z.array(z.number().int()),
  until: z.string().datetime().nullable(),
  count: z.number().int().positive().nullable(),
});

/** Structured LLM output — same shape as @fenced/nlp ParsedTask (dates as ISO strings). */
export const AiParsedTaskSchema = z.object({
  title: z.string().min(1).max(500),
  dueAt: z.string().datetime().nullable(),
  estimateMinutes: z.number().int().positive().nullable(),
  priority: Priority,
  tags: z.array(z.string().max(40)).max(20),
  rrule: z.string().nullable(),
  recurrence: ParsedRecurrenceSchema.nullable(),
  ambiguities: z.array(AmbiguitySchema),
  isAmbiguous: z.boolean(),
});

export type AiParsedTask = z.infer<typeof AiParsedTaskSchema>;
