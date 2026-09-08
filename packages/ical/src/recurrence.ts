/** RFC 5545 BYDAY codes indexed by `Date#getDay()`. */
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/**
 * Builds a weekly RRULE from `Date#getDay()` numbers, e.g. `[1,2,3,4,5]` →
 * `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`.
 *
 * Returns `null` for an empty selection, since a BYDAY-less weekly rule would
 * silently fall back to repeating on whatever weekday DTSTART lands on.
 */
export function weeklyRule(daysOfWeek: number[]): string | null {
  const days = [...new Set(daysOfWeek)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => BYDAY[d]);
  if (days.length === 0) return null;
  return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
}

/**
 * First date on or after `from` that falls on one of `daysOfWeek`.
 *
 * A weekly RRULE's DTSTART must itself be an occurrence; anchoring it to an
 * excluded weekday makes clients render a phantom first instance.
 */
export function firstOccurrenceOnOrAfter(
  from: Date,
  daysOfWeek: number[]
): Date | null {
  const allowed = new Set(daysOfWeek);
  if (allowed.size === 0) return null;
  const cursor = new Date(from);
  for (let i = 0; i < 7; i++) {
    if (allowed.has(cursor.getDay())) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** `YYYY-MM-DD` in local time — `toISOString` would shift across the date line. */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Minutes since midnight for an `HH:MM` wall time. */
export function minutesOfDay(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Resolves an `HH:MM`–`HH:MM` window anchored on `dateKey` into floating
 * wall-time bounds, rolling the end into the next day when the window crosses
 * midnight (a 22:00–01:00 block).
 */
export function wallTimeWindow(
  dateKey: string,
  startTime: string,
  endTime: string
): { start: string; end: string } {
  const start = `${dateKey}T${startTime}`;
  if (minutesOfDay(endTime) > minutesOfDay(startTime)) {
    return { start, end: `${dateKey}T${endTime}` };
  }
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  return { start, end: `${next.toISOString().slice(0, 10)}T${endTime}` };
}
