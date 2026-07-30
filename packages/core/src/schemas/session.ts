import { z } from "zod";

export const SessionStatus = z.enum(["armed", "active", "completed", "abandoned"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Session = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fenceId: z.string().uuid(),
  status: SessionStatus,
  presetName: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  strictDelayMinutes: z.number().int().min(0),
  shieldHits: z.number().int().min(0),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  abandonedAt: z.date().nullable(),
  linkedTaskId: z.string().uuid().nullable(),
  createdAt: z.date(),
});
export type Session = z.infer<typeof Session>;

export const Fence = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  appTokens: z.array(z.string()),
  categoryTokens: z.array(z.string()),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Fence = z.infer<typeof Fence>;

export const FencedHours = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fenceId: z.string().uuid(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  strictDelayMinutes: z.number().int().min(0),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type FencedHours = z.infer<typeof FencedHours>;
