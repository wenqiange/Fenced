import { z } from "zod";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { AgeBand, AssuranceMethod, type AgeBand as AgeBandT } from "@fenced/core";
import { requiresParentalConsent } from "@fenced/policy";
import type { Database } from "../../db";
import { router, authedProcedure, clerkProcedure, publicProcedure } from "../init";

import {
  users,
  consentEvents,
  calendarConnections,
  calendarFeeds,
  calendarSyncTombstones,
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
  intent: IntentSchema.nullable().optional(),
  distractionCategories: z.array(CategorySchema).optional(),
  practiceMode: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
});

/**
 * Derived on the server, never trusted from the client: a band/jurisdiction
 * that requires parental consent stays pending until a guardian granted it.
 */
async function consentPending(
  db: Database,
  userId: string | undefined,
  ageBand: AgeBandT,
  jurisdiction: string,
): Promise<boolean> {
  if (!requiresParentalConsent(ageBand, jurisdiction)) return false;
  if (!userId) return true;
  const [latest] = await db
    .select({
      id: consentEvents.id,
      grantedAt: consentEvents.grantedAt,
      revokedAt: consentEvents.revokedAt,
    })
    .from(consentEvents)
    .where(eq(consentEvents.userId, userId))
    .orderBy(desc(consentEvents.createdAt))
    .limit(1);
  return !(latest?.grantedAt && !latest.revokedAt);
}

const BAND_RANK: Record<AgeBandT, number> = { child: 0, teen: 1, adult: 2 };

/** Moving to an older band unlocks features, so it needs stronger assurance. */
function isEscalation(from: AgeBandT, to: AgeBandT): boolean {
  return BAND_RANK[to] > BAND_RANK[from];
}

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

    // Q2: Never allow escalation on an unverified client assertion
    const isEscalating = existing[0] && isEscalation(existing[0].ageBand, input.ageBand);
    const ageBand = isEscalating ? existing[0].ageBand : input.ageBand;

    const needsGuardianConsent = await consentPending(
      ctx.db,
      existing[0]?.id,
      ageBand,
      input.jurisdiction,
    );

    // B7: Minors pending consent do not have PII (name/email) persisted on server
    const profileFields = {
      displayName: needsGuardianConsent ? "You" : sanitizeText(input.displayName),
      email: needsGuardianConsent ? null : (input.email ?? existing[0]?.email ?? null),
      ageBand,
      jurisdiction: input.jurisdiction,
      assuranceMethod: input.assuranceMethod,
      childrensCodeApplies: input.childrensCodeApplies,
      timezone: input.timezone ?? existing[0]?.timezone ?? "UTC",
      intent: input.intent ?? existing[0]?.intent ?? null,
      distractionCategories:
        input.distractionCategories ??
        existing[0]?.distractionCategories ??
        [],
      practiceMode: input.practiceMode ?? existing[0]?.practiceMode ?? false,
      onboardingCompleted:
        input.onboardingCompleted ?? existing[0]?.onboardingCompleted ?? false,
      needsGuardianConsent,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      const [updated] = await ctx.db
        .update(users)
        .set(profileFields)
        .where(eq(users.id, existing[0].id))
        .returning();

      // Profile sync runs on every launch; only a new address starts a new
      // consent request, or the guardian would be emailed each time.
      const alreadyRequested =
        input.guardianEmail &&
        (
          await ctx.db
            .select({ id: consentEvents.id })
            .from(consentEvents)
            .where(
              and(
                eq(consentEvents.userId, updated.id),
                eq(consentEvents.guardianEmail, input.guardianEmail),
              ),
            )
            .limit(1)
        ).length > 0;

      if (input.guardianEmail && !alreadyRequested) {
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

      // SECURITY: Block child→adult escalation without verified consent record.
      // A minor cannot gain adult features by self-declaring in settings.
      // Escalation strictly requires a verified, unrevoked consent event in consent_events.
      if (existing) {
        const escalation = isEscalation(existing.ageBand, input.ageBand);

        if (escalation) {
          const [verifiedConsent] = await ctx.db
            .select({ id: consentEvents.id })
            .from(consentEvents)
            .where(
              and(
                eq(consentEvents.userId, ctx.userId),
                isNotNull(consentEvents.grantedAt),
                isNull(consentEvents.revokedAt)
              )
            )
            .orderBy(desc(consentEvents.createdAt))
            .limit(1);

          if (!verifiedConsent) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Age band escalation requires verified parental consent recorded on this account.",
            });
          }

          console.info(
            `[compliance] Age re-verification: user ${ctx.userId} ` +
            `${existing.ageBand}→${input.ageBand} via verified consent event ${verifiedConsent.id}`
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
          needsGuardianConsent: await consentPending(
            ctx.db,
            ctx.userId,
            input.ageBand,
            input.jurisdiction,
          ),
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
    const userProjects = await ctx.db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.userId));
    const userConsents = await ctx.db
      .select()
      .from(consentEvents)
      .where(eq(consentEvents.userId, ctx.userId));
    // Column lists, not select(): an export file is portable, so it must not
    // carry provider tokens or the feed URL that grants calendar access.
    const userCalendarConnections = await ctx.db
      .select({
        id: calendarConnections.id,
        provider: calendarConnections.provider,
        accountEmail: calendarConnections.accountEmail,
        externalCalendarId: calendarConnections.externalCalendarId,
        externalCalendarName: calendarConnections.externalCalendarName,
        syncDirection: calendarConnections.syncDirection,
        syncEnabled: calendarConnections.syncEnabled,
        lastSyncAt: calendarConnections.lastSyncAt,
        createdAt: calendarConnections.createdAt,
      })
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, ctx.userId));
    const [userCalendarFeed] = await ctx.db
      .select({
        includeEvents: calendarFeeds.includeEvents,
        includeFencedHours: calendarFeeds.includeFencedHours,
        includeTaskDueDates: calendarFeeds.includeTaskDueDates,
        lastAccessedAt: calendarFeeds.lastAccessedAt,
        accessCount: calendarFeeds.accessCount,
        createdAt: calendarFeeds.createdAt,
        rotatedAt: calendarFeeds.rotatedAt,
      })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, ctx.userId));

    return {
      exportedAt: new Date().toISOString(),
      user: user ?? null,
      fences: userFences,
      tasks: userTasks,
      projects: userProjects,
      sessions: userSessions,
      fencedHours: userHours,
      calendarEvents: userEvents,
      calendarConnections: userCalendarConnections,
      calendarFeed: userCalendarFeed ?? null,
      consentEvents: userConsents,
    };
  }),

  deleteAccount: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.transaction(async (tx) => {
      await tx.delete(consentEvents).where(eq(consentEvents.userId, ctx.userId));
      // Calendar links first: dropping the connection is what stops any
      // further sync from touching a provider account we are about to forget.
      await tx
        .delete(calendarSyncTombstones)
        .where(eq(calendarSyncTombstones.userId, ctx.userId));
      await tx.delete(calendarFeeds).where(eq(calendarFeeds.userId, ctx.userId));
      await tx
        .delete(calendarConnections)
        .where(eq(calendarConnections.userId, ctx.userId));
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
