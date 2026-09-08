import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { featureAllowed, requireFeature } from "../age-gate";
import { calendarEvents, calendarFeeds } from "../../db/schema";
import { recordEventDeletion } from "../../integrations/calendar-sync";
import { buildUserCalendar } from "../../integrations/calendar-feed";

function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * The feed URL is a capability: the token is the only credential, so it needs
 * enough entropy that it cannot be guessed or brute-forced. 32 bytes,
 * base64url so it survives being pasted into any calendar client.
 */
function newFeedToken(): string {
  return randomBytes(32).toString("base64url");
}

function feedUrls(token: string): { httpsUrl: string; webcalUrl: string } {
  const base = (process.env.API_PUBLIC_URL ?? "http://localhost:3001").replace(
    /\/$/,
    ""
  );
  const httpsUrl = `${base}/calendar/feed/${token}.ics`;
  return {
    httpsUrl,
    // `webcal://` makes Google/Outlook/Apple offer "subscribe" rather than a
    // one-off download when the link is opened.
    webcalUrl: httpsUrl.replace(/^https?:\/\//, "webcal://"),
  };
}

const feedPublicColumns = {
  includeEvents: calendarFeeds.includeEvents,
  includeFencedHours: calendarFeeds.includeFencedHours,
  includeTaskDueDates: calendarFeeds.includeTaskDueDates,
  lastAccessedAt: calendarFeeds.lastAccessedAt,
  accessCount: calendarFeeds.accessCount,
  createdAt: calendarFeeds.createdAt,
  rotatedAt: calendarFeeds.rotatedAt,
};

export const calendarRouter = router({
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        notes: z.string().optional(),
        startAt: z.string().datetime(),
        endAt: z.string().datetime(),
        allDay: z.boolean().default(false),
        rrule: z.string().optional(),
        reminders: z.array(z.number().int()).default([]),
        linkedSessionId: z.string().uuid().optional(),
        linkedTaskId: z.string().uuid().optional(),
        source: z.enum(["local", "google", "outlook", "apple"]).default("local"),
        externalId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const start = new Date(input.startAt);
      const end = new Date(input.endAt);
      if (end <= start) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Event endAt time must be strictly after startAt time",
        });
      }

      const [event] = await ctx.db
        .insert(calendarEvents)
        .values({
          userId: ctx.userId,
          title: sanitizeText(input.title),
          notes: input.notes ? sanitizeText(input.notes) : undefined,
          startAt: start,
          endAt: end,
          allDay: input.allDay,
          rrule: input.rrule,
          reminders: input.reminders,
          linkedSessionId: input.linkedSessionId,
          linkedTaskId: input.linkedTaskId,
          source: input.source,
          externalId: input.externalId,
        })
        .returning();
      return event;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        notes: z.string().nullable().optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        allDay: z.boolean().optional(),
        rrule: z.string().nullable().optional(),
        reminders: z.array(z.number().int()).optional(),
        linkedSessionId: z.string().uuid().nullable().optional(),
        linkedTaskId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, startAt, endAt, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (startAt) values.startAt = new Date(startAt);
      if (endAt) values.endAt = new Date(endAt);

      const [event] = await ctx.db
        .update(calendarEvents)
        .set(values)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, ctx.userId)))
        .returning();
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.id, input.id), eq(calendarEvents.userId, ctx.userId)))
        .returning();
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      // The deleted row held the only record of the provider id, so leave a
      // tombstone before it is gone or the event lives on in Google forever.
      await recordEventDeletion(event);
      return event;
    }),

  list: authedProcedure
    .input(
      z.object({
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(calendarEvents.userId, ctx.userId)];
      if (input.startAt) conditions.push(gte(calendarEvents.startAt, new Date(input.startAt)));
      if (input.endAt) conditions.push(lte(calendarEvents.endAt, new Date(input.endAt)));

      return ctx.db.query.calendarEvents.findMany({
        where: and(...conditions),
        orderBy: (e, { asc }) => [asc(e.startAt)],
      });
    }),

  /**
   * Current subscribable feed, or `null` when the user has not enabled one.
   *
   * Read-only on purpose — minting a token is an explicit act (`enableFeed`),
   * not a side effect of opening the settings screen.
   */
  feed: authedProcedure.query(async ({ ctx }) => {
    const [feed] = await ctx.db
      .select({ token: calendarFeeds.token, ...feedPublicColumns })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, ctx.userId))
      .limit(1);
    // `feedAllowed` rides along on the read so the UI can explain why the
    // publish controls are absent instead of just hiding them.
    const feedAllowed = featureAllowed("calendar-feed-publish", ctx.ageBand);
    if (!feed) return { feed: null, feedAllowed };

    const { token, ...rest } = feed;
    return { feed: { ...rest, ...feedUrls(token) }, feedAllowed };
  }),

  /** Creates the feed, or returns the existing one unchanged. */
  enableFeed: authedProcedure.mutation(async ({ ctx }) => {
    requireFeature(
      "calendar-feed-publish",
      ctx.ageBand,
      "Publishing a shareable calendar link is not available for this account"
    );

    const [existing] = await ctx.db
      .select({ token: calendarFeeds.token, ...feedPublicColumns })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, ctx.userId))
      .limit(1);

    if (existing) {
      const { token, ...rest } = existing;
      return { ...rest, ...feedUrls(token) };
    }

    const [created] = await ctx.db
      .insert(calendarFeeds)
      .values({ userId: ctx.userId, token: newFeedToken() })
      .returning({ token: calendarFeeds.token, ...feedPublicColumns });

    const { token, ...rest } = created;
    return { ...rest, ...feedUrls(token) };
  }),

  /**
   * Issues a new token, which immediately invalidates the old URL.
   *
   * This is the revocation mechanism: anyone who was handed the previous link
   * (or scraped it out of a shared calendar) loses access.
   */
  rotateFeedToken: authedProcedure.mutation(async ({ ctx }) => {
    requireFeature(
      "calendar-feed-publish",
      ctx.ageBand,
      "Publishing a shareable calendar link is not available for this account"
    );

    const [rotated] = await ctx.db
      .update(calendarFeeds)
      .set({
        token: newFeedToken(),
        rotatedAt: new Date(),
        lastAccessedAt: null,
        accessCount: 0,
      })
      .where(eq(calendarFeeds.userId, ctx.userId))
      .returning({ token: calendarFeeds.token, ...feedPublicColumns });

    if (!rotated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No calendar feed to rotate",
      });
    }

    const { token, ...rest } = rotated;
    return { ...rest, ...feedUrls(token) };
  }),

  setFeedOptions: authedProcedure
    .input(
      z.object({
        includeEvents: z.boolean().optional(),
        includeFencedHours: z.boolean().optional(),
        includeTaskDueDates: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(calendarFeeds)
        .set({
          ...(input.includeEvents === undefined
            ? {}
            : { includeEvents: input.includeEvents }),
          ...(input.includeFencedHours === undefined
            ? {}
            : { includeFencedHours: input.includeFencedHours }),
          ...(input.includeTaskDueDates === undefined
            ? {}
            : { includeTaskDueDates: input.includeTaskDueDates }),
        })
        .where(eq(calendarFeeds.userId, ctx.userId))
        .returning({ token: calendarFeeds.token, ...feedPublicColumns });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Enable the calendar feed first",
        });
      }

      const { token, ...rest } = updated;
      return { ...rest, ...feedUrls(token) };
    }),

  /** Deletes the feed, permanently revoking the URL. */
  disableFeed: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(calendarFeeds)
      .where(eq(calendarFeeds.userId, ctx.userId));
    return { success: true };
  }),

  /**
   * One-off `.ics` snapshot for importing into another service by hand.
   *
   * Unlike the feed this needs no token: it rides the caller's own session and
   * returns the body inline for the client to share or save.
   */
  exportIcs: authedProcedure
    .input(
      z
        .object({
          includeEvents: z.boolean().default(true),
          includeFencedHours: z.boolean().default(true),
          includeTaskDueDates: z.boolean().default(false),
          pastDays: z.number().int().min(0).max(3650).default(60),
          futureDays: z.number().int().min(1).max(3650).default(365),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const content = await buildUserCalendar(ctx.userId, input);
      return {
        filename: `fenced-${new Date().toISOString().slice(0, 10)}.ics`,
        contentType: "text/calendar; charset=utf-8",
        content,
      };
    }),
});
