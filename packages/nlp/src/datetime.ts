import {
  addDays,
  addWeeks,
  lastDayOfMonth,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  setHours,
  setMinutes,
  parse,
} from "date-fns";

const TIME_12H_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const TIME_24H_RE = /\bat\s+(\d{1,2}):(\d{2})\b/;
const TIME_BARE_HOUR_RE = /\bat\s+(\d{1,2})\b(?!\s*[:.]\d)/i;

export const DAY_NAMES: Record<string, (date: Date) => Date> = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
};

export const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_WORDS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

export interface ExtractedTime {
  hours: number;
  minutes: number;
  match: string;
  /** True when the input gave a bare hour and we picked a half of the day for it. */
  meridiemAssumed: boolean;
}

export interface ExtractedDate {
  date: Date;
  match: string;
  /** True when the input named a month with no day, so the date covers a whole month. */
  monthOnly: boolean;
}

export function applyTime(date: Date, hours: number, minutes: number): Date {
  return setMinutes(setHours(date, hours), minutes);
}

export function extractTime(input: string): ExtractedTime | null {
  const m12 = TIME_12H_RE.exec(input);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3].toLowerCase();
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return { hours, minutes, match: m12[0], meridiemAssumed: false };
  }

  const m24 = TIME_24H_RE.exec(input);
  if (m24) {
    return {
      hours: parseInt(m24[1], 10),
      minutes: parseInt(m24[2], 10),
      match: m24[0],
      meridiemAssumed: false,
    };
  }

  const bare = TIME_BARE_HOUR_RE.exec(input);
  if (bare) {
    const raw = parseInt(bare[1], 10);
    if (raw > 23) return null;
    // 1-6 reads as the afternoon far more often than the small hours.
    const hours = raw >= 1 && raw <= 6 ? raw + 12 : raw;
    return { hours, minutes: 0, match: bare[0], meridiemAssumed: raw <= 12 };
  }

  return null;
}

const DATE_PREPOSITION_RE = /\b(?:on|by|due(?:\s+on)?|before)\s+$/i;

export function extractDate(input: string, ref: Date): ExtractedDate | null {
  const found = findDate(input, ref);
  if (!found) return null;

  // Absorb a preposition that introduced the date, so "pay rent on 3 September"
  // does not leave a stray "on" in the title.
  const prefix = DATE_PREPOSITION_RE.exec(input.slice(0, found.index));
  return {
    date: found.date,
    match: prefix ? `${prefix[0]}${found.match}` : found.match,
    monthOnly: found.monthOnly,
  };
}

function findDate(input: string, ref: Date): (ExtractedDate & { index: number }) | null {
  const lower = input.toLowerCase();

  const todayMatch = /\btoday\b/.exec(lower);
  if (todayMatch) return { date: ref, match: todayMatch[0], monthOnly: false, index: todayMatch.index };

  const tomorrowMatch = /\btomorrow\b/.exec(lower);
  if (tomorrowMatch) {
    return { date: addDays(ref, 1), match: tomorrowMatch[0], monthOnly: false, index: tomorrowMatch.index };
  }

  const nextWeekMatch = /\bnext\s+week\b/.exec(lower);
  if (nextWeekMatch) {
    return {
      date: nextMonday(addWeeks(ref, 0)),
      match: nextWeekMatch[0],
      monthOnly: false,
      index: nextWeekMatch.index,
    };
  }

  for (const [name, fn] of Object.entries(DAY_NAMES)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    const m = re.exec(lower);
    if (m) return { date: fn(ref), match: m[0], monthOnly: false, index: m.index };
  }

  // "jul 30", "july 30"
  const monthDayRe = new RegExp(`\\b(${MONTH_WORDS})\\s+(\\d{1,2})\\b`, "i");
  const mdMatch = monthDayRe.exec(input);
  if (mdMatch) {
    return {
      date: monthDayDate(mdMatch[1], parseInt(mdMatch[2], 10), ref),
      match: mdMatch[0],
      monthOnly: false,
      index: mdMatch.index,
    };
  }

  // "30 july"
  const dayMonthRe = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_WORDS})\\b`, "i");
  const dmMatch = dayMonthRe.exec(input);
  if (dmMatch) {
    return {
      date: monthDayDate(dmMatch[2], parseInt(dmMatch[1], 10), ref),
      match: dmMatch[0],
      monthOnly: false,
      index: dmMatch.index,
    };
  }

  // "7/30"
  const slashRe = /\b(\d{1,2})\/(\d{1,2})\b/;
  const slashMatch = slashRe.exec(input);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const d = new Date(ref.getFullYear(), month, day);
    if (d < ref) d.setFullYear(d.getFullYear() + 1);
    return { date: d, match: slashMatch[0], monthOnly: false, index: slashMatch.index };
  }

  // "2026-07-30"
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/;
  const isoMatch = isoRe.exec(input);
  if (isoMatch) {
    return {
      date: parse(isoMatch[0], "yyyy-MM-dd", ref),
      match: isoMatch[0],
      monthOnly: false,
      index: isoMatch.index,
    };
  }

  // A bare month name, e.g. "until June" — resolves to the end of that month.
  const monthOnlyRe = new RegExp(`\\b(${MONTH_WORDS})\\b`, "i");
  const monthMatch = monthOnlyRe.exec(input);
  if (monthMatch) {
    const month = MONTH_NAMES[monthMatch[1].toLowerCase().slice(0, 3)]!;
    let d = new Date(ref.getFullYear(), month, 1);
    if (d < ref) d = new Date(ref.getFullYear() + 1, month, 1);
    return { date: lastDayOfMonth(d), match: monthMatch[0], monthOnly: true, index: monthMatch.index };
  }

  return null;
}

function monthDayDate(monthWord: string, day: number, ref: Date): Date {
  const month = MONTH_NAMES[monthWord.toLowerCase().slice(0, 3)]!;
  const d = new Date(ref.getFullYear(), month, day);
  if (d < ref) d.setFullYear(d.getFullYear() + 1);
  return d;
}
