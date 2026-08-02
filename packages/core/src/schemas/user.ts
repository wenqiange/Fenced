import { z } from "zod";

export const AgeBand = z.enum(["child", "teen", "adult"]);
export type AgeBand = z.infer<typeof AgeBand>;

export const AssuranceMethod = z.enum([
  "declared-age-range-guardian",
  "declared-age-range-self",
  "neutral-screen",
]);
export type AssuranceMethod = z.infer<typeof AssuranceMethod>;

export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  displayName: z.string().min(1).max(100),
  ageBand: AgeBand,
  jurisdiction: z.string().min(2).max(5),
  assuranceMethod: AssuranceMethod,
  assuranceAt: z.date(),
  childrensCodeApplies: z.boolean(),
  timezone: z.string().default("UTC"),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof User>;
