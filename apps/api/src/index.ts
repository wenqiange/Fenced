import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq, sql } from "drizzle-orm";
import { appRouter } from "./trpc/routers";
import { createContext, type AppVariables } from "./trpc/context";
import { resolveAuth } from "./auth";
import { db, isDbConfigured } from "./db";
import { calendarConnections, calendarFeeds, users } from "./db/schema";
import { canAccess } from "@fenced/policy";
import {
  exchangeCode,
  fetchAccountEmail,
  googleOAuthConfig,
} from "./integrations/google-calendar";
import { verifyOAuthState } from "./integrations/oauth-state";
import { encryptToken } from "./integrations/token-crypto";
import { buildUserCalendar } from "./integrations/calendar-feed";
import { syncAllCalendars } from "./integrations/calendar-sync";

import { rateLimit } from "./rate-limit";
import { processStreakRollover } from "./jobs/streak-rollover";
import { processRetentionEnforcement } from "./jobs/retention-enforcement";

/**
 * Where the OAuth callback sends the browser when it is done.
 *
 * Expo's `openAuthSessionAsync` closes the in-app browser as soon as it sees
 * this URL, so it must match the `returnUrl` the app passes in.
 */
const APP_RETURN_URL =
  process.env.APP_OAUTH_RETURN_URL ?? "fenced://calendar-connected";

const app = new Hono<{ Variables: AppVariables }>();

/**
 * Keeps secrets out of the log stream.
 *
 * The ICS feed path *is* the credential and the OAuth callback carries an
 * authorization code, so both are redacted before anything is written.
 */
function redactPath(path: string): string {
  if (path.startsWith("/calendar/feed/")) return "/calendar/feed/<redacted>";
  if (path.startsWith("/oauth/")) return `${path.split("?")[0]} <params redacted>`;
  return path;
}

// Request logger middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  // Skip logging health checks to reduce noise
  if (path !== "/health") {
    console.log(`[http] ${method} ${redactPath(path)} ${status} - ${duration}ms`);
  }
});

app.use("*", cors());
app.use("/trpc/*", rateLimit({ windowMs: 60 * 1000, max: 100 }));
// A feed token is guessable only by brute force, so cap the attempt rate.
// Calendar clients poll roughly hourly, so 30/min is generous for real use.
app.use("/calendar/feed/*", rateLimit({ windowMs: 60 * 1000, max: 30 }));
app.use("/oauth/*", rateLimit({ windowMs: 60 * 1000, max: 20 }));

app.get("/health", async (c) => {
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    console.warn("[health] DB check failed:", err);
  }
  return c.json({
    status: dbOk ? "ok" : "degraded",
    database: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Cron Jobs Endpoint (Secured by Bearer CRON_SECRET or dev header)
app.post("/api/cron/streak-rollover", async (c) => {
  const secret = process.env.CRON_SECRET;
  const auth = c.req.header("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await processStreakRollover();
  return c.json({ success: true, ...result });
});

app.post("/api/cron/retention-enforcement", async (c) => {
  const secret = process.env.CRON_SECRET;
  const auth = c.req.header("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await processRetentionEnforcement();
  return c.json({ success: true, ...result });
});

app.post("/api/cron/calendar-sync", async (c) => {
  const secret = process.env.CRON_SECRET;
  const auth = c.req.header("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await syncAllCalendars();
  return c.json({ success: true, ...result });
});

/**
 * Completes the Google OAuth flow.
 *
 * Public by necessity — Google calls it, not the app — so the signed `state`
 * is what proves which user started the flow. Every exit path redirects back
 * to the app's scheme, which is also what closes the in-app auth browser.
 */
app.get("/oauth/google/calendar/callback", async (c) => {
  const returnTo = (status: string, message?: string) => {
    const params = new URLSearchParams({ status });
    if (message) params.set("message", message);
    return c.redirect(`${APP_RETURN_URL}?${params.toString()}`, 302);
  };

  const error = c.req.query("error");
  if (error) {
    // The user pressed "cancel" on Google's consent screen.
    return returnTo("denied", error);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return returnTo("error", "Missing code or state");

  const verified = verifyOAuthState(state);
  if (!verified) return returnTo("error", "Authorization link expired");

  const config = googleOAuthConfig();
  if (!config) return returnTo("error", "Google Calendar is not configured");

  try {
    const tokens = await exchangeCode(config, code);
    if (!tokens.refreshToken) {
      // Without a refresh token the link would silently die within the hour,
      // so refuse it rather than store something that cannot be renewed.
      return returnTo(
        "error",
        "Google did not return a refresh token; remove Fenced from your Google account permissions and try again"
      );
    }

    const accountEmail = await fetchAccountEmail(tokens.accessToken);

    await db
      .insert(calendarConnections)
      .values({
        userId: verified.userId,
        provider: "google",
        accountEmail,
        externalCalendarId: "primary",
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: encryptToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      })
      .onConflictDoUpdate({
        target: [
          calendarConnections.userId,
          calendarConnections.provider,
          calendarConnections.externalCalendarId,
        ],
        set: {
          accountEmail,
          accessTokenEnc: encryptToken(tokens.accessToken),
          refreshTokenEnc: encryptToken(tokens.refreshToken),
          accessTokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
          // A re-grant means new permissions; the old cursor and error no
          // longer describe the connection.
          syncToken: null,
          syncEnabled: true,
          lastSyncError: null,
          updatedAt: new Date(),
        },
      });

    return returnTo("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[oauth] Google Calendar callback failed:", message);
    return returnTo("error", message);
  }
});

/**
 * Serves a user's subscribable ICS feed.
 *
 * Unauthenticated by design: Google, Outlook and Apple fetch this URL with no
 * ability to carry a bearer token, so the path token is the credential. It is
 * high-entropy, rate limited, redacted from logs, and revocable by rotation.
 */
app.get("/calendar/feed/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!filename.endsWith(".ics")) return c.text("Not found", 404);
  const token = filename.slice(0, -".ics".length);
  if (!token) return c.text("Not found", 404);

  let feed: typeof calendarFeeds.$inferSelect | undefined;
  let body: string;
  try {
    const [row] = await db
      .select({ feed: calendarFeeds, ageBand: users.ageBand })
      .from(calendarFeeds)
      .innerJoin(users, eq(calendarFeeds.userId, users.id))
      .where(eq(calendarFeeds.token, token))
      .limit(1);

    // Same response for an unknown token, a rotated-away one, and one whose
    // owner may no longer publish — probing must not distinguish them.
    //
    // The band is re-checked on every fetch because a feed created as an adult
    // outlives an age correction, and a public URL exposing a minor's week is
    // exactly what the age gate exists to prevent.
    if (!row || !canAccess("calendar-feed-publish", row.ageBand)) {
      return c.text("Not found", 404);
    }
    feed = row.feed;

    body = await buildUserCalendar(feed.userId, {
      includeEvents: feed.includeEvents,
      includeFencedHours: feed.includeFencedHours,
      includeTaskDueDates: feed.includeTaskDueDates,
    });
  } catch (err) {
    // This endpoint is public, so the response must not carry query text or
    // stack frames. 503 also tells calendar clients to retry rather than
    // treating the subscription as gone.
    console.error("[calendar-feed] Failed to build feed:", err);
    return c.text("Calendar feed temporarily unavailable", 503);
  }

  try {
    await db
      .update(calendarFeeds)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${calendarFeeds.accessCount} + 1`,
      })
      .where(eq(calendarFeeds.id, feed.id));
  } catch (err) {
    // Access bookkeeping is diagnostics only — never fail the fetch over it.
    console.warn("[calendar-feed] Could not record feed access:", err);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="fenced.ics"',
      // `private` keeps a shared proxy from caching one user's calendar.
      "cache-control": "private, max-age=300",
    },
  });
});

app.use("*", resolveAuth);

app.use("/trpc/*", async (c) => {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  });
  return response;
});

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});

export type { AppRouter } from "./trpc/routers";
