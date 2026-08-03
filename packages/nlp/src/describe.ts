const DAY_LABELS: Record<string, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

const UNIT_LABELS: Record<string, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

const PLAIN_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

/**
 * Turns an RRULE back into a short phrase for chips and task rows,
 * e.g. "Every 2 weeks on Mon, Thu until Jun 30".
 */
export function describeRrule(rrule: string | null | undefined): string | null {
  if (!rrule) return null;

  const parts = new Map<string, string>();
  for (const chunk of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.toUpperCase(), value);
  }

  const freq = parts.get("FREQ");
  if (!freq || !UNIT_LABELS[freq]) return null;

  const interval = Number(parts.get("INTERVAL") ?? 1);
  const byDay = parts.get("BYDAY")?.split(",").filter(Boolean) ?? [];
  const byMonthDay = parts.get("BYMONTHDAY")?.split(",").filter(Boolean) ?? [];

  let text: string;
  if (freq === "WEEKLY" && byDay.length > 0) {
    const days = describeDays(byDay);
    text = interval > 1 ? `Every ${interval} weeks on ${days}` : `Every ${days}`;
    if (interval === 1 && (days === "weekdays" || days === "weekends")) {
      text = days.charAt(0).toUpperCase() + days.slice(1);
    }
  } else if (freq === "MONTHLY" && byMonthDay.length > 0) {
    const days = byMonthDay.map(describeMonthDay).join(", ");
    text = interval > 1 ? `Every ${interval} months on the ${days}` : `Monthly on the ${days}`;
  } else if (interval > 1) {
    text = `Every ${interval} ${UNIT_LABELS[freq]}s`;
  } else {
    text = PLAIN_LABELS[freq]!;
  }

  const until = parts.get("UNTIL");
  if (until) {
    const date = parseUntil(until);
    if (date) text += ` until ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  const count = parts.get("COUNT");
  if (count && !until) text += ` (${count} times)`;

  return text;
}

function describeDays(byDay: string[]): string {
  const codes = byDay.map((d) => d.slice(-2).toUpperCase());
  const set = new Set(codes);
  if (set.size === 5 && ["MO", "TU", "WE", "TH", "FR"].every((d) => set.has(d))) return "weekdays";
  if (set.size === 2 && set.has("SA") && set.has("SU")) return "weekends";
  return codes.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

function describeMonthDay(raw: string): string {
  const day = Number(raw);
  if (day === -1) return "last day";
  if (day >= 11 && day <= 13) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

function parseUntil(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw);
  if (!m) return null;
  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    ),
  );
}
