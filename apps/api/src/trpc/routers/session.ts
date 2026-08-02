import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import { router, authedProcedure } from "../init";
import { sessions, streaks, fences } from "../../db/schema";

export const sessionRouter = router({
  create: authedProcedure
    .input(
      z.object({
        fenceId: z.string().uuid(),
        durationMinutes: z.number().int().positive(),
        strictDelayMinutes: z.number().int().min(0).default(0),
        presetName: z.string().optional(),
        linkedTaskId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate fence ownership
      const userFence = await ctx.db.query.fences.findFirst({
        where: and(eq(fences.id, input.fenceId), eq(fences.userId, ctx.userId)),
      });
      if (!userFence) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Selected fence does not belong to the user",
        });
      }

      // Enforce age band restrictions for child strict delay
      if (
        ctx.ageBand === "child" &&
        input.strictDelayMinutes > MAX_STRICT_DELAY_CHILD
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Child accounts cannot exceed a ${MAX_STRICT_DELAY_CHILD}-minute strict mode delay`,
        });
      }

      const [session] = await ctx.db
        .insert(sessions)
        .values({
          userId: ctx.userId,
          fenceId: input.fenceId,
          durationMinutes: input.durationMinutes,
          strictDelayMinutes: input.strictDelayMinutes,
          presetName: input.presetName,
          linkedTaskId: input.linkedTaskId,
          status: "armed",
        })
        .returning();
      return session;
    }),

  start: authedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({ status: "active", startedAt: new Date() })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId),
            eq(sessions.status, "armed")
          )
        )
        .returning();
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  complete: authedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({ status: "completed", completedAt: new Date() })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId),
            eq(sessions.status, "active")
          )
        )
        .returning();
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      const today = new Date().toISOString().slice(0, 10);
      const existing = await ctx.db.query.streaks.findFirst({
        where: eq(streaks.userId, ctx.userId),
      });

      if (!existing) {
        await ctx.db.insert(streaks).values({
          userId: ctx.userId,
          currentStreak: 1,
          longestStreak: 1,
          lastSessionDate: today,
        });
      } else if (existing.lastSessionDate !== today) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        const newStreak =
          existing.lastSessionDate === yesterday
            ? existing.currentStreak + 1
            : 1;
        const longest = Math.max(newStreak, existing.longestStreak);
        await ctx.db
          .update(streaks)
          .set({
            currentStreak: newStreak,
            longestStreak: longest,
            lastSessionDate: today,
            updatedAt: new Date(),
          })
          .where(eq(streaks.userId, ctx.userId));
      }

      return session;
    }),

  abandon: authedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({ status: "abandoned", abandonedAt: new Date() })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId),
            eq(sessions.status, "active")
          )
        )
        .returning();
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  recordShieldHit: authedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({ shieldHits: sql`${sessions.shieldHits} + 1` })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId)
          )
        )
        .returning();
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  getActive: authedProcedure.query(async ({ ctx }) => {
    const session = await ctx.db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, ctx.userId),
        eq(sessions.status, "active")
      ),
    });
    return session ?? null;
  }),

  list: authedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.sessions.findMany({
        where: eq(sessions.userId, ctx.userId),
        limit: input.limit,
        offset: input.offset,
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });
    }),
});
