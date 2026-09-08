import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  DISTRACTION_CATEGORIES,
  setCategories,
  type DistractionCategory,
} from "../../src/lib/onboarding-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { pushOnboardingProfile } from "../../src/lib/sync/profile";
import { useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function SourcesScreen() {
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();
  const [selected, setSelected] = useState<DistractionCategory[]>([
    "social",
    "video",
  ]);

  function toggle(id: DistractionCategory) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function continueNext() {
    setCategories(selected);
    if (auth.isSignedIn) {
      void pushOnboardingProfile(api, auth.user?.displayName, auth.user?.email);
    }
    router.push("/(onboarding)/explainer");
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.kicker}>Distractions by</Text>
      <Text style={styles.title}>Where does the time go?</Text>
      <Text style={styles.subtitle}>
        Pick categories, not individual apps. We'll pre-filter the picker next.
      </Text>

      <View style={styles.grid}>
        {DISTRACTION_CATEGORIES.map((cat) => {
          const active = selected.includes(cat.id);
          return (
            <Pressable
              key={cat.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggle(cat.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
        disabled={selected.length === 0}
        onPress={continueNext}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
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
    title: { fontSize: 28, fontWeight: "700", color: t.text },
    subtitle: { fontSize: 15, color: t.textMuted, marginTop: 10, lineHeight: 22, marginBottom: 24 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, flex: 1 },
    chip: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: t.surface,
      borderWidth: 2,
      borderColor: "transparent",
    },
    chipActive: { borderColor: t.accentAlt, backgroundColor: t.accentSoft },
    chipText: { fontSize: 16, fontWeight: "600", color: t.text },
    chipTextActive: { color: t.accent },
    button: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
      marginBottom: 12,
    },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontSize: 17, fontWeight: "700", color: t.onPrimary },
  });
