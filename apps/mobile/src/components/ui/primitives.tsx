import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { HIT_TARGET, radii, springs } from "@fenced/ui";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../lib/theme";
import { hapticSelection } from "../../lib/haptics";
import { AnimatedPressable, type AnimatedPressableProps } from "./AnimatedPressable";
import { Txt } from "./Txt";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// ─── FenceCard ──────────────────────────────────────────────────────────────

/**
 * Editorial card: 1px paper edge, architectural radius, a warm low shadow in
 * light mode and a faint lit edge in dark mode (shadows vanish on near-black).
 */
export function FenceCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  tone = "surface",
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: "surface" | "primary" | "tint";
}) {
  const s = useThemedStyles(cardStyles);
  const body = [s.card, tone === "primary" && s.primary, tone === "tint" && s.tint, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <AnimatedPressable style={body} onPress={onPress} accessibilityLabel={accessibilityLabel} pressScale={0.985}>
      {children}
    </AnimatedPressable>
  );
}

const cardStyles = (t: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: radii.card,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.cardBorder,
      padding: 16,
      ...(t.scheme === "light"
        ? {
            shadowColor: t.shadow,
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 1,
          }
        : null),
    },
    primary: { backgroundColor: t.primary, borderColor: t.primary },
    tint: { backgroundColor: t.accentTint, borderColor: t.accentTint, shadowOpacity: 0, elevation: 0 },
  });

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonKind = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  label,
  kind = "primary",
  icon,
  loading,
  style,
  ...rest
}: Omit<AnimatedPressableProps, "children"> & {
  label: string;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(buttonStyles);
  const ink =
    kind === "primary" ? t.onPrimary : kind === "destructive" ? t.error : t.accent;
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      haptic="selection"
      style={[s.base, s[kind], style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={ink} />}
          <Txt variant="headline" style={{ color: ink }}>
            {label}
          </Txt>
        </>
      )}
    </AnimatedPressable>
  );
}

const buttonStyles = (t: ThemeColors) =>
  StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: radii.md,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primary: { backgroundColor: t.primary },
    secondary: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong },
    ghost: { backgroundColor: "transparent", minHeight: HIT_TARGET },
    destructive: { backgroundColor: t.errorSoft },
  });

// ─── Chip ───────────────────────────────────────────────────────────────────

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = "accent",
  accessibilityHint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: "accent" | "breach" | "timber";
  accessibilityHint?: string;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(chipStyles);
  const activeBg = tone === "breach" ? t.breachSoft : tone === "timber" ? t.accentSoft : t.primary;
  const activeInk = tone === "breach" ? t.breach : tone === "timber" ? t.onAccentSoft : t.onPrimary;
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={6}
      style={[s.chip, selected && { backgroundColor: activeBg, borderColor: activeBg }]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? activeInk : t.textMuted} />}
      <Txt variant="caption" style={{ color: selected ? activeInk : t.text }}>
        {label}
      </Txt>
    </AnimatedPressable>
  );
}

const chipStyles = (t: ThemeColors) =>
  StyleSheet.create({
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
  });

// ─── Badge ──────────────────────────────────────────────────────────────────

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "breach" | "success" | "info" }) {
  const t = useThemeColors();
  const map = {
    neutral: [t.track, t.textMuted],
    accent: [t.accentTint, t.accent],
    breach: [t.breachSoft, t.breach],
    success: [t.accentTint, t.success],
    info: [t.infoSoft, t.info],
  } as const;
  const [bg, ink] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Txt variant="label" style={{ color: ink }}>
        {label}
      </Txt>
    </View>
  );
}

// ─── SectionHeader ──────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="header"
      style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }, style]}
    >
      <Txt variant="label" tone="muted">
        {title}
      </Txt>
      {action && onAction && (
        <AnimatedPressable onPress={onAction} accessibilityLabel={action} style={{ minHeight: HIT_TARGET, justifyContent: "center" }}>
          <Txt variant="caption" tone="accent">
            {action}
          </Txt>
        </AnimatedPressable>
      )}
    </View>
  );
}

// ─── SegmentedControl ───────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  const t = useThemeColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width / Math.max(1, options.length);
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = reduce ? index * segW : withSpring(index * segW, springs.press);
  }, [index, segW, reduce, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 6)}
      style={{ flexDirection: "row", backgroundColor: t.track, borderRadius: radii.md, padding: 3 }}
    >
      {width > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 3,
              width: segW,
              borderRadius: radii.sm + 2,
              backgroundColor: t.surface,
              shadowColor: "#000",
              shadowOpacity: t.scheme === "light" ? 0.08 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            },
            thumb,
          ]}
        />
      )}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) hapticSelection();
              onChange(o.value);
            }}
            style={{ flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center" }}
          >
            <Txt variant="caption" tone={selected ? "default" : "muted"} weight={selected ? "600" : "500"}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── BottomSheetModal ───────────────────────────────────────────────────────

/**
 * Lightweight sheet on top of RN Modal: springs up, backdrop fades, tapping
 * the backdrop or the platform back gesture closes it. Content scrolls itself.
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const translateY = useSharedValue(0);

  const close = () => dismissible && onClose();

  const panGesture = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 600) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, springs.sheet);
      }
    });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = 0;
      progress.value = reduce ? 1 : withSpring(1, springs.sheet);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: reduce ? 0 : 200 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, reduce, mounted, progress, translateY]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 600 + translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: "88%",
            backgroundColor: t.surfaceRaised,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderColor: t.cardBorder,
          },
          sheet,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.borderStrong }} />
          </View>
        </GestureDetector>
        {title && (
          <GestureDetector gesture={panGesture}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
              <Txt variant="title2" style={{ flex: 1 }} accessibilityRole="header">
                {title}
              </Txt>
              {dismissible && (
                <AnimatedPressable
                  onPress={onClose}
                  accessibilityLabel="Close"
                  style={{ width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={22} color={t.textMuted} />
                </AnimatedPressable>
              )}
            </View>
          </GestureDetector>
        )}
        {children}
      </Animated.View>
    </Modal>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 22,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useThemeColors();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityLabel={label}
      haptic="selection"
      style={[{ width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center", borderRadius: HIT_TARGET / 2 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? t.text} />
    </AnimatedPressable>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const t = useThemeColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: t.track, overflow: "hidden" }}
    >
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: color ?? t.success, borderRadius: height / 2 }} />
    </View>
  );
}
