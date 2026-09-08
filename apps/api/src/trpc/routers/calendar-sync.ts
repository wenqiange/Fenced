import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import type { TRPCContext } from "../context";
import { featureAllowed, requireFeature } from "../age-gate";
import { calendarConnections, calendarEvents } from "../../db/schema";
import * as google from "../../integrations/google-calendar";
import { googleOAuthConfig } from "../../integrations/google-calendar";
import { createOAuthState } from "../../integrations/oauth-state";
import {
  isTokenCryptoConfigured,
  decryptToken,
} from "../../integrations/token-crypto";
import {
  syncConnection,
  syncUserCalendars,
} from "../../integrations/calendar-sync";

/**
 * Explicit projection for every connection we hand to a client.
 *
 * `accessTokenEnc` / `refreshTokenEnc` / `syncToken` are deliberately absent:
 * selecting the whole row here is how provider credentials end up leaking into
 * an API response, so the column list is the guard.
 */
const publicConnectionColumns = {
  id: calendarConnections.id,
  provider: calendarConnections.provider,
  accountEmail: calendarConnections.accountEmail,
  externalCalendarId: calendarConnections.externalCalendarId,
  externalCalendarName: calendarConnections.externalCalendarName,
  syncDirection: calendarConnections.syncDirection,
  syncEnabled: calendarConnections.syncEnabled,
  lastSyncAt: calendarConnections.lastSyncAt,
  lastSyncError: calendarConnections.lastSyncError,
  createdAt: calendarConnections.createdAt,
  updatedAt: calendarConnections.updatedAt,
};

/**
 * Loads a connection scoped to the caller.
 *
 * Every mutation goes through this rather than filtering on id alone, so a
 * guessed or leaked connection id cannot be operated on across accounts.
 */
async function ownedConnection(
  db: TRPCContext["db"],
  userId: string,
  connectionId: string
): Promise<typeof calendarConnections.$inferSelect> {
  const [connection] = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.id, connectionId),
        eq(calendarConnections.userId, userId)
      )
    )
    .limit(1);
  if (!connection) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
  }
  return connection;
}

export const calendarSyncRouter = router({
  /**
   * Everything the settings screen needs in one call, including whether the
   * server is even configured for OAuth — so the UI can explain itself instead
   * of failing on connect.
   */
  status: authedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db
      .select(publicConnectionColumns)
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, ctx.userId))
      .orderBy(calendarConnections.createdAt);

    return {
      googleConfigured: Boolean(googleOAuthConfig()) && isTokenCryptoConfigured(),
      /** False for age bands that may not link a provider account. */
      allowedForAgeBand: featureAllowed("external-calendar-sync", ctx.ageBand),
      connections,
    };
  }),

  /**
   * Starts the OAuth flow. The client opens this URL in a browser session; the
   * server's callback finishes the exchange and redirects back to the app.
   */
  googleAuthUrl: authedProcedure.mutation(async ({ ctx }) => {
    requireFeature(
      "external-calendar-sync",
      ctx.ageBand,
      "Linking an external calendar is not available for this account"
    );

    const config = googleOAuthConfig();
    if (!config) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Google Calendar is not configured on this server (GOOGLE_CALENDAR_CLIENT_ID / _SECRET)",
      });
    }
    if (!isTokenCryptoConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "CALENDAR_TOKEN_KEY is not set, so provider tokens cannot be stored securely",
      });
    }

    return { url: google.buildAuthUrl(config, createOAuthState(ctx.userId)) };
  }),

  /** Calendars on the linked account, for the "which calendar?" picker. */
  googleCalendars: authedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const connection = await ownedConnection(
        ctx.db,
        ctx.userId,
        input.connectionId
      );
      const config = googleOAuthConfig();
      if (!config || !connection.refreshTokenEnc) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reconnect the account to list its calendars",
        });
      }

      // Deliberately a fresh access token rather than the stored one: this is a
      // read-only listing and refreshing here keeps the picker working even if
      // the cached token just expired.
      const tokens = await google.refreshAccessToken(
        config,
        decryptToken(connection.refreshTokenEnc)
      );
      return google.listCalendars(tokens.accessToken);
    }),

  /** Points a connection at a different provider calendar. */
  selectCalendar: authedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        externalCalendarId: z.string().min(1).max(500),
        externalCalendarName: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ownedConnection(ctx.db, ctx.userId, input.connectionId);

      const [updated] = await ctx.db
        .update(calendarConnections)
        .set({
          externalCalendarId: input.externalCalendarId,
          externalCalendarName: input.externalCalendarName ?? null,
          // The sync cursor belongs to the old calendar; keeping it would make
          // the next pull resume against the wrong event stream.
          syncToken: null,
          lastSyncError: null,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, input.connectionId))
        .returning(publicConnectionColumns);
      return updated;
    }),

  setPreferences: authedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        syncEnabled: z.boolean().optional(),
        syncDirection: z.enum(["pull", "push", "both"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ownedConnection(ctx.db, ctx.userId, input.connectionId);

      const [updated] = await ctx.db
        .update(calendarConnections)
        .set({
          ...(input.syncEnabled === undefined
            ? {}
            : // Re-enabling is how a user retries after a failure, so clear the
              // stale error alongside it.
              { syncEnabled: input.syncEnabled, lastSyncError: null }),
          ...(input.syncDirection ? { syncDirection: input.syncDirection } : {}),
          updatedAt: new Date(),
        })
        .where(eq(calendarConnections.id, input.connectionId))
        .returning(publicConnectionColumns);
      return updated;
    }),

  /** Runs a sync immediately — one connection, or all of the caller's. */
  syncNow: authedProcedure
    .input(z.object({ connectionId: z.string().uuid().optional() }).default({}))
    .mutation(async ({ ctx, input }) => {
      // Re-checked on every run, not just at connect time: an age band can be
      // corrected downward after a link already exists.
      requireFeature(
        "external-calendar-sync",
        ctx.ageBand,
        "Calendar sync is not available for this account"
      );

      if (input.connectionId) {
        const connection = await ownedConnection(
          ctx.db,
          ctx.userId,
          input.connectionId
        );
        return { results: [await syncConnection(connection)] };
      }
      return { results: await syncUserCalendars(ctx.userId) };
    }),

  /**
   * Revokes the grant at the provider and removes the link.
   *
   * Pulled events go with it — leaving them behind would strand copies of
   * someone's calendar in Fenced after they disconnected it. Locally-owned
   * events survive, with their provider ids cleared so a future reconnect
   * re-creates them instead of patching ids that no longer resolve.
   */
  disconnect: authedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ownedConnection(
        ctx.db,
        ctx.userId,
        input.connectionId
      );

      let revoked = false;
      if (connection.refreshTokenEnc) {
        try {
          revoked = await google.revokeToken(
            decryptToken(connection.refreshTokenEnc)
          );
        } catch (err) {
          // An undecryptable token still has to be removable locally.
          console.warn("[calendar-sync] Could not revoke provider token:", err);
        }
      }

      const removedEvents = await ctx.db
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.connectionId, connection.id),
            eq(calendarEvents.source, "google")
          )
        )
        .returning({ id: calendarEvents.id });

      await ctx.db
        .update(calendarEvents)
        .set({ externalId: null, externalEtag: null, lastSyncedAt: null })
        .where(eq(calendarEvents.connectionId, connection.id));

      await ctx.db
        .delete(calendarConnections)
        .where(eq(calendarConnections.id, connection.id));

      return {
        success: true,
        revokedAtProvider: revoked,
        removedEvents: removedEvents.length,
      };
    }),
});
