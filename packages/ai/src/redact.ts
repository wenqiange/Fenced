const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ES/CA and international E.164 phones (e.g. 612 34 56 78, 93 123 45 67, 600-12-34-56, +34 ...)
const ES_PHONE_RE = /(?:\+?34[\s.-]?)?(?:[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|[6789]\d{2}(?:[\s.-]?\d{2}){3}|[89]\d(?:[\s.-]?\d{3})(?:[\s.-]?\d{2}){2})\b/g;
const INT_PHONE_RE = /\+(?:[1-9]\d{0,2})[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;

// Spanish DNI/NIE & IBAN
const DNI_NIE_RE = /\b[XYZxyz]?\d{7,8}[-\s]?[A-HJ-NP-TV-Za-hj-np-tv-z]\b/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:\s?\d{4}){4,7}\b/gi;

// Addresses & Schools in ES/CA/EN
const ADDRESS_RE = /\b(?:C\/|Calle|Carrer|Av(?:da)?\.?|Avinguda|Passeig|Plaza|Plaça|Pl\.)\s+[\p{L}\d\s'·-]{2,40}(?:,?\s*\d{1,4})?\b/giu;
const SCHOOL_RE = /\b(?:IES|INS|CEIP|Escola|Institut|Col·legi|Colegio|Universitat)\s+\p{Lu}[\p{L}\s'·-]{2,40}\b/gu;

// Handles & URLs
const HANDLE_RE = /(^|\s)@[\w.]{2,30}\b/g;
const URL_RE = /\bhttps?:\/\/\S+/gi;

export function stripPii(text: string): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(URL_RE, "[url]")
    .replace(HANDLE_RE, "$1[handle]")
    .replace(IBAN_RE, "[iban]")
    .replace(DNI_NIE_RE, "[id]")
    .replace(ES_PHONE_RE, "[phone]")
    .replace(INT_PHONE_RE, "[phone]")
    .replace(ADDRESS_RE, "[address]")
    .replace(SCHOOL_RE, "[school]");
}

export function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

export function minimiseParsePayload(input: {
  rawText: string;
  referenceDate: string;
  ambiguities?: Array<{ kind: string; text: string }>;
}) {
  return {
    rawText: truncate(stripPii(input.rawText), 500),
    referenceDate: input.referenceDate.slice(0, 10),
    ambiguities: (input.ambiguities ?? []).slice(0, 6).map((a) => ({
      kind: a.kind,
      text: truncate(stripPii(a.text), 80),
    })),
  };
}

export function minimiseReplanPayload(input: {
  horizon: "today" | "week";
  freeMinutes: number;
  usedMinutes: number;
  reasonCounts: Record<string, number>;
  unplaced: Array<{ title: string; unmetMinutes: number; reason: string }>;
  tags?: string[];
}) {
  return {
    horizon: input.horizon,
    freeMinutes: input.freeMinutes,
    usedMinutes: input.usedMinutes,
    reasonCounts: input.reasonCounts,
    unplaced: input.unplaced.slice(0, 30).map((u) => ({
      title: truncate(stripPii(u.title), 80),
      unmetMinutes: u.unmetMinutes,
      reason: u.reason,
    })),
    tags: (input.tags ?? []).slice(0, 20).map((t) => truncate(t, 40)),
  };
}

export function minimiseCoachPayload(metrics: {
  focusMinutes: number;
  shieldHits: number;
  sessionsCompleted: number;
  completionRate: number;
  streakDays: number;
  estimateAccuracy?: number | null;
  weekdayFocusMinutes?: number[];
}) {
  return {
    focusMinutes: metrics.focusMinutes,
    shieldHits: metrics.shieldHits,
    sessionsCompleted: metrics.sessionsCompleted,
    completionRate: metrics.completionRate,
    streakDays: metrics.streakDays,
    estimateAccuracy: metrics.estimateAccuracy ?? null,
    weekdayFocusMinutes: metrics.weekdayFocusMinutes,
  };
}

export function minimiseChatPayload(messages: Array<{ role: string; content: string }>) {
  return messages.slice(-12).map((m) => ({
    role: m.role,
    content: truncate(stripPii(m.content), 2000),
  }));
}
