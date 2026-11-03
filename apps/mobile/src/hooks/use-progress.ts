import { useMemo } from "react";
import { currentStreak, weekStats } from "../lib/stats";
import { useAppSelector } from "./use-app-state";

/** Progress numbers, derived from history (never stored, never stale). */
export function useProgress() {
  const history = useAppSelector((s) => s.sessionHistory);
  return useMemo(() => {
    const week = weekStats(history);
    return {
      weekFocusMinutes: week.focusMinutes,
      weekShieldHits: week.shieldHits,
      weekSessions: week.sessions,
      streakDays: currentStreak(history),
      sessionsCompleted: history.filter((h) => h.status === "completed").length,
      lastSessionAt: history[0]?.completedAt ?? null,
    };
  }, [history]);
}
