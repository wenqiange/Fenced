/** RFC 5545 §3.1 — properties are folded at 75 octets with a leading space. */
const MAX_OCTETS = 75;

export const CRLF = "\r\n";

/**
 * RFC 5545 §3.3.11 — TEXT values escape backslash, semicolon, comma and
 * newlines. Backslash goes first so the escapes it introduces are not
 * themselves re-escaped.
 */
export function escapeText(value: string): string {
  return value
    .split("\\")
    .join("\\\\")
    .split(";")
    .join("\\;")
    .split(",")
    .join("\\,")
    .split("\r\n")
    .join("\\n")
    .split("\r")
    .join("\\n")
    .split("\n")
    .join("\\n");
}

/**
 * Folds one content line to 75 octets per RFC 5545 §3.1.
 *
 * Counting octets rather than characters matters: a title with accents or emoji
 * would otherwise produce lines that are legal in length but split a multi-byte
 * sequence, which some parsers reject.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= MAX_OCTETS) return line;

  const parts: string[] = [];
  let offset = 0;
  // The first line gets 75 octets; continuations get 74, since the leading
  // space that marks them counts toward the limit.
  let budget = MAX_OCTETS;

  while (offset < bytes.length) {
    let take = Math.min(budget, bytes.length - offset);
    // Never split a UTF-8 sequence: back off while the next byte is a
    // continuation byte (10xxxxxx).
    while (take > 0 && offset + take < bytes.length) {
      if ((bytes[offset + take] & 0xc0) !== 0x80) break;
      take -= 1;
    }
    if (take <= 0) take = Math.min(budget, bytes.length - offset);
    parts.push(bytes.subarray(offset, offset + take).toString("utf8"));
    offset += take;
    budget = MAX_OCTETS - 1;
  }

  return parts.join(CRLF + " ");
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** `20260908T143000Z` — the UTC form used for fixed points in time. */
export function formatUtc(date: Date): string {
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/** `20260908` from a `YYYY-MM-DD` key, for DATE-valued all-day bounds. */
export function formatDate(dateKey: string): string {
  return dateKey.split("-").join("");
}

/**
 * `20260908T140000` from a `YYYY-MM-DDTHH:MM` wall time.
 *
 * Deliberately emits no `Z` and no `TZID`: RFC 5545 §3.3.5 calls this a
 * floating time, which each client reads in its own zone. That is exactly what
 * a recurring "14:00 on weekdays" block means, and it survives daylight-saving
 * shifts without shipping a VTIMEZONE component.
 */
export function formatFloating(wallTime: string): string {
  const [datePart, timePart = "00:00"] = wallTime.split("T");
  const [hh = "00", mm = "00", ss = "00"] = timePart.split(":");
  return `${formatDate(datePart)}T${hh}${mm}${ss}`;
}
