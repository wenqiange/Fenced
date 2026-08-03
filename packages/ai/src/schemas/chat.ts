import { z } from "zod";
import { SoftPreferenceSchema } from "./replan";

/** Allowlisted tools the planning chat may propose — never calendar writes. */
export const PlanningToolNameSchema = z.enum([
  "propose_schedule",
  "parse_task",
  "none",
]);

export const PlanningChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2000),
});

export const PlanningChatInputSchema = z.object({
  messages: z.array(PlanningChatMessageSchema).min(1).max(12),
});

export type PlanningChatInput = z.infer<typeof PlanningChatInputSchema>;

export const PlanningChatReplySchema = z.object({
  reply: z.string().min(1).max(1000),
  tool: PlanningToolNameSchema,
  softPreferences: z.array(SoftPreferenceSchema).max(6),
  parseText: z.string().max(500).nullable(),
  suggestedHorizon: z.enum(["today", "week"]).nullable(),
});

export type PlanningChatReply = z.infer<typeof PlanningChatReplySchema>;

export const PLANNING_TOOL_ALLOWLIST = [
  "propose_schedule",
  "parse_task",
  "none",
] as const;
