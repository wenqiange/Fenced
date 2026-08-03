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
import { PINE, PAPER, INK, SLATE, SAND, TIMBER } from "../../src/lib/theme";

export default function SourcesScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, padding: 24 },
  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: INK },
  subtitle: { fontSize: 15, color: SLATE, marginTop: 10, lineHeight: 22, marginBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, flex: 1 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipActive: { borderColor: TIMBER, backgroundColor: SAND },
  chipText: { fontSize: 16, fontWeight: "600", color: INK },
  chipTextActive: { color: PINE },
  button: {
    backgroundColor: PINE,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
});
