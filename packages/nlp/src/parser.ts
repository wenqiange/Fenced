import {
  addDays,
  addWeeks,
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
import type { Priority } from "@fenced/core";
import type { ParsedTask } from "./types";

const TAG_RE = /#(\w+)/g;
const PRIORITY_RE = /!(none|low|medium|high|urgent)\b/i;
const ESTIMATE_RE = /\b(\d+)\s*h\s*(\d+)\s*m\b|\b(\d+)\s*h\b|\b(\d+)\s*m\b/i;

const TIME_12H_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const TIME_24H_RE = /\bat\s+(\d{1,2}):(\d{2})\b/;

const DAY_NAMES: Record<string, (date: Date) => Date> = {
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
  sunday: nextSunday,
};

const MONTH_NAMES: Record<string, number> = {
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

function applyTime(date: Date, hours: number, minutes: number): Date {
  return setMinutes(setHours(date, hours), minutes);
}

function extractTime(input: string): { hours: number; minutes: number; match: string } | null {
  const m12 = TIME_12H_RE.exec(input);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = m12[2] ? parseInt(m12[2], 10) : 0;
    const period = m12[3].toLowerCase();
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return { hours, minutes, match: m12[0] };
  }
  const m24 = TIME_24H_RE.exec(input);
  if (m24) {
    return { hours: parseInt(m24[1], 10), minutes: parseInt(m24[2], 10), match: m24[0] };
  }
  return null;
}

function extractDate(input: string, ref: Date): { date: Date; match: string } | null {
  const lower = input.toLowerCase();

  const todayMatch = /\btoday\b/.exec(lower);
  if (todayMatch) return { date: ref, match: todayMatch[0] };

  const tomorrowMatch = /\btomorrow\b/.exec(lower);
  if (tomorrowMatch) return { date: addDays(ref, 1), match: tomorrowMatch[0] };

  const nextWeekMatch = /\bnext\s+week\b/.exec(lower);
  if (nextWeekMatch) return { date: nextMonday(addWeeks(ref, 0)), match: nextWeekMatch[0] };

  for (const [name, fn] of Object.entries(DAY_NAMES)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    const m = re.exec(lower);
    if (m) return { date: fn(ref), match: m[0] };
  }

  // "jul 30", "july 30"
  const monthDayRe = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i;
  const mdMatch = monthDayRe.exec(input);
  if (mdMatch) {
    const month = MONTH_NAMES[mdMatch[1].toLowerCase().slice(0, 3)]!;
    const day = parseInt(mdMatch[2], 10);
    const d = new Date(ref.getFullYear(), month, day);
    if (d < ref) d.setFullYear(d.getFullYear() + 1);
    return { date: d, match: mdMatch[0] };
  }

  // "7/30"
  const slashRe = /\b(\d{1,2})\/(\d{1,2})\b/;
  const slashMatch = slashRe.exec(input);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const d = new Date(ref.getFullYear(), month, day);
    if (d < ref) d.setFullYear(d.getFullYear() + 1);
    return { date: d, match: slashMatch[0] };
  }

  // "2026-07-30"
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/;
  const isoMatch = isoRe.exec(input);
  if (isoMatch) {
    const d = parse(isoMatch[0], "yyyy-MM-dd", ref);
    return { date: d, match: isoMatch[0] };
  }

  return null;
}

export function parseTaskInput(input: string, referenceDate?: Date): ParsedTask {
  const ref = referenceDate ?? new Date();
  let remaining = input;

  const tags: string[] = [];
  let tagMatch: RegExpExecArray | null;
  const tagRe = new RegExp(TAG_RE.source, TAG_RE.flags);
  while ((tagMatch = tagRe.exec(remaining)) !== null) {
    tags.push(tagMatch[1]);
  }
  remaining = remaining.replace(TAG_RE, "");

  let priority: Priority = "none";
  const prioMatch = PRIORITY_RE.exec(remaining);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as Priority;
    remaining = remaining.replace(prioMatch[0], "");
  }

  let estimateMinutes: number | null = null;
  const estMatch = ESTIMATE_RE.exec(remaining);
  if (estMatch) {
    if (estMatch[1] !== undefined && estMatch[2] !== undefined) {
      estimateMinutes = parseInt(estMatch[1], 10) * 60 + parseInt(estMatch[2], 10);
    } else if (estMatch[3] !== undefined) {
      estimateMinutes = parseInt(estMatch[3], 10) * 60;
    } else if (estMatch[4] !== undefined) {
      estimateMinutes = parseInt(estMatch[4], 10);
    }
    remaining = remaining.replace(estMatch[0], "");
  }

  let dueAt: Date | null = null;

  const timeResult = extractTime(remaining);
  if (timeResult) {
    remaining = remaining.replace(timeResult.match, "");
  }

  const dateResult = extractDate(remaining, ref);
  if (dateResult) {
    dueAt = dateResult.date;
    remaining = remaining.replace(dateResult.match, "");
  }

  if (timeResult) {
    if (dueAt) {
      dueAt = applyTime(dueAt, timeResult.hours, timeResult.minutes);
    } else {
      dueAt = applyTime(ref, timeResult.hours, timeResult.minutes);
    }
  }

  const title = remaining.replace(/\s+/g, " ").trim();

  return {
    title,
    dueAt,
    estimateMinutes,
    priority,
    tags,
    rrule: null,
    isAmbiguous: false,
  };
}
