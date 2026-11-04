import { endOfDay } from "date-fns";
import { extractDate } from "./datetime";
import type { ParsedRecurrence, RecurrenceFreq } from "./types";

const DAY_CODES: Array<[string, string]> = [
  ["mondays?|mon|lunes|dilluns", "MO"],
  ["tuesdays?|tues|tue|martes|dimarts", "TU"],
  ["wednesdays?|weds|wed|miércoles|miercoles|dimecres", "WE"],
  ["thursdays?|thurs|thur|thu|jueves|dijous", "TH"],
  ["fridays?|fri|viernes|divendres", "FR"],
  ["saturdays?|sats?|sábados?|sabados?|dissabtes?", "SA"],
  ["sundays?|suns?|domingos?|diumenges?", "SU"],
];

const DAY_WORDS = DAY_CODES.map(([words]) => words).join("|");
const DAY_LIST = `(?:${DAY_WORDS})(?:\\s*(?:,|and|&|\\+|y|i)\\s*(?:${DAY_WORDS}))*`;
const DAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const NUMBER_WORDS: Record<string, number> = {
  other: 2,
  otro: 2,
  altre: 2,
  one: 1, uno: 1, un: 1,
  two: 2, dos: 2,
  three: 3, tres: 3,
  four: 4, cuatro: 4, quatre: 4,
  five: 5, cinco: 5, cinc: 5,
  six: 6, seis: 6, sis: 6,
  seven: 7, siete: 7, set: 7,
  eight: 8, ocho: 8, vuit: 8,
  nine: 9, nueve: 9, nou: 9,
  ten: 10, diez: 10, deu: 10,
  eleven: 11, once: 11, onze: 11,
  twelve: 12, doce: 12, dotze: 12,
};
const INTERVAL = `(?:other|otro|altre|\\d{1,3}|${Object.keys(NUMBER_WORDS).filter((w) => w !== "other" && w !== "otro" && w !== "altre").join("|")})`;

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, primero: 1, primer: 1,
  second: 2, segundo: 2, segon: 2,
  third: 3, tercero: 3, tercer: 3,
  fourth: 4, cuarto: 4, quart: 4,
  fifth: 5, quinto: 5, cinquè: 5,
  last: -1, ultimo: -1, último: -1, darrer: -1, últim: -1,
};
const ORDINAL = `(?:first|second|third|fourth|fifth|last|primero|primer|segundo|segon|tercero|tercer|cuarto|quart|quinto|cinquè|ultimo|último|darrer|últim|\\d{1,2}(?:st|nd|rd|th|º|ª)?)`;
const ORDINAL_LIST = `${ORDINAL}(?:\\s*(?:,|and|&|y|i)\\s*${ORDINAL})*`;

const UNIT_FREQ: Record<string, RecurrenceFreq> = {
  day: "DAILY", dia: "DAILY", dies: "DAILY", dias: "DAILY",
  week: "WEEKLY", semana: "WEEKLY", semanas: "WEEKLY", setmana: "WEEKLY", setmanes: "WEEKLY",
  month: "MONTHLY", mes: "MONTHLY", meses: "MONTHLY", mesos: "MONTHLY",
  year: "YEARLY", ano: "YEARLY", anos: "YEARLY", año: "YEARLY", años: "YEARLY", any: "YEARLY", anys: "YEARLY",
};

const ADVERB_FREQ: Record<string, { freq: RecurrenceFreq; interval: number }> = {
  daily: { freq: "DAILY", interval: 1 },
  diario: { freq: "DAILY", interval: 1 },
  diariamente: { freq: "DAILY", interval: 1 },
  diari: { freq: "DAILY", interval: 1 },
  weekly: { freq: "WEEKLY", interval: 1 },
  semanal: { freq: "WEEKLY", interval: 1 },
  semanalmente: { freq: "WEEKLY", interval: 1 },
  setmanal: { freq: "WEEKLY", interval: 1 },
  biweekly: { freq: "WEEKLY", interval: 2 },
  fortnightly: { freq: "WEEKLY", interval: 2 },
  monthly: { freq: "MONTHLY", interval: 1 },
  mensual: { freq: "MONTHLY", interval: 1 },
  mensualmente: { freq: "MONTHLY", interval: 1 },
  mensualment: { freq: "MONTHLY", interval: 1 },
  quarterly: { freq: "MONTHLY", interval: 3 },
  trimestral: { freq: "MONTHLY", interval: 3 },
  yearly: { freq: "YEARLY", interval: 1 },
  anual: { freq: "YEARLY", interval: 1 },
  anualmente: { freq: "YEARLY", interval: 1 },
  anualment: { freq: "YEARLY", interval: 1 },
  annually: { freq: "YEARLY", interval: 1 },
};

export interface ExtractedRecurrence {
  recurrence: ParsedRecurrence;
  /** Every source fragment consumed, so the caller can strip them from the title. */
  matches: string[];
  /** Source text of an end date that named a month with no day, e.g. "until June". */
  monthOnlyUntil: string | null;
}

export function extractRecurrence(input: string, ref: Date): ExtractedRecurrence | null {
  const base = matchFrequency(input);
  if (!base) return null;

  const matches = [...base.matches];
  let remaining = stripAll(input, matches);

  let until: Date | null = null;
  let count: number | null = null;
  let monthOnlyUntil: string | null = null;

  const end = matchUntil(remaining, ref);
  if (end) {
    until = end.date;
    monthOnlyUntil = end.monthOnly ? end.match : null;
    matches.push(end.match);
    remaining = stripAll(remaining, [end.match]);
  }

  const times = matchCount(remaining, base.freq);
  if (times) {
    count = times.count;
    matches.push(times.match);
  }

  const recurrence: ParsedRecurrence = {
    rrule: "",
    freq: base.freq,
    interval: base.interval,
    byDay: base.byDay,
    byMonthDay: base.byMonthDay,
    until,
    // COUNT and UNTIL are mutually exclusive in RFC 5545; an explicit end date wins.
    count: until ? null : count,
  };
  recurrence.rrule = buildRrule(recurrence);

  return { recurrence, matches, monthOnlyUntil };
}

interface FrequencyMatch {
  freq: RecurrenceFreq;
  interval: number;
  byDay: string[];
  byMonthDay: number[];
  matches: string[];
}

function matchFrequency(input: string): FrequencyMatch | null {
  // "the first of each month", "on the 1st and 15th of every month"
  const monthDayOf = new RegExp(
    `\\b(?:on\\s+)?(?:the\\s+)?(${ORDINAL_LIST})\\s+(?:day\\s+)?of\\s+(?:each|every|the)\\s+month\\b`,
    "i",
  ).exec(input);
  if (monthDayOf) {
    return {
      freq: "MONTHLY",
      interval: 1,
      byDay: [],
      byMonthDay: parseOrdinalList(monthDayOf[1]),
      matches: [monthDayOf[0]],
    };
  }

  // "every month on the 3rd"
  const monthOnThe = new RegExp(
    `\\b(?:every|each|cada)\\s+(?:month|mes)\\s+(?:on\\s+the|el)\\s+(${ORDINAL_LIST})\\b`,
    "i",
  ).exec(input);
  if (monthOnThe) {
    return {
      freq: "MONTHLY",
      interval: 1,
      byDay: [],
      byMonthDay: parseOrdinalList(monthOnThe[1]),
      matches: [monthOnThe[0]],
    };
  }

  // "every monday", "every other tuesday", "every mon, wed and fri", "cada lunes", "tots els dilluns"
  const everyDays = new RegExp(
    `\\b(?:every|each|cada|tots?\\s+els?|totes?\\s+les?)\\s+(?:(${INTERVAL})\\s+)?(${DAY_LIST})\\b`,
    "i",
  ).exec(input);
  if (everyDays) {
    return {
      freq: "WEEKLY",
      interval: parseInterval(everyDays[1]),
      byDay: parseDayList(everyDays[2]),
      byMonthDay: [],
      matches: [everyDays[0]],
    };
  }

  // "weekdays at 9", "every weekend". The bare singular ("plan the weekend") is left alone.
  const span = /\b(?:(?:every|each|cada|tots?\s+els?)\s+(weekdays?|weekends?|dias\s+laborables|dies\s+laborables|fines\s+de\s+semana|caps\s+de\s+setmana)|(weekdays|weekends))\b/i.exec(input);
  if (span) {
    const raw = (span[1] ?? span[2]).toLowerCase();
    const isWeekend = raw.includes("weekend") || raw.includes("fin") || raw.includes("cap");
    return {
      freq: "WEEKLY",
      interval: 1,
      byDay: isWeekend ? ["SA", "SU"] : ["MO", "TU", "WE", "TH", "FR"],
      byMonthDay: [],
      matches: [span[0]],
    };
  }

  // "every day", "every two weeks", "every 3 months", "cada 2 semanas", "cada 3 mesos"
  const everyUnit = new RegExp(
    `\\b(?:every|each|cada|tots?\\s+els?|totes?\\s+les?)\\s+(?:(${INTERVAL})\\s+)?(${Object.keys(UNIT_FREQ).join("|")})s?\\b`,
    "i",
  ).exec(input);
  if (everyUnit) {
    const freq = UNIT_FREQ[everyUnit[2].toLowerCase()]!;
    const matches = [everyUnit[0]];
    let byDay: string[] = [];

    if (freq === "WEEKLY") {
      const on = new RegExp(`\\b(?:on|el|los|els)\\s+(${DAY_LIST})\\b`, "i").exec(stripAll(input, matches));
      if (on) {
        byDay = parseDayList(on[1]);
        matches.push(on[0]);
      }
    }

    return { freq, interval: parseInterval(everyUnit[1]), byDay, byMonthDay: [], matches };
  }

  // "daily", "biweekly", "quarterly"
  const adverb = new RegExp(`\\b(${Object.keys(ADVERB_FREQ).join("|")})\\b`, "i").exec(input);
  if (adverb) {
    const spec = ADVERB_FREQ[adverb[1].toLowerCase()]!;
    return {
      freq: spec.freq,
      interval: spec.interval,
      byDay: [],
      byMonthDay: [],
      matches: [adverb[0]],
    };
  }

  return null;
}

function matchUntil(
  input: string,
  ref: Date,
): { date: Date; match: string; monthOnly: boolean } | null {
  const keyword = /\b(until|till|thru|through|hasta|fins(?:\s+a)?)\s+/i.exec(input);
  if (!keyword) return null;

  const tail = input.slice(keyword.index + keyword[0].length);
  const date = extractDate(tail, ref);
  if (!date) return null;

  return {
    date: endOfDay(date.date),
    match: `${keyword[0]}${date.match}`,
    monthOnly: date.monthOnly,
  };
}

function matchCount(input: string, freq: RecurrenceFreq): { count: number; match: string } | null {
  const times = /\b(?:(?:for|durante|durant)\s+)?(\d{1,3})\s+(?:times|veces|vegades)\b/i.exec(input);
  if (times) return { count: parseInt(times[1], 10), match: times[0] };

  // "for 10 weeks" only reads as a count when the unit matches the frequency.
  const forUnit = /\b(?:for|durante|durant)\s+(\d{1,3})\s+(day|week|month|year|d[ií]a|dies|dias|semana|setmana|mes|meses|mesos|a[ñn]o|any)s?\b/i.exec(input);
  if (forUnit && UNIT_FREQ[forUnit[2].toLowerCase()] === freq) {
    return { count: parseInt(forUnit[1], 10), match: forUnit[0] };
  }

  return null;
}

function buildRrule(recurrence: ParsedRecurrence): string {
  const parts = [`FREQ=${recurrence.freq}`];
  if (recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`);
  if (recurrence.byDay.length > 0) parts.push(`BYDAY=${recurrence.byDay.join(",")}`);
  if (recurrence.byMonthDay.length > 0) parts.push(`BYMONTHDAY=${recurrence.byMonthDay.join(",")}`);
  if (recurrence.until) parts.push(`UNTIL=${formatUntil(recurrence.until)}`);
  if (recurrence.count) parts.push(`COUNT=${recurrence.count}`);
  return parts.join(";");
}

function formatUntil(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function parseInterval(raw: string | undefined): number {
  if (!raw) return 1;
  const word = NUMBER_WORDS[raw.toLowerCase()];
  if (word) return word;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseDayList(text: string): string[] {
  const re = new RegExp(`(?:${DAY_WORDS})`, "gi");
  const codes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = dayCode(m[0]);
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function dayCode(word: string): string | null {
  for (const [words, code] of DAY_CODES) {
    if (new RegExp(`^(?:${words})$`, "i").test(word)) return code;
  }
  return null;
}

function parseOrdinalList(text: string): number[] {
  const re = new RegExp(ORDINAL, "gi");
  const days: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].toLowerCase();
    const day = ORDINAL_WORDS[raw] ?? parseInt(raw, 10);
    if (Number.isFinite(day) && !days.includes(day)) days.push(day);
  }
  return days;
}

function stripAll(input: string, matches: string[]): string {
  return matches.reduce((acc, match) => acc.replace(match, " "), input);
}
