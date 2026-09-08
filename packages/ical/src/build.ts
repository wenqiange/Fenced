import {
  CRLF,
  escapeText,
  foldLine,
  formatDate,
  formatFloating,
  formatUtc,
} from "./escape";
import type { IcsCalendar, IcsEvent, IcsTiming } from "./types";

const PRODID = "-//Fenced//Fenced Calendar Export//EN";

/** Advances a `YYYY-MM-DD` key by one day, honouring month and year rollover. */
function nextDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function timingLines(timing: IcsTiming): string[] {
  switch (timing.kind) {
    case "instant":
      return [
        `DTSTART:${formatUtc(timing.start)}`,
        `DTEND:${formatUtc(timing.end)}`,
      ];
    case "allDay":
      // RFC 5545 §3.6.1: DTEND for a DATE value is exclusive, so a single-day
      // event ends on the following day. Emitting the same day would render as
      // a zero-length event (or get dropped) in most clients.
      return [
        `DTSTART;VALUE=DATE:${formatDate(timing.start)}`,
        `DTEND;VALUE=DATE:${formatDate(nextDay(timing.end))}`,
      ];
    case "floating":
      return [
        `DTSTART:${formatFloating(timing.start)}`,
        `DTEND:${formatFloating(timing.end)}`,
      ];
  }
}

function eventLines(event: IcsEvent, stamp: Date): string[] {
  const lines: string[] = ["BEGIN:VEVENT", `UID:${event.uid}`];

  lines.push(`DTSTAMP:${formatUtc(stamp)}`);
  lines.push(...timingLines(event.timing));
  lines.push(`SUMMARY:${escapeText(event.summary)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.recurrenceRule) {
    lines.push(`RRULE:${event.recurrenceRule}`);
  }
  if (event.createdAt) {
    lines.push(`CREATED:${formatUtc(event.createdAt)}`);
  }
  if (event.updatedAt) {
    lines.push(`LAST-MODIFIED:${formatUtc(event.updatedAt)}`);
  }
  lines.push(`STATUS:${event.status ?? "CONFIRMED"}`);
  lines.push(`TRANSP:${event.transparency ?? "OPAQUE"}`);

  if (event.categories?.length) {
    lines.push(
      `CATEGORIES:${event.categories.map((c) => escapeText(c)).join(",")}`
    );
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  for (const alarm of event.alarms ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `TRIGGER:-PT${Math.max(0, Math.round(alarm.minutesBefore))}M`,
      `DESCRIPTION:${escapeText(alarm.description ?? event.summary)}`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * Serialises a calendar to an RFC 5545 `text/calendar` body.
 *
 * `stamp` is injectable so tests can assert on exact output; production callers
 * should leave it at the default.
 */
export function buildCalendar(calendar: IcsCalendar, stamp = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    // PUBLISH marks this as a one-way feed rather than an invitation.
    "METHOD:PUBLISH",
    `NAME:${escapeText(calendar.name)}`,
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
  ];

  if (calendar.description) {
    lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);
  }
  if (calendar.timezone) {
    lines.push(`X-WR-TIMEZONE:${calendar.timezone}`);
  }
  if (calendar.refreshMinutes) {
    const duration = `PT${Math.max(1, Math.round(calendar.refreshMinutes))}M`;
    // RFC 7986 for modern clients; X-PUBLISHED-TTL for Outlook.
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:${duration}`);
    lines.push(`X-PUBLISHED-TTL:${duration}`);
  }

  for (const event of calendar.events) {
    lines.push(...eventLines(event, stamp));
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 §3.1 mandates CRLF, including a trailing one after the last line.
  return lines.map(foldLine).join(CRLF) + CRLF;
}
