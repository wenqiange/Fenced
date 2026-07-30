import { z } from "zod";

export const Streak = z.object({
  userId: z.string().uuid(),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastSessionDate: z.string().nullable(),
  updatedAt: z.date(),
});
export type Streak = z.infer<typeof Streak>;
