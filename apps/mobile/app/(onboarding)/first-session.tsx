import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FenceDemo, GateLatchSlider } from "../../src/components/fence";
import { AnimatedPressable, Badge, Txt } from "../../src/components/ui";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { completeOnboarding, getOnboardingState } from "../../src/lib/onboarding-state";
import { beginSession } from "../../src/lib/session-actions";
import { pushOnboardingProfile } from "../../src/lib/sync/profile";
import { useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function FirstSessionScreen() {
  const s = useThemedStyles(createStyles);
  const { practiceMode } = getOnboardingState();
  const auth = useAuth();
  const api = useApi();

  function start() {
    beginSession({ presetLabel: "First panel", durationMinutes: 5, practice: practiceMode });
    router.replace({ pathname: "/session", params: { onboarding: "1" } });
  }

  function skip() {
    completeOnboarding();
    if (auth.isSignedIn) void pushOnboardingProfile(api, auth.user?.displayName, auth.user?.email);
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Txt variant="label" tone="accent">
          Fenced
        </Txt>
        <Txt variant="title1" style={{ marginTop: 12 }} accessibilityRole="header">
          Try 5 minutes right now
        </Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: 8 }}>
          {practiceMode
            ? "Practice run — apps aren't fenced yet. You'll still see the timer and the fence grow."
            : "Your fenced apps are covered for 5 minutes. Watch the first panel go up."}
        </Txt>
        {practiceMode && (
          <View style={{ marginTop: 12 }}>
            <Badge label="Practice mode" tone="accent" />
          </View>
        )}
        <View style={{ marginTop: 28 }}>
          <FenceDemo />
        </View>
      </View>

      <GateLatchSlider onLatched={start} label="Slide to start 5 minutes" />
      <AnimatedPressable onPress={skip} style={s.secondary} accessibilityLabel="Not now">
        <Txt variant="callout" tone="muted">
          Not now
        </Txt>
      </AnimatedPressable>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 24 },
    content: { flex: 1, justifyContent: "center" },
    secondary: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  });
