import { z } from "zod";

/** Aggregated numbers only — never task titles or note content. */
export const WeeklyMetricsSchema = z.object({
  focusMinutes: z.number().int().min(0),
  shieldHits: z.number().int().min(0),
  sessionsCompleted: z.number().int().min(0),
  completionRate: z.number().min(0).max(100),
  streakDays: z.number().int().min(0),
  estimateAccuracy: z.number().min(0).max(100).nullable().default(null),
  weekdayFocusMinutes: z.array(z.number().int().min(0)).length(7).optional(),
});

export type WeeklyMetrics = z.infer<typeof WeeklyMetricsSchema>;

export const WeeklyCoachBriefSchema = z.object({
  headline: z.string().min(1).max(160),
  bullets: z.array(z.string().max(200)).min(1).max(5),
  nextAction: z.string().min(1).max(200),
});

export type WeeklyCoachBrief = z.infer<typeof WeeklyCoachBriefSchema>;
