import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { canAccess } from "@fenced/policy";
import { db } from "../db";
import {
  calendarConnections,
  calendarEvents,
  calendarSyncTombstones,
  users,
} from "../db/schema";
import * as google from "./google-calendar";
import { GoogleApiError, googleOAuthConfig } from "./google-calendar";
import { decryptToken, encryptToken } from "./token-crypto";

/** Window pulled on a first (or reset) sync, before incremental tokens take over. */
const PULL_PAST_DAYS = 30;
const PULL_FUTURE_DAYS = 180;
/** Guards against a provider paging loop pinning the worker. */
const MAX_PULL_PAGES = 20;
const MAX_PUSH_PER_RUN = 200;

type Connection = typeof calendarConnections.$inferSelect;
type CalendarEventRow = typeof calendarEvents.$inferSelect;

export interface SyncResult {
  connectionId: string;
  pulled: number;
  deletedLocally: number;
  pushed: number;
  deletedRemotely: number;
  error: string | null;
}

function emptyResult(connectionId: string): SyncResult {
  return {
    connectionId,
    pulled: 0,
    deletedLocally: 0,
    pushed: 0,
    deletedRemotely: 0,
    error: null,
  };
}

/**
 * Marks an event in the provider as owned by Fenced.
 *
 * A push writes the local row id here; the pull then recognises the event as an
 * echo of our own write instead of treating it as a foreign event and flipping
 * its `source`.
 */
const OWNER_PROPERTY = "fencedEventId";

/* ------------------------------------------------------------------ tokens */

/**
 * Returns a usable access token, refreshing and persisting it when the stored
 * one is spent.
 *
 * Throws when the connection has no refresh token — that link can only be
 * repaired by re-authorising, so callers should surface it rather than retry.
 */
async function accessTokenFor(connection: Connection): Promise<string> {
  const config = googleOAuthConfig();
  if (!config) {
    throw new Error("Google Calendar OAuth is not configured on this server");
  }

  const stillValid =
    connection.accessTokenEnc &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000;

  if (stillValid && connection.accessTokenEnc) {
    return decryptToken(connection.accessTokenEnc);
  }

  if (!connection.refreshTokenEnc) {
    throw new Error(
      "Calendar connection has no refresh token — reconnect the account"
    );
  }

  const refreshed = await google.refreshAccessToken(
    config,
    decryptToken(connection.refreshTokenEnc)
  );

  await db
    .update(calendarConnections)
    .set({
      accessTokenEnc: encryptToken(refreshed.accessToken),
      accessTokenExpiresAt: refreshed.expiresAt,
      // Google usually omits the refresh token on refresh; only overwrite when
      // it actually rotated one in.
      ...(refreshed.refreshToken
        ? { refreshTokenEnc: encryptToken(refreshed.refreshToken) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(calendarConnections.id, connection.id));

  return refreshed.accessToken;
}

/* ------------------------------------------------------------- conversions */

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Google → Fenced timing.
 *
 * All-day bounds are kept in Google's own exclusive form (`end` is the day
 * after the last one), which also satisfies the router's `endAt > startAt`
 * invariant for single-day events. The ICS export converts back to inclusive.
 */
export function timingFromGoogle(event: google.GoogleEvent): {
  startAt: Date;
  endAt: Date;
  allDay: boolean;
} | null {
  const start = event.start;
  const end = event.end;
  if (!start || !end) return null;

  if (start.date && end.date) {
    return {
      startAt: new Date(`${start.date}T00:00:00.000Z`),
      endAt: new Date(`${end.date}T00:00:00.000Z`),
      allDay: true,
    };
  }
  if (start.dateTime && end.dateTime) {
    const startAt = new Date(start.dateTime);
    const endAt = new Date(end.dateTime);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return null;
    }
    return { startAt, endAt, allDay: false };
  }
  return null;
}

/** Fenced → Google timing. */
export function timingToGoogle(
  row: Pick<CalendarEventRow, "allDay" | "startAt" | "endAt">
): {
  start: google.GoogleEventTime;
  end: google.GoogleEventTime;
} {
  if (row.allDay) {
    const startKey = dateKey(row.startAt);
    let endKey = dateKey(row.endAt);
    // Google requires an exclusive end strictly after the start; a row whose
    // bounds landed on the same day would otherwise be rejected.
    if (endKey <= startKey) endKey = addDays(startKey, 1);
    return { start: { date: startKey }, end: { date: endKey } };
  }
  return {
    start: { dateTime: row.startAt.toISOString() },
    end: { dateTime: row.endAt.toISOString() },
  };
}

function eventPayloadFor(row: CalendarEventRow): Partial<google.GoogleEvent> {
  const { start, end } = timingToGoogle(row);
  const payload: Partial<google.GoogleEvent> & {
    reminders?: {
      useDefault: boolean;
      overrides?: { method: string; minutes: number }[];
    };
  } = {
    summary: row.title,
    description: row.notes ?? undefined,
    start,
    end,
    extendedProperties: { private: { [OWNER_PROPERTY]: row.id } },
  };

  if (row.rrule) {
    payload.recurrence = [
      row.rrule.startsWith("RRULE:") ? row.rrule : `RRULE:${row.rrule}`,
    ];
  }
  if (row.reminders.length > 0) {
    payload.reminders = {
      useDefault: false,
      overrides: row.reminders.map((minutes) => ({
        method: "popup",
        minutes,
      })),
    };
  }
  return payload;
}

/* ------------------------------------------------------------------- pull */

interface PullCounts {
  pulled: number;
  deletedLocally: number;
}

async function applyPulledPage(
  connection: Connection,
  events: google.GoogleEvent[]
): Promise<PullCounts> {
  const counts: PullCounts = { pulled: 0, deletedLocally: 0 };
  if (events.length === 0) return counts;

  const cancelled = events
    .filter((e) => e.status === "cancelled")
    .map((e) => e.id);
  const live = events.filter((e) => e.status !== "cancelled");

  if (cancelled.length > 0) {
    const removed = await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.connectionId, connection.id),
          inArray(calendarEvents.externalId, cancelled)
        )
      )
      .returning({ id: calendarEvents.id });
    counts.deletedLocally += removed.length;
  }

  if (live.length === 0) return counts;

  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.connectionId, connection.id),
        inArray(
          calendarEvents.externalId,
          live.map((e) => e.id)
        )
      )
    );
  const byExternalId = new Map(existing.map((row) => [row.externalId, row]));

  const inserts: (typeof calendarEvents.$inferInsert)[] = [];
  const now = new Date();

  for (const event of live) {
    const timing = timingFromGoogle(event);
    // Recurring parents and events with an unparseable shape are skipped
    // rather than stored half-formed.
    if (!timing) continue;

    const providerUpdatedAt = event.updated ? new Date(event.updated) : null;
    const row = byExternalId.get(event.id);
    const fields = {
      title: event.summary?.slice(0, 500) || "(no title)",
      notes: event.description ?? null,
      startAt: timing.startAt,
      endAt: timing.endAt,
      allDay: timing.allDay,
      rrule:
        event.recurrence?.find((r) => r.startsWith("RRULE:"))?.slice(6) ?? null,
      externalEtag: event.etag ?? null,
      lastSyncedAt: now,
      updatedAt: now,
    };

    if (!row) {
      inserts.push({
        userId: connection.userId,
        source: "google",
        connectionId: connection.id,
        externalId: event.id,
        reminders: [],
        ...fields,
      });
      continue;
    }

    // Last-write-wins for events Fenced owns: a change made in Google is only
    // taken if it is newer than our copy, so a stale echo of our own push
    // cannot revert a local edit.
    const isOurs = event.extendedProperties?.private?.[OWNER_PROPERTY];
    if (
      isOurs &&
      providerUpdatedAt &&
      row.updatedAt.getTime() >= providerUpdatedAt.getTime()
    ) {
      continue;
    }
    // `source` is intentionally left alone: it records who owns the event.
    await db
      .update(calendarEvents)
      .set(fields)
      .where(eq(calendarEvents.id, row.id));
    counts.pulled += 1;
  }

  if (inserts.length > 0) {
    await db.insert(calendarEvents).values(inserts);
    counts.pulled += inserts.length;
  }

  return counts;
}

async function pullConnection(
  connection: Connection,
  accessToken: string
): Promise<PullCounts> {
  const counts: PullCounts = { pulled: 0, deletedLocally: 0 };
  let syncToken = connection.syncToken;
  let usedSyncToken = Boolean(syncToken);
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;

  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    let result: google.ListEventsResult;
    try {
      result = await google.listEvents(accessToken, {
        calendarId: connection.externalCalendarId,
        syncToken: pageToken ? null : syncToken,
        pageToken,
        timeMin: new Date(Date.now() - PULL_PAST_DAYS * 86_400_000),
        timeMax: new Date(Date.now() + PULL_FUTURE_DAYS * 86_400_000),
      });
    } catch (err) {
      if (err instanceof GoogleApiError && err.isSyncTokenExpired && usedSyncToken) {
        // The cursor aged out. Drop it and restart this pull from a full window
        // exactly once, rather than failing the whole sync.
        console.info(
          `[calendar-sync] Sync token expired for connection ${connection.id}; doing a full resync`
        );
        await db
          .update(calendarConnections)
          .set({ syncToken: null, updatedAt: new Date() })
          .where(eq(calendarConnections.id, connection.id));
        syncToken = null;
        usedSyncToken = false;
        pageToken = null;
        continue;
      }
      throw err;
    }

    const applied = await applyPulledPage(connection, result.events);
    counts.pulled += applied.pulled;
    counts.deletedLocally += applied.deletedLocally;

    if (result.nextSyncToken) nextSyncToken = result.nextSyncToken;
    if (!result.nextPageToken) break;
    pageToken = result.nextPageToken;
  }

  if (nextSyncToken) {
    await db
      .update(calendarConnections)
      .set({ syncToken: nextSyncToken, updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id));
  }

  return counts;
}

/* ------------------------------------------------------------------- push */

async function pushConnection(
  connection: Connection,
  accessToken: string
): Promise<{ pushed: number; deletedRemotely: number }> {
  let pushed = 0;
  let deletedRemotely = 0;

  // Deletions first: an event removed locally should disappear from Google
  // before we spend the run's budget on writes.
  const tombstones = await db
    .select()
    .from(calendarSyncTombstones)
    .where(eq(calendarSyncTombstones.connectionId, connection.id))
    .limit(MAX_PUSH_PER_RUN);

  for (const tombstone of tombstones) {
    await google.deleteEvent(
      accessToken,
      connection.externalCalendarId,
      tombstone.externalId
    );
    await db
      .delete(calendarSyncTombstones)
      .where(eq(calendarSyncTombstones.id, tombstone.id));
    deletedRemotely += 1;
  }

  // Only Fenced-owned rows are pushed. Rows pulled from a provider carry
  // `source = 'google'` and are never written back, which is what keeps the
  // two directions from echoing each other.
  //
  // Two branches: never-mirrored rows (no `external_id`), and rows this
  // connection already mirrored whose local edit is newer than the last push.
  // With more than one connection a new event lands in whichever syncs first
  // and then belongs to it — deliberate, so an event is not duplicated into
  // every linked calendar.
  const pending = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, connection.userId),
        eq(calendarEvents.source, "local"),
        or(
          isNull(calendarEvents.externalId),
          and(
            eq(calendarEvents.connectionId, connection.id),
            isNotNull(calendarEvents.lastSyncedAt),
            sql`${calendarEvents.updatedAt} > ${calendarEvents.lastSyncedAt}`
          )
        )
      )
    )
    .limit(MAX_PUSH_PER_RUN);

  for (const row of pending) {
    const payload = eventPayloadFor(row);
    const remote =
      row.externalId && row.connectionId === connection.id
        ? await google.patchEvent(
            accessToken,
            connection.externalCalendarId,
            row.externalId,
            payload
          )
        : await google.insertEvent(
            accessToken,
            connection.externalCalendarId,
            payload
          );

    await db
      .update(calendarEvents)
      .set({
        connectionId: connection.id,
        externalId: remote.id,
        externalEtag: remote.etag ?? null,
        lastSyncedAt: new Date(),
      })
      .where(eq(calendarEvents.id, row.id));
    pushed += 1;
  }

  return { pushed, deletedRemotely };
}

/* ------------------------------------------------------------ orchestration */

/**
 * Runs one connection's sync and records the outcome on the row.
 *
 * Never throws: a provider outage on one connection must not abort a batch, so
 * failures land in `lastSyncError` and in the returned result.
 */
export async function syncConnection(
  connection: Connection
): Promise<SyncResult> {
  const result = emptyResult(connection.id);
  if (!connection.syncEnabled) {
    result.error = "Sync is paused for this connection";
    return result;
  }

  const workerId = `sync-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const leaseDurationMs = 120_000;
  const now = new Date();

  // Try to acquire lease lock
  const [locked] = await db
    .update(calendarConnections)
    .set({
      leaseUntil: new Date(now.getTime() + leaseDurationMs),
      leasedBy: workerId,
    })
    .where(
      and(
        eq(calendarConnections.id, connection.id),
        or(
          isNull(calendarConnections.leaseUntil),
          lt(calendarConnections.leaseUntil, now)
        )
      )
    )
    .returning({ id: calendarConnections.id });

  if (!locked) {
    result.error = "Connection locked by another worker";
    return result;
  }

  try {
    const accessToken = await accessTokenFor(connection);

    if (connection.syncDirection !== "push") {
      const pulled = await pullConnection(connection, accessToken);
      result.pulled = pulled.pulled;
      result.deletedLocally = pulled.deletedLocally;
    }
    if (connection.syncDirection !== "pull") {
      // Re-read: the pull may have refreshed the token or the sync cursor.
      const [fresh] = await db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.id, connection.id))
        .limit(1);
      const pushed = await pushConnection(fresh ?? connection, accessToken);
      result.pushed = pushed.pushed;
      result.deletedRemotely = pushed.deletedRemotely;
    }

    await db
      .update(calendarConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, connection.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = message;

    const revoked = err instanceof GoogleApiError && err.isAuthRevoked;
    await db
      .update(calendarConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: message.slice(0, 500),
        // A revoked grant will fail forever; pausing stops the cron from
        // hammering Google and makes the broken state visible in settings.
        ...(revoked ? { syncEnabled: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(calendarConnections.id, connection.id));

    console.warn(
      `[calendar-sync] Connection ${connection.id} failed: ${message}`
    );
  } finally {
    // Release the lease lock ONLY IF this worker still holds it
    await db
      .update(calendarConnections)
      .set({
        leaseUntil: null,
        leasedBy: null,
      })
      .where(
        and(
          eq(calendarConnections.id, connection.id),
          eq(calendarConnections.leasedBy, workerId)
        )
      );
  }

  return result;
}

/** Syncs every enabled connection for one user (the "Sync now" button). */
export async function syncUserCalendars(userId: string): Promise<SyncResult[]> {
  const connections = await db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, userId),
        eq(calendarConnections.syncEnabled, true)
      )
    );

  const results: SyncResult[] = [];
  for (const connection of connections) {
    results.push(await syncConnection(connection));
  }
  return results;
}

/** Syncs every enabled connection in the system (the cron entrypoint). */
export async function syncAllCalendars(): Promise<{
  connections: number;
  skippedByAgeBand: number;
  pulled: number;
  pushed: number;
  failed: number;
}> {
  // The age-band gate is re-applied here, not only in the tRPC layer: this job
  // runs unattended, so a band later corrected down to `child` must stop the
  // sync rather than keep shipping their calendar to a provider.
  const rows = await db
    .select({ connection: calendarConnections, ageBand: users.ageBand })
    .from(calendarConnections)
    .innerJoin(users, eq(calendarConnections.userId, users.id))
    .where(eq(calendarConnections.syncEnabled, true));

  const eligible = rows.filter(({ ageBand }) =>
    canAccess("external-calendar-sync", ageBand)
  );
  const connections = eligible.map((row) => row.connection);
  const skippedByAgeBand = rows.length - eligible.length;
  if (skippedByAgeBand > 0) {
    console.info(
      `[calendar-sync] Skipped ${skippedByAgeBand} connection(s) not permitted for their age band`
    );
  }

  let pulled = 0;
  let pushed = 0;
  let failed = 0;

  for (const connection of connections) {
    const result = await syncConnection(connection);
    pulled += result.pulled;
    pushed += result.pushed;
    if (result.error) failed += 1;
  }

  return {
    connections: connections.length,
    skippedByAgeBand,
    pulled,
    pushed,
    failed,
  };
}

/**
 * Records that a synced event was deleted locally so the next push removes it
 * at the provider. No-op for events that were never mirrored.
 */
export async function recordEventDeletion(
  event: Pick<CalendarEventRow, "userId" | "connectionId" | "externalId">,
  executor: any = db
): Promise<void> {
  if (!event.connectionId || !event.externalId) return;
  await executor
    .insert(calendarSyncTombstones)
    .values({
      userId: event.userId,
      connectionId: event.connectionId,
      externalId: event.externalId,
    })
    .onConflictDoNothing();
}
