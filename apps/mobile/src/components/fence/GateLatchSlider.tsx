import { useCallback, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { fenceMaterial, radii, springs } from "@fenced/ui";
import { useThemeColors } from "../../lib/theme";
import { hapticLatchClose, hapticSelection } from "../../lib/haptics";
import { playSfx } from "../../lib/sound-engine";
import { Txt } from "../ui";

const KNOB = 56;
const PAD = 4;
const COMMIT_AT = 0.82;

/**
 * "Slide to latch the gate." A wrought-iron bolt in a timber track. Dragging
 * past the catch point (or tapping, or the screen-reader activate action)
 * latches it; haptic + latch click land on the *catch*, not the touch.
 */
export function GateLatchSlider({
  onLatched,
  label = "Slide to latch the gate",
  disabled,
  styleId,
}: {
  onLatched: () => void;
  label?: string;
  disabled?: boolean;
  styleId?: string;
}) {
  const t = useThemeColors();
  const m = fenceMaterial(styleId);
  const reduce = useReducedMotion();
  const [trackW, setTrackW] = useState(0);
  const [latched, setLatched] = useState(false);
  const x = useSharedValue(0);
  const max = Math.max(1, trackW - KNOB - PAD * 2);

  const commit = useCallback(() => {
    if (latched) return;
    setLatched(true);
    void hapticLatchClose();
    void playSfx("latch");
    // Let the catch animation land before the screen changes under it.
    setTimeout(onLatched, reduce ? 0 : 260);
  }, [latched, onLatched, reduce]);

  const latchNow = useCallback(() => {
    if (disabled || latched) return;
    x.value = reduce ? max : withSpring(max, springs.latch);
    commit();
  }, [disabled, latched, x, max, reduce, commit]);

  const pan = Gesture.Pan()
    .enabled(!disabled && !latched)
    .activeOffsetX([-8, 8])
    .onBegin(() => runOnJS(hapticSelection)())
    .onUpdate((e) => {
      x.value = Math.min(max, Math.max(0, e.translationX));
    })
    .onEnd(() => {
      if (x.value >= max * COMMIT_AT) {
        x.value = withSpring(max, springs.latch);
        runOnJS(commit)();
      } else {
        x.value = withSpring(0, springs.press);
      }
    });

  const tap = Gesture.Tap()
    .enabled(!disabled && !latched)
    .onEnd(() => runOnJS(latchNow)());

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value + KNOB + PAD }));
  const hint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.5], [1, 0], "clamp") }));
  // Keeper plate on the far end lights up as the bolt approaches it.
  const keeper = useAnimatedStyle(() => ({
    backgroundColor: x.value >= max * COMMIT_AT ? m.glow : m.latch,
    transform: [{ scaleY: withTiming(x.value >= max * COMMIT_AT ? 1.15 : 1, { duration: 120 }) }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={latched ? "Gate latched" : label}
        accessibilityHint="Starts the session and puts the fence up"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === "activate" && latchNow()}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        style={{
          height: KNOB + PAD * 2,
          borderRadius: radii.lg,
          backgroundColor: t.scheme === "dark" ? "#2A231C" : "#EFE4D3",
          borderWidth: 1,
          borderColor: t.scheme === "dark" ? "#3A3026" : "#E0CFB6",
          justifyContent: "center",
          overflow: "hidden",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Wood grain: a few faint horizontal lines. */}
        {[0.3, 0.55, 0.78].map((p) => (
          <View
            key={p}
            style={{ position: "absolute", left: 0, right: 0, top: `${p * 100}%`, height: 1, backgroundColor: m.picketEmpty }}
          />
        ))}
        <Animated.View
          style={[{ position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: t.pineGlow, borderRadius: radii.lg }, fill]}
        />
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, alignItems: "center" }, hint]} pointerEvents="none">
          <Txt variant="headline" tone="muted">
            {label}
          </Txt>
        </Animated.View>
        <Animated.View
          style={[
            {
              position: "absolute",
              right: PAD + 6,
              width: 10,
              height: KNOB * 0.6,
              borderRadius: 3,
            },
            keeper,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              left: PAD,
              width: KNOB,
              height: KNOB,
              borderRadius: radii.md + 2,
              backgroundColor: t.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
            knob,
          ]}
        >
          {/* Bolt handle: a forged bar with a round grip. */}
          <View style={{ width: 26, height: 6, borderRadius: 3, backgroundColor: t.onPrimary, opacity: 0.9 }} />
          <View style={{ position: "absolute", right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: t.onPrimary }} />
          {latched && (
            <View style={{ position: "absolute" }}>
              <Ionicons name="lock-closed" size={18} color={t.onPrimary} />
            </View>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
