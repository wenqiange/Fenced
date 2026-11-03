import { memo, useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";
import { fenceMaterial, motion, springs, type FenceMaterial } from "@fenced/ui";

export type FenceState = "building" | "complete" | "left-early" | "idle";

export interface FenceAssemblyViewProps {
  /** 0..1 progress through the panel. */
  progress: number;
  pickets?: number;
  styleId?: string;
  state?: FenceState;
  /** Accessible summary; defaults to "N of M pickets". */
  accessibilityLabel?: string;
  /** Height/width ratio. */
  aspect?: number;
}

/**
 * One fence panel: two posts, two rails, pickets that drop in as the session
 * advances. Deliberately still between pickets — the brand rule is "reward a
 * glance, never invite a stare", so nothing pulses or loops.
 */
export const FenceAssemblyView = memo(function FenceAssemblyView({
  progress,
  pickets = 10,
  styleId,
  state = "building",
  accessibilityLabel,
  aspect = 0.52,
}: FenceAssemblyViewProps) {
  const m = fenceMaterial(styleId);
  const [w, setW] = useState(0);
  const h = w * aspect;
  const filled = state === "complete" ? pickets : Math.min(pickets, Math.floor(progress * pickets + 1e-6));

  const label = accessibilityLabel ?? `Fence panel, ${filled} of ${pickets} pickets placed`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ width: "100%", aspectRatio: 1 / aspect }}
    >
      {w > 0 && <Panel w={w} h={h} m={m} pickets={pickets} filled={filled} state={state} />}
    </View>
  );
});

function Panel({
  w,
  h,
  m,
  pickets,
  filled,
  state,
}: {
  w: number;
  h: number;
  m: FenceMaterial;
  pickets: number;
  filled: number;
  state: FenceState;
}) {
  const reduce = useReducedMotion();
  const postW = Math.max(10, w * 0.055);
  const inner = w - postW * 2;
  const slot = inner / pickets;
  const picketW = slot * 0.64;
  const railH = Math.max(5, h * 0.06);
  const topRail = h * 0.3;
  const bottomRail = h * 0.7;
  const picketTop = h * 0.1;
  const picketH = h * 0.84;

  // Posts anchor (scale up from the ground) when the panel first appears.
  const anchor = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) anchor.value = withSpring(1, springs.latch);
  }, [anchor, reduce]);
  const postStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - anchor.value) * h * 0.5 }, { scaleY: 0.5 + anchor.value * 0.5 }],
    opacity: anchor.value,
  }));

  // Rails glow once when the panel completes.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (state !== "complete" || reduce) return;
    glow.value = withSequence(
      withTiming(1, { duration: motion.panelComplete * 0.35, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: motion.panelComplete * 0.65, easing: Easing.in(Easing.quad) }),
    );
  }, [state, glow, reduce]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  // Latch: closes with overshoot at completion; leaving early stops it halfway.
  const latch = useSharedValue(state === "complete" ? 1 : 0);
  useEffect(() => {
    const target = state === "complete" ? 1 : state === "left-early" ? 0.45 : 0;
    if (reduce) latch.value = target;
    else
      latch.value =
        state === "complete"
          ? withDelay(motion.panelComplete * 0.4, withSpring(target, springs.latch))
          : withTiming(target, { duration: motion.gateOpen });
  }, [state, latch, reduce]);
  const latchStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -latch.value * slot * 0.9 }] }));

  const rail = (top: number) => (
    <View
      key={top}
      style={{
        position: "absolute",
        left: postW * 0.5,
        right: postW * 0.5,
        top,
        height: railH,
        borderRadius: 2,
        backgroundColor: m.rail,
      }}
    >
      <Animated.View
        style={[
          { position: "absolute", left: 0, right: 0, top: -2, bottom: -2, borderRadius: 3, backgroundColor: m.glow },
          glowStyle,
        ]}
      />
    </View>
  );

  const post = (side: "left" | "right") => (
    <Animated.View
      key={side}
      style={[
        { position: "absolute", [side]: 0, top: h * 0.04, width: postW, height: h * 0.96 },
        postStyle,
      ]}
    >
      <View style={{ flex: 1, backgroundColor: m.post, borderRadius: 2 }} />
      <View
        style={{
          position: "absolute",
          top: -postW * 0.25,
          left: -postW * 0.12,
          right: -postW * 0.12,
          height: postW * 0.45,
          borderRadius: 2,
          backgroundColor: m.postCap,
        }}
      />
    </Animated.View>
  );

  return (
    <View style={{ width: w, height: h }}>
      {rail(topRail)}
      {rail(bottomRail)}
      {Array.from({ length: pickets }, (_, i) => (
        <Picket
          key={i}
          index={i}
          left={postW + slot * i + (slot - picketW) / 2}
          top={picketTop}
          width={picketW}
          height={picketH}
          filled={i < filled}
          m={m}
          reduce={reduce}
        />
      ))}
      {post("left")}
      {post("right")}
      {/* Latch bolt on the right post. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            right: postW * 0.2,
            top: (topRail + bottomRail) / 2 - railH * 0.3,
            width: slot * 1.1,
            height: railH * 1.6,
            borderRadius: railH,
            backgroundColor: m.latch,
          },
          latchStyle,
        ]}
      />
    </View>
  );
}

const Picket = memo(function Picket({
  index,
  left,
  top,
  width,
  height,
  filled,
  m,
  reduce,
}: {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  filled: boolean;
  m: FenceMaterial;
  reduce: boolean;
}) {
  const drop = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      drop.value = filled ? 1 : 0;
      return;
    }
    // 180ms with one small bounce: drops in and settles.
    drop.value = filled ? withSpring(1, springs.picket) : withTiming(0, { duration: 120 });
  }, [filled, drop, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [{ translateY: (1 - drop.value) * -height * 0.35 }],
  }));

  const tip = width * 0.55;
  const gradId = `grain-${index}`;

  return (
    <View style={{ position: "absolute", left, top, width, height }}>
      {/* Empty slot outline stays put so progress reads as "fill the gaps". */}
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Polygon
          points={`0,${tip} ${width / 2},0 ${width},${tip} ${width},${height} 0,${height}`}
          fill={m.picketEmpty}
        />
      </Svg>
      <Animated.View style={[{ position: "absolute", width, height }, style]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={m.picketEdge} />
              <Stop offset="0.18" stopColor={m.picket} />
              <Stop offset="0.82" stopColor={m.picket} />
              <Stop offset="1" stopColor={m.picketEdge} />
            </LinearGradient>
          </Defs>
          <Polygon
            points={`0,${tip} ${width / 2},0 ${width},${tip} ${width},${height} 0,${height}`}
            fill={`url(#${gradId})`}
          />
          {/* Nail heads where the picket meets each rail. */}
          <Rect x={width / 2 - 1.2} y={height * 0.27} width={2.4} height={2.4} rx={1.2} fill={m.picketEdge} />
          <Rect x={width / 2 - 1.2} y={height * 0.72} width={2.4} height={2.4} rx={1.2} fill={m.picketEdge} />
        </Svg>
      </Animated.View>
    </View>
  );
});
