import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import { router, authedProcedure } from "../init";
import { fencedHours, fences } from "../../db/schema";

export const fencedHoursRouter = router({
  create: authedProcedure
    .input(
      z.object({
        fenceId: z.string().uuid(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        strictDelayMinutes: z.number().int().min(0).default(0),
        enabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fence = await ctx.db.query.fences.findFirst({
        where: and(eq(fences.id, input.fenceId), eq(fences.userId, ctx.userId)),
      });
      if (!fence) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Fence does not belong to user",
        });
      }

      if (
        ctx.ageBand === "child" &&
        input.strictDelayMinutes > MAX_STRICT_DELAY_CHILD
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Child accounts cannot exceed ${MAX_STRICT_DELAY_CHILD} minutes strict delay`,
        });
      }

      const [hours] = await ctx.db
        .insert(fencedHours)
        .values({
          userId: ctx.userId,
          fenceId: input.fenceId,
          daysOfWeek: input.daysOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          strictDelayMinutes: input.strictDelayMinutes,
          enabled: input.enabled,
        })
        .returning();
      return hours;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        strictDelayMinutes: z.number().int().min(0).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;

      if (
        ctx.ageBand === "child" &&
        input.strictDelayMinutes !== undefined &&
        input.strictDelayMinutes > MAX_STRICT_DELAY_CHILD
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Child accounts cannot exceed ${MAX_STRICT_DELAY_CHILD} minutes strict delay`,
        });
      }

      const [hours] = await ctx.db
        .update(fencedHours)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(fencedHours.id, id), eq(fencedHours.userId, ctx.userId)))
        .returning();
      if (!hours) throw new TRPCError({ code: "NOT_FOUND" });
      return hours;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [hours] = await ctx.db
        .delete(fencedHours)
        .where(and(eq(fencedHours.id, input.id), eq(fencedHours.userId, ctx.userId)))
        .returning();
      if (!hours) throw new TRPCError({ code: "NOT_FOUND" });
      return hours;
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.fencedHours.findMany({
      where: eq(fencedHours.userId, ctx.userId),
      orderBy: (h, { asc }) => [asc(h.startTime)],
    });
  }),
});
