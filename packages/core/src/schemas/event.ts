import { z } from "zod";

export const CalendarEvent = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).nullable(),
  startAt: z.date(),
  endAt: z.date(),
  allDay: z.boolean(),
  rrule: z.string().nullable(),
  reminders: z.array(z.number().int()),
  linkedSessionId: z.string().uuid().nullable(),
  linkedTaskId: z.string().uuid().nullable(),
  source: z.enum(["local", "google", "outlook", "apple"]),
  externalId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;
