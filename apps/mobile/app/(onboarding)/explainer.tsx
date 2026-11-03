import { Platform, View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { FencedBlocking } from "@fenced/blocking";
import { FenceDemo } from "../../src/components/fence";
import {
  getOnboardingState,
  setPracticeMode,
} from "../../src/lib/onboarding-state";
import { useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const IOS_COPY =
  "Fenced uses Apple's Screen Time to cover distracting apps while you focus. We can't see what you do in them — Apple doesn't tell us.";

const ANDROID_COPY =
  "Android needs you to switch on Usage Access so Fenced can tell when a fenced app opens. We'll take you there — find Fenced in the list and flip the switch.";

export default function ExplainerScreen() {
  const styles = useThemedStyles(createStyles);
  const copy = Platform.OS === "ios" ? IOS_COPY : ANDROID_COPY;
  const caps = FencedBlocking.getCapabilities();

  async function grant() {
    const status = await FencedBlocking.requestAuthorization();
    const categories = getOnboardingState().categories;
    await FencedBlocking.presentAppPicker(categories);

    const practice = status !== "approved" || caps.practiceOnly;
    setPracticeMode(practice);
    router.push("/(onboarding)/first-session");
  }

  function skip() {
    setPracticeMode(true);
    router.push("/(onboarding)/first-session");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>How fencing works</Text>
      <Text style={styles.title}>One permission. Then we build the fence.</Text>
      <Text style={styles.body}>{copy}</Text>

      <View style={{ marginTop: 20 }}>
        <FenceDemo caption="While you focus, pickets go up one by one." />
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>You'll see a system screen next</Text>
        <Text style={styles.previewText}>
          {Platform.OS === "ios"
            ? "Screen Time authorization"
            : "Usage access settings"}
        </Text>
        {caps.practiceOnly && (
          <Text style={styles.previewNote}>{caps.notes}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={() => void grant()}>
          <Text style={styles.buttonText}>Turn on fencing</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={skip}>
          <Text style={styles.secondaryText}>Skip for now — practice mode</Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 24 },
    kicker: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    title: { fontSize: 28, fontWeight: "700", color: t.text, lineHeight: 34 },
    body: { fontSize: 16, color: t.textMuted, marginTop: 16, lineHeight: 24 },
    preview: {
      marginTop: 28,
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 18,
    },
    previewLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      marginBottom: 6,
    },
    previewText: { fontSize: 16, fontWeight: "600", color: t.text },
    previewNote: { fontSize: 13, color: t.textMuted, marginTop: 10, lineHeight: 18 },
    footer: { marginTop: "auto", gap: 8, paddingBottom: 12 },
    button: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    buttonText: { fontSize: 17, fontWeight: "700", color: t.onPrimary },
    secondary: { paddingVertical: 14, alignItems: "center" },
    secondaryText: { fontSize: 15, fontWeight: "600", color: t.accent },
  });
