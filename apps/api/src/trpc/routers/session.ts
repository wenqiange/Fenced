import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import type { Database } from "../../db";
import { router, authedProcedure, existingOrConflict } from "../init";
import { sessions, streaks, fences } from "../../db/schema";

/**
 * Offline clients report when a transition really happened. Accept it only
 * within a sane window so a bad clock cannot rewrite old streak history.
 */
const ClientTimestamp = z
  .string()
  .datetime()
  .optional()
  .transform((v) => {
    if (!v) return new Date();
    const at = new Date(v);
    const now = Date.now();
    if (at.getTime() > now + 5 * 60_000) return new Date(now);
    if (at.getTime() < now - 14 * 86_400_000) return new Date(now);
    return at;
  });

const SessionRef = z.object({ sessionId: z.string().uuid() });

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function findOwned(ctx: { db: Database | Tx; userId: string }, sessionId: string) {
  return ctx.db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, ctx.userId)),
  });
}

function localDateKey(at: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export const sessionRouter = router({
  create: authedProcedure
    .input(
      z.object({
        /** Client-generated id: makes a retried offline create idempotent. */
        id: z.string().uuid().optional(),
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
          id: input.id,
          userId: ctx.userId,
          fenceId: input.fenceId,
          durationMinutes: input.durationMinutes,
          strictDelayMinutes: input.strictDelayMinutes,
          presetName: input.presetName,
          linkedTaskId: input.linkedTaskId,
          status: "armed",
        })
        .onConflictDoNothing({ target: sessions.id })
        .returning();
      if (session) return session;
      return existingOrConflict(await findOwned(ctx, input.id!));
    }),

  start: authedProcedure
    .input(SessionRef.extend({ startedAt: ClientTimestamp }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({ status: "active", startedAt: input.startedAt })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId),
            eq(sessions.status, "armed")
          )
        )
        .returning();
      if (session) return session;
      // Retried after success: already past "armed" is fine.
      const existing = await findOwned(ctx, input.sessionId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return existing;
    }),

  complete: authedProcedure
    .input(
      SessionRef.extend({
        completedAt: ClientTimestamp,
        shieldHits: z.number().int().min(0).max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [session] = await tx
          .update(sessions)
          .set({
            status: "completed",
            completedAt: input.completedAt,
            ...(input.shieldHits !== undefined ? { shieldHits: input.shieldHits } : {}),
          })
          .where(
            and(
              eq(sessions.id, input.sessionId),
              eq(sessions.userId, ctx.userId),
              eq(sessions.status, "active")
            )
          )
          .returning();
        if (!session) {
          // Idempotent retry: a session already completed is a success and
          // must not bump the streak a second time.
          const prior = await findOwned({ db: tx, userId: ctx.userId }, input.sessionId);
          if (prior?.status === "completed") return prior;
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // Streak days follow the user's calendar where the session ended,
        // not when an offline device finally uploaded it.
        const tz = ctx.timezone || "UTC";
        const todayStr = localDateKey(input.completedAt, tz);
        const yesterdayStr = localDateKey(
          new Date(input.completedAt.getTime() - 86_400_000),
          tz,
        );

        const existing = await tx.query.streaks.findFirst({
          where: eq(streaks.userId, ctx.userId),
        });

        if (!existing) {
          await tx.insert(streaks).values({
            userId: ctx.userId,
            currentStreak: 1,
            longestStreak: 1,
            lastSessionDate: todayStr,
          });
        } else if (existing.lastSessionDate !== todayStr) {
          const newStreak =
            existing.lastSessionDate === yesterdayStr
              ? existing.currentStreak + 1
              : 1;
          const longest = Math.max(newStreak, existing.longestStreak);
          await tx
            .update(streaks)
            .set({
              currentStreak: newStreak,
              longestStreak: longest,
              lastSessionDate: todayStr,
              updatedAt: new Date(),
            })
            .where(eq(streaks.userId, ctx.userId));
        }

        return session;
      });
    }),

  abandon: authedProcedure
    .input(
      SessionRef.extend({
        abandonedAt: ClientTimestamp,
        shieldHits: z.number().int().min(0).max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await ctx.db
        .update(sessions)
        .set({
          status: "abandoned",
          abandonedAt: input.abandonedAt,
          ...(input.shieldHits !== undefined ? { shieldHits: input.shieldHits } : {}),
        })
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.userId),
            inArray(sessions.status, ["armed", "active"])
          )
        )
        .returning();
      if (session) return session;
      const prior = await findOwned(ctx, input.sessionId);
      if (prior?.status === "abandoned") return prior;
      throw new TRPCError({ code: "NOT_FOUND" });
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
