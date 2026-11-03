import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import { router, authedProcedure, existingOrConflict } from "../init";
import { fencedHours, fences } from "../../db/schema";

const LabelSchema = z
  .string()
  .min(1)
  .max(80)
  .transform((v) => v.replace(/<[^>]*>/g, "").trim());
const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const fencedHoursRouter = router({
  create: authedProcedure
    .input(
      z.object({
        /** Client-generated id: makes a retried offline create idempotent. */
        id: z.string().uuid().optional(),
        fenceId: z.string().uuid(),
        label: LabelSchema.default("Fenced hour"),
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
          id: input.id,
          userId: ctx.userId,
          fenceId: input.fenceId,
          label: input.label,
          daysOfWeek: input.daysOfWeek,
          startTime: input.startTime,
          endTime: input.endTime,
          strictDelayMinutes: input.strictDelayMinutes,
          enabled: input.enabled,
        })
        .onConflictDoNothing({ target: fencedHours.id })
        .returning();
      if (hours) return hours;
      return existingOrConflict(
        await ctx.db.query.fencedHours.findFirst({
          where: and(eq(fencedHours.id, input.id!), eq(fencedHours.userId, ctx.userId)),
        }),
      );
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: LabelSchema.optional(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        strictDelayMinutes: z.number().int().min(0).optional(),
        enabled: z.boolean().optional(),
        /** Full replacement; the client keeps only recent dates. */
        skippedDates: z.array(DateKeySchema).max(60).optional(),
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

  /** Skip one occurrence. `date` is the device-local day (YYYY-MM-DD). */
  skipToday: authedProcedure
    .input(z.object({ id: z.string().uuid(), date: DateKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const [hours] = await ctx.db
        .update(fencedHours)
        .set({
          // jsonb set-union keeps the call idempotent under retries.
          skippedDates: sql`(
            SELECT coalesce(jsonb_agg(DISTINCT d), '[]'::jsonb)
            FROM jsonb_array_elements_text(${fencedHours.skippedDates} || to_jsonb(${input.date}::text)) AS d
          )`,
          updatedAt: new Date(),
        })
        .where(and(eq(fencedHours.id, input.id), eq(fencedHours.userId, ctx.userId)))
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
