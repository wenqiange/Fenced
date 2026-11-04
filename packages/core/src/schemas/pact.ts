import { z } from "zod";

export const FamilyPactRuleSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["daily_focus_target", "emergency_passes", "curfew", "allowed_educational_apps"]),
  description: z.string().min(1).max(300),
  targetValue: z.number().int().min(0),
  allowedTokens: z.array(z.string()).default([]),
});

export const FamilyPactSchema = z.object({
  id: z.string().uuid(),
  guardianEmail: z.string().email(),
  studentDisplayName: z.string().min(1).max(100),
  status: z.enum(["draft", "active", "renewed", "cancelled"]).default("active"),
  rules: z.array(FamilyPactRuleSchema),
  guardianSignedAt: z.string().datetime().nullable(),
  studentSignedAt: z.string().datetime().nullable(),
  version: z.number().int().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FamilyPactRule = z.infer<typeof FamilyPactRuleSchema>;
export type FamilyPact = z.infer<typeof FamilyPactSchema>;

/**
 * Feature 8 (The Family Pact):
 * Validates whether the current week's activity satisfies the agreed family pact.
 */
export function validatePactCompliance(
  pact: FamilyPact,
  metrics: {
    weeklyFocusMinutes: number;
    emergencyPassesUsed: number;
  },
): {
  compliant: boolean;
  targetMet: boolean;
  passesUnderBudget: boolean;
  summary: string;
} {
  const dailyTargetRule = pact.rules.find((r) => r.type === "daily_focus_target");
  const passRule = pact.rules.find((r) => r.type === "emergency_passes");

  const weeklyTargetMins = (dailyTargetRule?.targetValue ?? 60) * 5; // 5 school days
  const maxPasses = passRule?.targetValue ?? 3;

  const targetMet = metrics.weeklyFocusMinutes >= weeklyTargetMins;
  const passesUnderBudget = metrics.emergencyPassesUsed <= maxPasses;

  return {
    compliant: targetMet && passesUnderBudget,
    targetMet,
    passesUnderBudget,
    summary: targetMet
      ? `Goal achieved: ${metrics.weeklyFocusMinutes}/${weeklyTargetMins} min focused.`
      : `In progress: ${metrics.weeklyFocusMinutes}/${weeklyTargetMins} min completed.`,
  };
}
