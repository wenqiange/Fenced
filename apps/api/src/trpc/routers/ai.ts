import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  AiAccessError,
  generateParsedTask,
  generatePlanningChat,
  generateReplanAdvice,
  generateWeeklyCoach,
  PlanningChatInputSchema,
  ReplanSummaryInputSchema,
  WeeklyMetricsSchema,
  isAiEnabled,
} from "@fenced/ai";
import type { AgeBand } from "@fenced/core";
import { router, authedProcedure } from "../init";
import { getAiRuntime } from "../../ai-runtime";
import { enforceAiQuota } from "../../ai-quota";

function mapAiError(err: unknown): never {
  // Quota/access errors already carry the right tRPC code — pass them
  // through untouched instead of flattening them into a generic 500.
  if (err instanceof TRPCError) {
    throw err;
  }
  if (err instanceof AiAccessError) {
    throw new TRPCError({ code: "FORBIDDEN", message: err.message });
  }
  if (err instanceof Error && /disabled|not configured/i.test(err.message)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI suggestions are temporarily unavailable",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "AI request failed",
  });
}

function ageBandFromCtx(ageBand: string | undefined): AgeBand | null {
  if (ageBand === "child" || ageBand === "teen" || ageBand === "adult") {
    return ageBand;
  }
  return null;
}

export const aiRouter = router({
  /** Adult-only NLP fallback. Returns ParsedTask-shaped JSON; never writes tasks. */
  parseTask: authedProcedure
    .input(
      z.object({
        rawText: z.string().min(1).max(500),
        referenceDate: z.string().datetime(),
        ambiguities: z
          .array(
            z.object({
              kind: z.string(),
              text: z.string(),
            }),
          )
          .max(6)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!isAiEnabled()) {
          throw new Error("AI is disabled");
        }
        await enforceAiQuota(ctx.userId);
        return await generateParsedTask(
          ageBandFromCtx(ctx.ageBand),
          input,
          getAiRuntime(),
        );
      } catch (err) {
        mapAiError(err);
      }
    }),

  /** Soft-preference advice over an already-computed schedule summary. */
  adviseReplan: authedProcedure
    .input(ReplanSummaryInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!isAiEnabled()) {
          throw new Error("AI is disabled");
        }
        await enforceAiQuota(ctx.userId);
        return await generateReplanAdvice(
          ageBandFromCtx(ctx.ageBand),
          input,
          getAiRuntime(),
        );
      } catch (err) {
        mapAiError(err);
      }
    }),

  /** Weekly coach from aggregate metrics only. */
  weeklyCoach: authedProcedure
    .input(WeeklyMetricsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!isAiEnabled()) {
          throw new Error("AI is disabled");
        }
        await enforceAiQuota(ctx.userId);
        return await generateWeeklyCoach(
          ageBandFromCtx(ctx.ageBand),
          input,
          getAiRuntime(),
        );
      } catch (err) {
        mapAiError(err);
      }
    }),

  /**
   * Short planning chat. Tools are allowlisted to propose_schedule / parse_task /
   * none — never calendar writes.
   */
  planningChat: authedProcedure
    .input(PlanningChatInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!isAiEnabled()) {
          throw new Error("AI is disabled");
        }
        await enforceAiQuota(ctx.userId);
        return await generatePlanningChat(
          ageBandFromCtx(ctx.ageBand),
          input,
          getAiRuntime(),
        );
      } catch (err) {
        mapAiError(err);
      }
    }),
});
