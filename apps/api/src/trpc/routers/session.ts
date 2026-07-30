import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { sessions, streaks } from "../../db/schema";

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
      const existing = await ctx.db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, input.sessionId),
          eq(sessions.userId, ctx.userId)
        ),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [session] = await ctx.db
        .update(sessions)
        .set({ shieldHits: existing.shieldHits + 1 })
        .where(eq(sessions.id, input.sessionId))
        .returning();
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
