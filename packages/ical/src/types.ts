/**
 * When an event happens. The three forms are not interchangeable — picking the
 * wrong one is how calendar exports drift by an hour twice a year:
 *
 * - `instant`  a fixed point in time (a meeting) → written as UTC.
 * - `allDay`   a whole day (a due date) → written as DATE, end exclusive.
 * - `floating` a wall-clock time that should stay put in any zone (a recurring
 *              "14:00 focus block") → written with neither `Z` nor `TZID`.
 */
export type IcsTiming =
  | { kind: "instant"; start: Date; end: Date }
  /** `start`/`end` are `YYYY-MM-DD`; `end` is the last day *inclusive*. */
  | { kind: "allDay"; start: string; end: string }
  /** `start`/`end` are `YYYY-MM-DDTHH:MM`. */
  | { kind: "floating"; start: string; end: string };

export interface IcsAlarm {
  /** Minutes before the start. `10` renders as `TRIGGER:-PT10M`. */
  minutesBefore: number;
  description?: string;
}

export interface IcsEvent {
  /**
   * Stable, globally unique id. Reusing the same UID across exports lets a
   * subscribed client update an event instead of duplicating it, so derive it
   * from the source row rather than generating a fresh one each build.
   */
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  timing: IcsTiming;
  /** RRULE value without the `RRULE:` prefix, e.g. `FREQ=WEEKLY;BYDAY=MO,TU`. */
  recurrenceRule?: string | null;
  /** Last modification time; drives SEQUENCE-free change detection in clients. */
  updatedAt?: Date | null;
  createdAt?: Date | null;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  /** `OPAQUE` blocks the time in free/busy views; `TRANSPARENT` does not. */
  transparency?: "OPAQUE" | "TRANSPARENT";
  categories?: string[];
  alarms?: IcsAlarm[];
  /** Optional URL a client can link back to. */
  url?: string | null;
}

export interface IcsCalendar {
  /** Shown as the calendar name in Google/Outlook/Apple. */
  name: string;
  description?: string;
  /** IANA zone published as a hint (`X-WR-TIMEZONE`), e.g. `Europe/Madrid`. */
  timezone?: string;
  /**
   * How often a subscribed client should re-fetch, in minutes. Emitted as both
   * `REFRESH-INTERVAL` (RFC 7986) and `X-PUBLISHED-TTL` (what Outlook reads).
   */
  refreshMinutes?: number;
  events: IcsEvent[];
}
