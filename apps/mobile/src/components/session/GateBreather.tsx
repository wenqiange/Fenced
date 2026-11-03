import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { darkTheme, radii } from "@fenced/ui";
import { formatClock } from "../../lib/session-engine";
import { AnimatedPressable, Chip, Txt } from "../ui";

const t = darkTheme;

// Box-ish breathing: 4s in, 2s hold, 6s out. A long exhale is calming.
const IN = 4000;
const HOLD = 2000;
const OUT = 6000;

const REASONS = ["Something urgent", "Bored", "Stuck on the task", "Habit, honestly", "Need a real break"];

/**
 * Strict mode's gate. The user chose this delay when arming the session; it
 * runs from the first request, can't be reset or shortened, and the exit only
 * appears at 00:00. Going back to focus is always one tap away.
 */
export function GateBreather({
  remainingMs,
  delayMinutes,
  onBackToFocus,
  onLeave,
}: {
  remainingMs: number;
  delayMinutes: number;
  onBackToFocus: () => void;
  onLeave: (reason: string | null) => void;
}) {
  const reduce = useReducedMotion();
  const [reason, setReason] = useState<string | null>(null);
  const [cue, setCue] = useState("Breathe in");
  const scale = useSharedValue(0.6);
  const unlocked = remainingMs <= 0;

  useEffect(() => {
    if (reduce) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: IN, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: HOLD }),
        withTiming(0.6, { duration: OUT, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(scale);
  }, [reduce, scale]);

  // Text cue for everyone (and the only cue with Reduce Motion on).
  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setCue("Breathe in");
      setTimeout(() => alive && setCue("Hold"), IN);
      setTimeout(() => alive && setCue("Breathe out"), IN + HOLD);
      setTimeout(loop, IN + HOLD + OUT);
    };
    loop();
    return () => {
      alive = false;
    };
  }, []);

  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 0.35 + 0.4 * scale.value }));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: "center" }}>
      <Txt variant="label" align="center" style={{ color: t.textMuted }}>
        Your delay
      </Txt>
      <Txt
        variant="display"
        align="center"
        numeric
        style={{ color: unlocked ? t.success : t.text, marginTop: 6 }}
        accessibilityLiveRegion="polite"
        accessibilityLabel={unlocked ? "Delay finished" : `${Math.ceil(remainingMs / 60000)} minutes left in your delay`}
      >
        {formatClock(remainingMs)}
      </Txt>
      <Txt variant="callout" align="center" style={{ color: t.textMuted, marginTop: 4 }}>
        You set a {delayMinutes}-minute delay when you started.
      </Txt>

      <View style={{ height: 220, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[{ width: 170, height: 170, borderRadius: 85, backgroundColor: t.pineGlow, borderWidth: 2, borderColor: t.accent }, ring]}
        />
        <View style={{ position: "absolute" }}>
          <Txt variant="headline" style={{ color: t.text }} accessibilityLiveRegion="polite">
            {cue}
          </Txt>
        </View>
      </View>

      <Txt variant="callout" align="center" style={{ color: t.textMuted, marginBottom: 10 }}>
        What's pulling you away? Just for you — it stays on this phone.
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
        ))}
      </View>

      <AnimatedPressable
        onPress={onBackToFocus}
        accessibilityLabel="Back to focus"
        haptic="selection"
        style={{
          marginTop: 32,
          minHeight: 56,
          borderRadius: radii.md,
          backgroundColor: t.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt variant="headline" style={{ color: t.onPrimary }}>
          Back to focus
        </Txt>
      </AnimatedPressable>
      <AnimatedPressable
        onPress={() => unlocked && onLeave(reason)}
        disabled={!unlocked}
        accessibilityLabel={unlocked ? "Leave early" : "Leave early, available when the delay ends"}
        style={{ marginTop: 10, minHeight: 48, alignItems: "center", justifyContent: "center" }}
      >
        <Txt variant="callout" style={{ color: unlocked ? t.breach : t.textMuted }}>
          {unlocked ? "Leave early" : "Leave early unlocks at 00:00"}
        </Txt>
      </AnimatedPressable>
    </View>
  );
}
