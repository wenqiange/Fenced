import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  completeOnboarding,
  getOnboardingState,
} from "../../src/lib/onboarding-state";
import { PINE, PAPER, INK, SLATE, SAND, TIMBER } from "../../src/lib/theme";

export default function FirstSessionScreen() {
  const { practiceMode } = getOnboardingState();

  function start() {
    router.replace({
      pathname: "/session",
      params: {
        duration: "5",
        practice: practiceMode ? "1" : "0",
        presetLabel: "First session",
        finishOnboarding: "1",
      },
    });
  }

  function skip() {
    completeOnboarding();
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>Fenced</Text>
        <Text style={styles.title}>Try 5 minutes right now</Text>
        <Text style={styles.subtitle}>
          {practiceMode
            ? "Practice run — apps aren't fenced yet. You'll still see the timer and fence grow."
            : "Short enough that nobody feels trapped. Long enough to feel the fence go up."}
        </Text>

        {practiceMode && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Practice mode</Text>
          </View>
        )}
      </View>

      <Pressable style={styles.button} onPress={start}>
        <Text style={styles.buttonText}>Start 5-minute session</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={skip}>
        <Text style={styles.secondaryText}>Not now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, padding: 24 },
  content: { flex: 1, justifyContent: "center" },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: PINE,
    letterSpacing: 1,
    marginBottom: 20,
  },
  title: { fontSize: 32, fontWeight: "700", color: INK, lineHeight: 38 },
  subtitle: { fontSize: 16, color: SLATE, marginTop: 12, lineHeight: 24 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 20,
    backgroundColor: SAND,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: TIMBER },
  button: {
    backgroundColor: PINE,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  buttonText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  secondary: { paddingVertical: 16, alignItems: "center", marginBottom: 8 },
  secondaryText: { fontSize: 15, fontWeight: "600", color: SLATE },
});
