import type { WeeklyMetrics } from "@fenced/ai/client";
import { getAppState } from "./local-store";

export function buildWeeklyMetrics(): WeeklyMetrics {
  const state = getAppState();
  const history = state.sessionHistory;
  const totalSessions = history.length;
  const completedCount = state.sessionsCompleted;
  const completionRate =
    totalSessions > 0
      ? Math.round((completedCount / Math.max(1, totalSessions)) * 100)
      : 100;

  const weekdayFocusMinutes = [0, 0, 0, 0, 0, 0, 0];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const entry of history) {
    const at = new Date(entry.completedAt);
    if (at.getTime() < weekAgo) continue;
    weekdayFocusMinutes[at.getDay()] += entry.durationMinutes;
  }

  return {
    focusMinutes: state.focusMinutesThisWeek,
    shieldHits: state.shieldHitsThisWeek,
    sessionsCompleted: completedCount,
    completionRate,
    streakDays: state.streakDays,
    estimateAccuracy: null,
    weekdayFocusMinutes,
  };
}
