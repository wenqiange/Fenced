import { FencedBlocking } from "@fenced/blocking";
import { localId } from "./ids";
import {
  getAppState,
  getDefaultFence,
  recordEmergencyPassUse,
  recordSession,
  setActiveSession,
  setUnacknowledgedCompletedSession,
  toggleTask,
  type SessionHistoryEntry,
} from "./local-store";
import { getOnboardingState } from "./onboarding-state";
import {
  applyEmergencyPass,
  EMERGENCY_PASS_SECONDS,
  emergencyPassesLeft,
  focusedMinutes,
  startSession,
  totalFocusMinutes,
  type ActiveSession,
  type SessionPlan,
} from "./session-engine";
import { playAmbient, playSfx, stopAmbient } from "./sound-engine";

function shieldSelectionFor(fenceId: string | null) {
  const fence = getAppState().fences.find((f) => f.id === fenceId) ?? getDefaultFence();
  return {
    appTokens: fence?.appTokens ?? [],
    categoryTokens: fence?.categoryTokens ?? getOnboardingState().categories,
  };
}

/** Arms a session: persists it first, so a crash right after still resumes. */
export function beginSession(plan: SessionPlan): ActiveSession {
  const session = startSession(
    { ...plan, fenceId: plan.fenceId ?? getDefaultFence()?.id ?? null },
    localId("live"),
    new Date(),
  );
  // A summary nobody opened belongs to the previous session; showing it now
  // would hide the session that was just started.
  setUnacknowledgedCompletedSession(null);
  setActiveSession(session);
  void FencedBlocking.applyShield(shieldSelectionFor(session.fenceId));
  const sound = getAppState().settings.focusSound;
  if (sound !== "silence") void playAmbient(sound);
  return session;
}

/** Re-applies the platform shield after a cold start mid-session. */
export function resumeShield(session: ActiveSession) {
  if (session.phase === "focus") void FencedBlocking.applyShield(shieldSelectionFor(session.fenceId));
}

export function setBreakShield(onBreak: boolean, session: ActiveSession) {
  if (onBreak) void FencedBlocking.clearShield();
  else void FencedBlocking.applyShield(shieldSelectionFor(session.fenceId));
}

export function finishSession(
  session: ActiveSession,
  status: SessionHistoryEntry["status"],
  now = new Date(),
): SessionHistoryEntry {
  void FencedBlocking.clearShield();
  void stopAmbient();
  void playSfx(status === "completed" ? "panel" : "release");
  const entry = recordSession({
    startedAt: session.startedAt,
    completedAt: now.toISOString(),
    durationMinutes: status === "completed" ? totalFocusMinutes(session) : focusedMinutes(session, now),
    plannedMinutes: totalFocusMinutes(session),
    strictDelayMinutes: session.strictDelayMinutes,
    shieldHits: session.shieldHits,
    presetLabel: session.presetLabel,
    practice: session.practice,
    linkedTaskId: session.taskId,
    fenceId: session.fenceId,
    status,
    emergencyPassesUsed: session.emergencyPassesUsed,
  });
  return entry;
}

export function passesLeft(now = new Date()): number {
  const s = getAppState();
  return emergencyPassesLeft(s.emergencyPassUses, s.settings.emergencyPassesPerWeek, now);
}

/** Lowers the shield for exactly 180 s; the platform re-arms it itself. */
export function spendEmergencyPass(session: ActiveSession, now = new Date()): ActiveSession | null {
  if (passesLeft(now) <= 0) return null;
  const next = applyEmergencyPass(session, now);
  recordEmergencyPassUse(now.toISOString());
  setActiveSession(next);
  void FencedBlocking.pauseShield(EMERGENCY_PASS_SECONDS);
  return next;
}

export function markTaskDone(taskId: string | null) {
  if (!taskId) return;
  const task = getAppState().tasks.find((t) => t.id === taskId);
  // Through toggleTask so a recurring task spawns its next occurrence.
  if (task && !task.completed) toggleTask(taskId);
}
