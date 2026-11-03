/**
 * Pure session state machine. Every number is computed from wall-clock
 * timestamps, so a backgrounded, killed or rebooted app resumes exactly where
 * the session really is instead of where a JS interval last ticked.
 */

export type SessionPhase = "focus" | "break";

export interface ActiveSession {
  id: string;
  presetId: string | null;
  presetLabel: string;
  taskId: string | null;
  fenceId: string | null;
  /** Length of one focus block. */
  durationMinutes: number;
  breakMinutes: number;
  totalCycles: number;
  /** 0-based index of the current focus block. */
  cycleIndex: number;
  phase: SessionPhase;
  strictDelayMinutes: number;
  practice: boolean;
  startedAt: string;
  phaseStartedAt: string;
  /** End of the current phase. */
  endsAt: string;
  /** Set once the user asks to leave a strict session; never moved later. */
  strictUnlockRequestedAt: string | null;
  shieldHits: number;
  /** Emergency pass: shield is lowered until this instant, then re-arms. */
  shieldPausedUntil: string | null;
  emergencyPassesUsed: number;
}

export interface SessionPlan {
  presetId?: string | null;
  presetLabel: string;
  taskId?: string | null;
  fenceId?: string | null;
  durationMinutes: number;
  breakMinutes?: number;
  cycles?: number;
  strictDelayMinutes?: number;
  practice?: boolean;
}

const MIN = 60_000;

export function startSession(plan: SessionPlan, id: string, now: Date): ActiveSession {
  const startedAt = now.toISOString();
  return {
    id,
    presetId: plan.presetId ?? null,
    presetLabel: plan.presetLabel,
    taskId: plan.taskId ?? null,
    fenceId: plan.fenceId ?? null,
    durationMinutes: plan.durationMinutes,
    breakMinutes: plan.breakMinutes ?? 0,
    totalCycles: Math.max(1, plan.cycles ?? 1),
    cycleIndex: 0,
    phase: "focus",
    strictDelayMinutes: plan.strictDelayMinutes ?? 0,
    practice: plan.practice ?? false,
    startedAt,
    phaseStartedAt: startedAt,
    endsAt: new Date(now.getTime() + plan.durationMinutes * MIN).toISOString(),
    strictUnlockRequestedAt: null,
    shieldHits: 0,
    shieldPausedUntil: null,
    emergencyPassesUsed: 0,
  };
}

export function remainingMs(s: ActiveSession, now: Date): number {
  return Math.max(0, new Date(s.endsAt).getTime() - now.getTime());
}

/** 0..1 progress through the current phase. */
export function phaseProgress(s: ActiveSession, now: Date): number {
  const start = new Date(s.phaseStartedAt).getTime();
  const end = new Date(s.endsAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/**
 * Advances past every phase boundary already crossed (the app may have been
 * closed through several). Returns `done` once the last focus block ended.
 */
export function advance(
  s: ActiveSession,
  now: Date,
): { session: ActiveSession; done: boolean; changed: boolean } {
  let cur = s;
  let changed = false;
  while (now.getTime() >= new Date(cur.endsAt).getTime()) {
    const boundary = new Date(cur.endsAt);
    const isLastFocus = cur.phase === "focus" && cur.cycleIndex >= cur.totalCycles - 1;
    if (isLastFocus) return { session: cur, done: true, changed };
    changed = true;
    if (cur.phase === "focus" && cur.breakMinutes > 0) {
      cur = {
        ...cur,
        phase: "break",
        phaseStartedAt: boundary.toISOString(),
        endsAt: new Date(boundary.getTime() + cur.breakMinutes * MIN).toISOString(),
      };
    } else {
      cur = {
        ...cur,
        phase: "focus",
        cycleIndex: cur.cycleIndex + 1,
        phaseStartedAt: boundary.toISOString(),
        endsAt: new Date(boundary.getTime() + cur.durationMinutes * MIN).toISOString(),
      };
    }
  }
  return { session: cur, done: false, changed };
}

/** Focus minutes actually completed so far (whole blocks + current partial). */
export function focusedMinutes(s: ActiveSession, now: Date): number {
  const full = s.cycleIndex * s.durationMinutes;
  if (s.phase === "break") return full + s.durationMinutes;
  const partial = (now.getTime() - new Date(s.phaseStartedAt).getTime()) / MIN;
  return Math.max(0, Math.round(full + Math.min(partial, s.durationMinutes)));
}

export function totalFocusMinutes(s: Pick<ActiveSession, "durationMinutes" | "totalCycles">) {
  return s.durationMinutes * s.totalCycles;
}

/**
 * Strict mode: leaving needs a cooldown that starts when first requested and
 * can't be reset or shortened. `null` = no request pending; 0 = unlocked.
 */
export function strictUnlockRemainingMs(s: ActiveSession, now: Date): number | null {
  if (s.strictDelayMinutes <= 0) return 0;
  if (!s.strictUnlockRequestedAt) return null;
  const unlockAt = new Date(s.strictUnlockRequestedAt).getTime() + s.strictDelayMinutes * MIN;
  return Math.max(0, unlockAt - now.getTime());
}

export function requestStrictUnlock(s: ActiveSession, now: Date): ActiveSession {
  // Re-requesting must not restart (or shorten) a running countdown.
  if (s.strictUnlockRequestedAt) return s;
  return { ...s, strictUnlockRequestedAt: now.toISOString() };
}

export function cancelStrictUnlock(s: ActiveSession): ActiveSession {
  return { ...s, strictUnlockRequestedAt: null };
}

export const EMERGENCY_PASS_SECONDS = 180;
export const DEFAULT_EMERGENCY_PASSES_PER_WEEK = 2;

/** Passes left in the current ISO week given the timestamps of past uses. */
export function emergencyPassesLeft(uses: readonly string[], perWeek: number, now: Date): number {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const used = uses.filter((u) => new Date(u) >= weekStart).length;
  return Math.max(0, perWeek - used);
}

export function isShieldPaused(s: ActiveSession, now: Date): boolean {
  return !!s.shieldPausedUntil && new Date(s.shieldPausedUntil).getTime() > now.getTime();
}

export function applyEmergencyPass(s: ActiveSession, now: Date): ActiveSession {
  return {
    ...s,
    shieldPausedUntil: new Date(now.getTime() + EMERGENCY_PASS_SECONDS * 1000).toISOString(),
    emergencyPassesUsed: s.emergencyPassesUsed + 1,
  };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
