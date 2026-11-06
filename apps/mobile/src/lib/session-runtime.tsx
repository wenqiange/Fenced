import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { evaluateClassMode } from "@fenced/core";
import { FencedBlocking } from "@fenced/blocking";
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
  const classShieldArmed = useRef(false);

  useEffect(() => {
    function classModeTick() {
      const schedule = getAppState().classSchedule;
      if (!schedule?.enabled) {
        if (classShieldArmed.current) {
          classShieldArmed.current = false;
          void FencedBlocking.clearShield();
        }
        return;
      }
      const status = evaluateClassMode(schedule, new Date());
      if (status.shieldShouldArm && !classShieldArmed.current) {
        classShieldArmed.current = true;
        void FencedBlocking.applyShield();
      } else if (!status.shieldShouldArm && classShieldArmed.current) {
        classShieldArmed.current = false;
        void FencedBlocking.clearShield();
      }
    }

    function tick() {
      const cur = getAppState().activeSession;
      // Class Mode only governs the shield when no explicit focus session is
      // running — a manually started session always takes priority.
      if (!cur) {
        classModeTick();
        return;
      }
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
