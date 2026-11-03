import { useEffect } from "react";
import { Modal, View } from "react-native";
import Animated, { FadeIn, useReducedMotion, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors, darkTheme, fenceMaterial, motion, radii } from "@fenced/ui";
import { hapticShieldKnock } from "../../lib/haptics";
import { playSfx } from "../../lib/sound-engine";
import { AnimatedPressable, Txt } from "../ui";

const t = darkTheme; // Focus surfaces are dark regardless of system setting.

/**
 * The shield: what a user sees when they reach for a fenced app. Fast and
 * fully opaque (reads as interception, not as arriving late). Copy states the
 * fact and the time, and offers the honest exit — never a lecture.
 */
export function ShieldOverlay({
  visible,
  appName,
  endsAt,
  sandbox,
  styleId,
  passesLeft,
  onReturn,
  onEmergencyPass,
}: {
  visible: boolean;
  appName: string | null;
  endsAt: Date | null;
  sandbox: boolean;
  styleId?: string;
  passesLeft?: number;
  onReturn: () => void;
  onEmergencyPass?: () => void;
}) {
  const reduce = useReducedMotion();
  const m = fenceMaterial(styleId);

  useEffect(() => {
    if (!visible) return;
    void hapticShieldKnock();
    void playSfx("knock");
  }, [visible]);

  if (!visible) return null;
  const minsLeft = endsAt ? Math.max(1, Math.ceil((endsAt.getTime() - Date.now()) / 60_000)) : null;
  const until = endsAt?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onReturn} statusBarTranslucent>
      <Animated.View
        entering={reduce ? undefined : FadeIn.duration(motion.shieldIn)}
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: t.bg, padding: 28, justifyContent: "center" }}
      >
        {sandbox && (
          <View
            style={{
              position: "absolute",
              top: 60,
              alignSelf: "center",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.sm,
              backgroundColor: t.surfaceAlt,
            }}
          >
            <Txt variant="label" style={{ color: t.textMuted }}>
              Shield sandbox · simulated
            </Txt>
          </View>
        )}

        <Animated.View entering={reduce ? undefined : ZoomIn.duration(220)} style={{ alignItems: "center", marginBottom: 28 }}>
          {/* A closed gate: two posts, a latched bar. */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
            <View style={{ width: 12, height: 86, backgroundColor: m.post, borderRadius: 2 }} />
            <View style={{ width: 104, height: 72, justifyContent: "space-between", paddingVertical: 10 }}>
              <View style={{ height: 8, backgroundColor: m.rail, borderRadius: 2 }} />
              <View style={{ height: 14, width: 44, alignSelf: "center", backgroundColor: m.latch, borderRadius: 7 }} />
              <View style={{ height: 8, backgroundColor: m.rail, borderRadius: 2 }} />
            </View>
            <View style={{ width: 12, height: 86, backgroundColor: m.post, borderRadius: 2 }} />
          </View>
        </Animated.View>

        <Txt variant="title1" align="center" style={{ color: t.text }} accessibilityRole="header">
          {appName ? `${appName} is fenced` : "This app is fenced"}
        </Txt>
        {until && minsLeft != null && (
          <Txt variant="body" align="center" numeric style={{ color: t.textMuted, marginTop: 8 }}>
            Fenced until {until}. {minsLeft} minute{minsLeft === 1 ? "" : "s"} left.
          </Txt>
        )}

        <AnimatedPressable
          onPress={onReturn}
          accessibilityLabel="Return to focus"
          haptic="selection"
          style={{
            marginTop: 36,
            minHeight: 56,
            borderRadius: radii.md,
            backgroundColor: colors.pine600,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Ionicons name="arrow-undo" size={18} color={t.onPrimary} />
          <Txt variant="headline" style={{ color: t.onPrimary }}>
            Return to focus
          </Txt>
        </AnimatedPressable>

        {onEmergencyPass && (passesLeft ?? 0) > 0 && (
          <AnimatedPressable
            onPress={onEmergencyPass}
            accessibilityLabel={`Use an emergency pass. ${passesLeft} left this week. Lowers the fence for 3 minutes.`}
            style={{ marginTop: 12, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Txt variant="callout" style={{ color: t.textMuted }}>
              Something urgent? Use an emergency pass ({passesLeft} left)
            </Txt>
          </AnimatedPressable>
        )}
      </Animated.View>
    </Modal>
  );
}
