const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const DAY_MS = 86_400_000;

function parseRrule(rrule: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const chunk of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.toUpperCase(), value);
  }
  return parts;
}

function parseUntil(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value);
  if (!m) return null;
  // A date-only UNTIL is inclusive of that whole local day.
  if (!m[4]) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
}

function dayIndex(d: Date): number {
  // Local calendar day number; DST-safe because it ignores the time of day.
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/**
 * Next occurrence of a recurring task after `anchor` (its current due date),
 * skipped forward so it is never earlier than `notBefore`'s calendar day.
 *
 * Keeps the anchor's time of day. Supports FREQ, INTERVAL, BYDAY (plain
 * codes), BYMONTHDAY (incl. -1) and UNTIL — everything the parser emits.
 * shortcut: COUNT is ignored because tasks don't track how many occurrences
 * were done; add an occurrence counter on the task if COUNT rules appear.
 */
export function nextOccurrence(
  rrule: string,
  anchor: Date,
  notBefore: Date = anchor,
): Date | null {
  const parts = parseRrule(rrule);
  const freq = parts.get("FREQ");
  if (!freq) return null;
  const interval = Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1);
  const byDay = (parts.get("BYDAY")?.split(",") ?? [])
    .map((c) => c.trim().toUpperCase().slice(-2))
    .filter((c) => (WEEKDAY_CODES as readonly string[]).includes(c));
  const byMonthDay = (parts.get("BYMONTHDAY")?.split(",") ?? [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n !== 0);
  const untilRaw = parts.get("UNTIL");
  const until = untilRaw ? parseUntil(untilRaw) : null;

  const anchorDay = dayIndex(anchor);
  const anchorWeekStart = anchorDay - anchor.getDay();
  const minDay = Math.max(anchorDay + 1, dayIndex(notBefore));

  const matches = (d: Date): boolean => {
    const di = dayIndex(d);
    switch (freq) {
      case "DAILY":
        return (di - anchorDay) % interval === 0;
      case "WEEKLY": {
        const codes = byDay.length ? byDay : [WEEKDAY_CODES[anchor.getDay()]];
        if (!codes.includes(WEEKDAY_CODES[d.getDay()])) return false;
        return ((di - d.getDay() - anchorWeekStart) / 7) % interval === 0;
      }
      case "MONTHLY": {
        const months = (d.getFullYear() - anchor.getFullYear()) * 12 + d.getMonth() - anchor.getMonth();
        if (months % interval !== 0) return false;
        const dim = daysInMonth(d.getFullYear(), d.getMonth());
        const wanted = byMonthDay.length ? byMonthDay : [anchor.getDate()];
        return wanted.some((n) => (n < 0 ? dim + 1 + n : n) === d.getDate());
      }
      case "YEARLY":
        return (
          (d.getFullYear() - anchor.getFullYear()) % interval === 0 &&
          d.getMonth() === anchor.getMonth() &&
          d.getDate() === anchor.getDate()
        );
      default:
        return false;
    }
  };

  // Bounded scan: worst case is a yearly rule with a large interval.
  const limit = 366 * Math.min(interval, 10) + 31;
  for (let offset = 0; offset <= limit; offset++) {
    const di = minDay + offset;
    const base = new Date(di * DAY_MS);
    const candidate = new Date(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      anchor.getHours(),
      anchor.getMinutes(),
      anchor.getSeconds(),
    );
    if (until && candidate > until) return null;
    if (matches(candidate)) return candidate;
  }
  return null;
}
