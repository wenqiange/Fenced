import { and, eq, gte, isNull, lte } from "drizzle-orm";
import {
  buildCalendar,
  firstOccurrenceOnOrAfter,
  localDateKey,
  wallTimeWindow,
  weeklyRule,
  type IcsEvent,
} from "@fenced/ical";
import { db } from "../db";
import {
  calendarEvents,
  fencedHours,
  fences,
  tasks,
  users,
} from "../db/schema";

/**
 * UID domain. Any stable string works, but it must never change for a given
 * row: subscribed clients key off the UID, so a churning value shows up as
 * "everything was deleted and recreated" on every refresh.
 */
const UID_DOMAIN = "fenced.app";

/** How long a subscribed client is asked to wait between fetches. */
const REFRESH_MINUTES = 60;

export interface FeedOptions {
  includeEvents: boolean;
  includeFencedHours: boolean;
  includeTaskDueDates: boolean;
  /** Days of history to publish; the future window is fixed at a year. */
  pastDays?: number;
  futureDays?: number;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventToIcs(row: typeof calendarEvents.$inferSelect): IcsEvent {
  const shared = {
    uid: `evt-${row.id}@${UID_DOMAIN}`,
    summary: row.title,
    description: row.notes,
    recurrenceRule: row.rrule,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categories: ["Fenced"],
    alarms: row.reminders.map((minutesBefore) => ({ minutesBefore })),
  } satisfies Omit<IcsEvent, "timing">;

  if (row.allDay) {
    // Rows store the exclusive end that Google uses; ICS all-day bounds are
    // written from an inclusive end, so step back a day (never past the start).
    const startKey = dateKey(row.startAt);
    const exclusiveEnd = dateKey(row.endAt);
    const inclusiveEnd =
      exclusiveEnd > startKey ? shiftDateKey(exclusiveEnd, -1) : startKey;
    return {
      ...shared,
      timing: { kind: "allDay", start: startKey, end: inclusiveEnd },
    };
  }

  return {
    ...shared,
    timing: { kind: "instant", start: row.startAt, end: row.endAt },
  };
}

/**
 * Renders a Fenced Hour as one recurring floating-time event.
 *
 * Floating rather than UTC because "14:00 on weekdays" is a wall-clock
 * commitment: pinning it to an instant would drift by an hour at each
 * daylight-saving change.
 */
function fencedHourToIcs(
  row: typeof fencedHours.$inferSelect,
  fenceName: string | null,
  now: Date
): IcsEvent | null {
  const rule = weeklyRule(row.daysOfWeek);
  if (!rule) return null;

  const anchor = firstOccurrenceOnOrAfter(now, row.daysOfWeek);
  if (!anchor) return null;

  const window = wallTimeWindow(
    localDateKey(anchor),
    row.startTime,
    row.endTime
  );

  return {
    uid: `fh-${row.id}@${UID_DOMAIN}`,
    summary: fenceName ? `Fenced: ${fenceName}` : "Fenced Hour",
    description:
      "Scheduled Fenced Hour — distracting apps are blocked during this window.",
    timing: { kind: "floating", start: window.start, end: window.end },
    recurrenceRule: rule,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    categories: ["Fenced", "Fenced Hours"],
  };
}

/**
 * A task due date becomes an all-day marker rather than a timed event: a
 * deadline is a day, and a timed block would wrongly claim busy time.
 */
function taskToIcs(row: typeof tasks.$inferSelect): IcsEvent | null {
  if (!row.dueAt) return null;
  const key = dateKey(row.dueAt);
  return {
    uid: `task-${row.id}@${UID_DOMAIN}`,
    summary: `Due: ${row.title}`,
    description: row.notes,
    timing: { kind: "allDay", start: key, end: key },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Deadlines should not make the whole day read as busy.
    transparency: "TRANSPARENT",
    categories: ["Fenced", "Tasks"],
  };
}

/** Builds the `text/calendar` body published for one user. */
export async function buildUserCalendar(
  userId: string,
  options: FeedOptions
): Promise<string> {
  const pastDays = options.pastDays ?? 60;
  const futureDays = options.futureDays ?? 365;
  const now = new Date();
  const windowStart = new Date(now.getTime() - pastDays * 86_400_000);
  const windowEnd = new Date(now.getTime() + futureDays * 86_400_000);

  const [user] = await db
    .select({ displayName: users.displayName, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const events: IcsEvent[] = [];

  if (options.includeEvents) {
    const rows = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, userId),
          gte(calendarEvents.startAt, windowStart),
          lte(calendarEvents.startAt, windowEnd)
        )
      );
    events.push(...rows.map(eventToIcs));
  }

  if (options.includeFencedHours) {
    const rows = await db
      .select({
        hour: fencedHours,
        fenceName: fences.name,
      })
      .from(fencedHours)
      .leftJoin(fences, eq(fencedHours.fenceId, fences.id))
      .where(
        and(eq(fencedHours.userId, userId), eq(fencedHours.enabled, true))
      );
    for (const { hour, fenceName } of rows) {
      const ics = fencedHourToIcs(hour, fenceName, now);
      if (ics) events.push(ics);
    }
  }

  if (options.includeTaskDueDates) {
    const rows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.completedAt),
          gte(tasks.dueAt, windowStart),
          lte(tasks.dueAt, windowEnd)
        )
      );
    for (const row of rows) {
      const ics = taskToIcs(row);
      if (ics) events.push(ics);
    }
  }

  return buildCalendar({
    name: user?.displayName ? `Fenced — ${user.displayName}` : "Fenced",
    description:
      "Focus sessions, planned blocks and Fenced Hours exported from Fenced.",
    timezone: user?.timezone ?? "UTC",
    refreshMinutes: REFRESH_MINUTES,
    events,
  });
}
