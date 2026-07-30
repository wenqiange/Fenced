import { z } from "zod";

export const ConsentEvent = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  guardianEmail: z.string().email(),
  method: z.string(),
  scope: z.string(),
  noticeVersion: z.string(),
  grantedAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
});
export type ConsentEvent = z.infer<typeof ConsentEvent>;
