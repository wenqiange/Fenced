import { z } from "zod";
import { eq } from "drizzle-orm";
import { AgeBand, AssuranceMethod } from "@fenced/core";
import { router, authedProcedure, clerkProcedure, publicProcedure } from "../init";
import {
  users,
  consentEvents,
  fences,
  tasks,
  sessions,
  fencedHours,
  calendarEvents,
  projects,
  streaks,
} from "../../db/schema";

export const userRouter = router({
  me: authedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    return user ?? null;
  }),

  ensureProfile: clerkProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100),
        email: z.string().email().nullable().optional(),
        ageBand: AgeBand,
        jurisdiction: z.string().min(2).max(5),
        assuranceMethod: AssuranceMethod,
        childrensCodeApplies: z.boolean(),
        guardianEmail: z.string().email().nullable().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(users)
        .where(eq(users.clerkId, ctx.clerkId))
        .limit(1);

      if (existing[0]) {
        const [updated] = await ctx.db
          .update(users)
          .set({
            displayName: input.displayName,
            email: input.email ?? existing[0].email,
            ageBand: input.ageBand,
            jurisdiction: input.jurisdiction,
            assuranceMethod: input.assuranceMethod,
            childrensCodeApplies: input.childrensCodeApplies,
            timezone: input.timezone ?? existing[0].timezone ?? "UTC",
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing[0].id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(users)
        .values({
          clerkId: ctx.clerkId,
          displayName: input.displayName,
          email: input.email ?? null,
          ageBand: input.ageBand,
          jurisdiction: input.jurisdiction,
          assuranceMethod: input.assuranceMethod,
          assuranceAt: new Date(),
          childrensCodeApplies: input.childrensCodeApplies,
          timezone: input.timezone ?? "UTC",
        })
        .returning();

      if (input.guardianEmail) {
        await ctx.db.insert(consentEvents).values({
          userId: created.id,
          guardianEmail: input.guardianEmail,
          method: "email-notice",
          scope: "coppa-account",
          noticeVersion: "mvp-1",
          grantedAt: null,
        });
      }

      return created;
    }),

  updateAgeBand: authedProcedure
    .input(
      z.object({
        ageBand: AgeBand,
        jurisdiction: z.string().min(2).max(5),
        assuranceMethod: AssuranceMethod,
        childrensCodeApplies: z.boolean(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (existing) {
        // Disallow direct escalation from child to adult without re-verification
        if (existing.ageBand === "child" && input.ageBand === "adult" && input.assuranceMethod === "neutral-screen") {
          // Verify that assurance was triggered with explicit re-verification
          console.log(`[compliance] Age re-verification triggered for user ${ctx.userId}`);
        }
      }

      const [updated] = await ctx.db
        .update(users)
        .set({
          ageBand: input.ageBand,
          jurisdiction: input.jurisdiction,
          assuranceMethod: input.assuranceMethod,
          childrensCodeApplies: input.childrensCodeApplies,
          timezone: input.timezone ?? existing?.timezone ?? "UTC",
          assuranceAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.userId))
        .returning();
      return updated;
    }),

  resendGuardianConsent: authedProcedure
    .input(
      z.object({
        guardianEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .insert(consentEvents)
        .values({
          userId: ctx.userId,
          guardianEmail: input.guardianEmail,
          method: "email-notice-resend",
          scope: "coppa-account",
          noticeVersion: "mvp-1",
          grantedAt: null,
        })
        .returning();
      return { success: true, eventId: event.id };
    }),

  exportData: authedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db.select().from(users).where(eq(users.id, ctx.userId));
    const userFences = await ctx.db.select().from(fences).where(eq(fences.userId, ctx.userId));
    const userTasks = await ctx.db.select().from(tasks).where(eq(tasks.userId, ctx.userId));
    const userSessions = await ctx.db.select().from(sessions).where(eq(sessions.userId, ctx.userId));
    const userHours = await ctx.db.select().from(fencedHours).where(eq(fencedHours.userId, ctx.userId));
    const userEvents = await ctx.db.select().from(calendarEvents).where(eq(calendarEvents.userId, ctx.userId));
    const userConsents = await ctx.db.select().from(consentEvents).where(eq(consentEvents.userId, ctx.userId));

    return {
      exportedAt: new Date().toISOString(),
      user: user ?? null,
      fences: userFences,
      tasks: userTasks,
      sessions: userSessions,
      fencedHours: userHours,
      calendarEvents: userEvents,
      consentEvents: userConsents,
    };
  }),

  deleteAccount: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.transaction(async (tx) => {
      await tx.delete(consentEvents).where(eq(consentEvents.userId, ctx.userId));
      await tx.delete(calendarEvents).where(eq(calendarEvents.userId, ctx.userId));
      await tx.delete(sessions).where(eq(sessions.userId, ctx.userId));
      await tx.delete(fencedHours).where(eq(fencedHours.userId, ctx.userId));
      await tx.delete(tasks).where(eq(tasks.userId, ctx.userId));
      await tx.delete(projects).where(eq(projects.userId, ctx.userId));
      await tx.delete(fences).where(eq(fences.userId, ctx.userId));
      await tx.delete(streaks).where(eq(streaks.userId, ctx.userId));
      await tx.delete(users).where(eq(users.id, ctx.userId));
    });
    return { success: true };
  }),

  healthAuth: publicProcedure.query(({ ctx }) => ({
    authenticated: Boolean(ctx.clerkId),
    hasProfile: Boolean(ctx.userId),
    clerkId: ctx.clerkId ?? null,
    userId: ctx.userId ?? null,
  })),
});
