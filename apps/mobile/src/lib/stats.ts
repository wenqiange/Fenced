/**
 * Everything the UI shows about progress is derived from session history.
 * Stored counters drifted (weekly totals never reset, streaks never decayed),
 * so nothing here is cached state.
 */

export interface HistorySession {
  startedAt: string;
  completedAt: string;
  durationMinutes: number;
  shieldHits: number;
  status: "completed" | "abandoned";
  practice: boolean;
  emergencyPassesUsed?: number;
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // ISO week: Monday first.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const completed = (s: HistorySession) => s.status === "completed";

export function weekStats(history: readonly HistorySession[], now = new Date()) {
  const from = startOfWeek(now).getTime();
  let focusMinutes = 0;
  let shieldHits = 0;
  let sessions = 0;
  for (const s of history) {
    if (new Date(s.completedAt).getTime() < from) continue;
    shieldHits += s.shieldHits;
    if (!completed(s)) continue;
    focusMinutes += s.durationMinutes;
    sessions += 1;
  }
  return { focusMinutes, shieldHits, sessions };
}

/**
 * Consecutive local days with a completed session, ending today — or ending
 * yesterday, so the line isn't shown as broken before today's session.
 */
export function currentStreak(history: readonly HistorySession[], now = new Date()): number {
  const days = new Set(history.filter(completed).map((s) => dateKey(new Date(s.completedAt))));
  const cursor = new Date(now);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface FenceLineDay {
  key: string;
  date: Date;
  minutes: number;
  sessions: number;
  /** An emergency pass was used: drawn as a repaired joint, never a gap. */
  repaired: boolean;
}

/** Oldest first, `days` long, ending today. */
export function fenceLine(
  history: readonly HistorySession[],
  days: number,
  now = new Date(),
): FenceLineDay[] {
  const byDay = new Map<string, FenceLineDay>();
  const out: FenceLineDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const day: FenceLineDay = { key: dateKey(d), date: d, minutes: 0, sessions: 0, repaired: false };
    byDay.set(day.key, day);
    out.push(day);
  }
  for (const s of history) {
    const day = byDay.get(dateKey(new Date(s.completedAt)));
    if (!day) continue;
    if ((s.emergencyPassesUsed ?? 0) > 0) day.repaired = true;
    if (!completed(s)) continue;
    day.minutes += s.durationMinutes;
    day.sessions += 1;
  }
  return out;
}

export interface HourBucket {
  hour: number;
  sessions: number;
  shieldHits: number;
}

/** Sessions and distraction attempts by the local hour the session started. */
export function hourlyBreaches(history: readonly HistorySession[]): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: 0, shieldHits: 0 }));
  for (const s of history) {
    const b = buckets[new Date(s.startedAt).getHours()];
    b.shieldHits += s.shieldHits;
    if (completed(s)) b.sessions += 1;
  }
  return buckets;
}

/**
 * The hour where distraction attempts are densest relative to focus done
 * there. Needs a few data points so one bad afternoon isn't a "pattern".
 */
export function vulnerableHour(buckets: readonly HourBucket[]): HourBucket | null {
  let best: HourBucket | null = null;
  let bestScore = 0;
  for (const b of buckets) {
    if (b.shieldHits < 3) continue;
    const score = b.shieldHits / Math.max(1, b.sessions);
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Average minutes a blocked distraction would have cost. Research on task
 * switching puts refocus time well above the visit itself; 6 is deliberately
 * conservative and the UI labels the result as an estimate.
 */
export const MINUTES_PER_INTERCEPT = 6;

export function timeReclaimedMinutes(history: readonly HistorySession[]): number {
  return history.reduce((sum, s) => sum + s.shieldHits * MINUTES_PER_INTERCEPT, 0);
}

export interface ReachMapCell {
  dayOfWeek: number; // 0=Mon .. 6=Sun
  hour: number; // 0..23
  focusMinutes: number;
  shieldHits: number;
  sessions: number;
}

export interface ReachMap {
  grid: ReachMapCell[][]; // 7 rows x 24 cols
  totalReclaimedMinutes: number;
  maxDensityCell: ReachMapCell | null;
}

/**
 * Feature 7 (Reach Map):
 * Non-shaming 7x24 weekly distribution mapping focus intervals and shield intercepts.
 */
export function computeReachMap(history: readonly HistorySession[]): ReachMap {
  const grid: ReachMapCell[][] = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => ({
      dayOfWeek: d,
      hour: h,
      focusMinutes: 0,
      shieldHits: 0,
      sessions: 0,
    }))
  );

  let maxDensity = 0;
  let maxCell: ReachMapCell | null = null;

  for (const s of history) {
    const date = new Date(s.startedAt);
    const day = (date.getDay() + 6) % 7; // ISO: 0=Mon..6=Sun
    const hour = date.getHours();
    const cell = grid[day][hour];

    cell.shieldHits += s.shieldHits;
    if (completed(s)) {
      cell.focusMinutes += s.durationMinutes;
      cell.sessions += 1;
    }

    const density = cell.focusMinutes + cell.shieldHits * 5;
    if (density > maxDensity) {
      maxDensity = density;
      maxCell = cell;
    }
  }

  return {
    grid,
    totalReclaimedMinutes: timeReclaimedMinutes(history),
    maxDensityCell: maxCell,
  };
}
