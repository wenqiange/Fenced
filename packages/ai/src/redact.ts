const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g;

export function stripPii(text: string): string {
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
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
