import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getAppState, setActiveSession } from "./local-store";
import { advance, isShieldPaused } from "./session-engine";
import { finishSession, resumeShield, setBreakShield } from "./session-actions";
import { hapticPanelComplete } from "./haptics";
import { playSfx } from "./sound-engine";

/**
 * Headless root runtime managing session lifecycle and wall-clock state.
 *
 * Runs continuously at app root regardless of current screen, guaranteeing that
 * session progression, phase transitions, and emergency pass expirations never
 * stall when navigating away from the session view.
 */
export function SessionRuntime() {
  const lastState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    function tick() {
      const cur = getAppState().activeSession;
      if (!cur) return;
      const now = new Date();

      // Check if emergency pass expired while shield was paused
      if (cur.shieldPausedUntil && !isShieldPaused(cur, now)) {
        setActiveSession({ ...cur, shieldPausedUntil: null });
        if (cur.phase === "focus") {
          resumeShield(cur);
        }
      }

      const r = advance(cur, now);
      if (r.done) {
        void hapticPanelComplete();
        finishSession(r.session, "completed", new Date(r.session.endsAt));
        return;
      }
      if (r.changed) {
        setActiveSession(r.session);
        setBreakShield(r.session.phase === "break", r.session);
        void playSfx(r.session.phase === "break" ? "panel" : "latch");
      }
    }

    const interval = setInterval(tick, 1000);

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (lastState.current.match(/inactive|background/) && nextState === "active") {
        // App returned to foreground: immediately reconcile wall-clock state
        tick();
      }
      lastState.current = nextState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return null;
}
