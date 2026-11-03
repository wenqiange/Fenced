import { router, usePathname } from "expo-router";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import { useNow } from "../../hooks/use-now";
import { formatClock, remainingMs } from "../../lib/session-engine";
import { useThemeColors } from "../../lib/theme";
import { AnimatedPressable, Txt } from "../ui";

/**
 * If the app was backgrounded or restarted mid-session, this pill brings the
 * user straight back. Time is wall-clock, so it is exact after any restart.
 */
export function ActiveSessionBanner() {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const session = useAppSelector((s) => s.activeSession);
  const path = usePathname();
  const hidden = !session || path === "/session" || path.startsWith("/(onboarding)");
  const now = useNow(1000, !hidden);
  if (hidden || !session) return null;

  const left = remainingMs(session, now);
  const phase = session.phase === "break" ? "Break" : "Fenced";

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 72 }}
    >
      <AnimatedPressable
        onPress={() => router.push("/session")}
        accessibilityLabel={`${phase} session, ${formatClock(left)} left. Open session`}
        haptic="selection"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          minHeight: 52,
          borderRadius: radii.lg,
          backgroundColor: t.primary,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={session.phase === "break" ? "cafe-outline" : "lock-closed"} size={18} color={t.onPrimary} />
        <View style={{ flex: 1 }}>
          <Txt variant="headline" tone="onPrimary" numberOfLines={1}>
            {session.presetLabel}
          </Txt>
        </View>
        <Txt variant="headline" tone="onPrimary" numeric>
          {formatClock(left)}
        </Txt>
        <Ionicons name="chevron-forward" size={18} color={t.onPrimary} />
      </AnimatedPressable>
    </Animated.View>
  );
}
