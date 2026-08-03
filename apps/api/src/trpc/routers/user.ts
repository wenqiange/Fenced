import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
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

/** Strip HTML tags to prevent stored XSS if content is ever rendered in a web context. */
function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

const IntentSchema = z.enum(["study", "deep-work", "phone-less"]);
const CategorySchema = z.enum([
  "social",
  "video",
  "games",
  "messaging",
  "news",
  "shopping",
]);

const ProfileInput = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email().nullable().optional(),
  ageBand: AgeBand,
  jurisdiction: z.string().min(2).max(5),
  assuranceMethod: AssuranceMethod,
  childrensCodeApplies: z.boolean(),
  guardianEmail: z.string().email().nullable().optional(),
  timezone: z.string().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2100).nullable().optional(),
  intent: IntentSchema.nullable().optional(),
  distractionCategories: z.array(CategorySchema).optional(),
  practiceMode: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
  needsGuardianConsent: z.boolean().optional(),
});

export const userRouter = router({
  me: authedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    return user ?? null;
  }),

  /** Profile by Clerk id — works before local userId is resolved. */
  getProfile: clerkProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkId, ctx.clerkId))
      .limit(1);
    return user ?? null;
  }),

  ensureProfile: clerkProcedure.input(ProfileInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkId, ctx.clerkId))
      .limit(1);

    const profileFields = {
      displayName: sanitizeText(input.displayName),
      email: input.email ?? existing[0]?.email ?? null,
      ageBand: input.ageBand,
      jurisdiction: input.jurisdiction,
      assuranceMethod: input.assuranceMethod,
      childrensCodeApplies: input.childrensCodeApplies,
      timezone: input.timezone ?? existing[0]?.timezone ?? "UTC",
      birthMonth: input.birthMonth ?? existing[0]?.birthMonth ?? null,
      birthYear: input.birthYear ?? existing[0]?.birthYear ?? null,
      intent: input.intent ?? existing[0]?.intent ?? null,
      distractionCategories:
        input.distractionCategories ??
        existing[0]?.distractionCategories ??
        [],
      practiceMode: input.practiceMode ?? existing[0]?.practiceMode ?? false,
      onboardingCompleted:
        input.onboardingCompleted ?? existing[0]?.onboardingCompleted ?? false,
      needsGuardianConsent:
        input.needsGuardianConsent ??
        existing[0]?.needsGuardianConsent ??
        false,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      const [updated] = await ctx.db
        .update(users)
        .set(profileFields)
        .where(eq(users.id, existing[0].id))
        .returning();

      if (input.guardianEmail) {
        await ctx.db.insert(consentEvents).values({
          userId: updated.id,
          guardianEmail: input.guardianEmail,
          method: "email-notice",
          scope: "coppa-account",
          noticeVersion: "mvp-1",
          grantedAt: null,
        });
      }

      return updated;
    }

    const [created] = await ctx.db
      .insert(users)
      .values({
        clerkId: ctx.clerkId,
        ...profileFields,
        assuranceAt: new Date(),
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

      // SECURITY: Block child→adult escalation without strong re-verification.
      // A 12-year-old must not be able to gain adult features by simply
      // changing their age band from the settings screen.
      if (existing) {
        const isEscalation =
          (existing.ageBand === "child" && input.ageBand === "adult") ||
          (existing.ageBand === "child" && input.ageBand === "teen") ||
          (existing.ageBand === "teen" && input.ageBand === "adult");

        if (isEscalation && input.assuranceMethod === "neutral-screen") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Age band escalation requires a stronger assurance method than neutral-screen. " +
              "Please use declared-age-range-self or declared-age-range-guardian.",
          });
        }

        if (isEscalation) {
          console.info(
            `[compliance] Age re-verification: user ${ctx.userId} ` +
            `${existing.ageBand}→${input.ageBand} via ${input.assuranceMethod}`
          );
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
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId));
    const userFences = await ctx.db
      .select()
      .from(fences)
      .where(eq(fences.userId, ctx.userId));
    const userTasks = await ctx.db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, ctx.userId));
    const userSessions = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ctx.userId));
    const userHours = await ctx.db
      .select()
      .from(fencedHours)
      .where(eq(fencedHours.userId, ctx.userId));
    const userEvents = await ctx.db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.userId, ctx.userId));
    const userConsents = await ctx.db
      .select()
      .from(consentEvents)
      .where(eq(consentEvents.userId, ctx.userId));

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

  // SECURITY: healthAuth no longer exposes clerkId/userId to unauthenticated
  // requests. This was an information leak — anyone could discover whether a
  // Clerk ID had a profile and obtain the internal user UUID.
  healthAuth: publicProcedure.query(({ ctx }) => ({
    authenticated: Boolean(ctx.clerkId),
    hasProfile: Boolean(ctx.userId),
  })),
});
