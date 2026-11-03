import type { WeeklyMetrics } from "@fenced/ai/client";
import { getAppState } from "./local-store";
import { currentStreak } from "./stats";

/** Last 7 days of history, aggregated for the weekly coach. */
export function buildWeeklyMetrics(now = new Date()): WeeklyMetrics {
  const history = getAppState().sessionHistory;
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const recent = history.filter((h) => new Date(h.completedAt).getTime() >= weekAgo);
  const completed = recent.filter((h) => h.status === "completed");

  const weekdayFocusMinutes = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of completed) {
    weekdayFocusMinutes[new Date(entry.completedAt).getDay()] += entry.durationMinutes;
  }

  return {
    focusMinutes: completed.reduce((s, h) => s + h.durationMinutes, 0),
    shieldHits: recent.reduce((s, h) => s + h.shieldHits, 0),
    sessionsCompleted: completed.length,
    completionRate: recent.length > 0 ? Math.round((completed.length / recent.length) * 100) : 100,
    streakDays: currentStreak(history, now),
    estimateAccuracy: null,
    weekdayFocusMinutes,
  };
}
