import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { applyAgeAssurance } from "../../src/lib/onboarding-state";
import { useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 90 }, (_, i) => currentYear - i);

export default function AgeScreen() {
  const styles = useThemedStyles(createStyles);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const canContinue = month !== null && year !== null;

  const yearOptions = useMemo(() => YEARS, []);

  function continueNext() {
    if (month === null || year === null) return;
    applyAgeAssurance(month, year, "US");
    router.push("/(onboarding)/auth");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Almost ready</Text>
        <Text style={styles.title}>
          So we can set Fenced up correctly for you
        </Text>
        <Text style={styles.subtitle}>
          Tell us the month and year you were born. We only use this to choose
          the right defaults.
        </Text>
      </View>

      <Text style={styles.label}>Month</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {MONTHS.map((name, index) => {
          const value = index + 1;
          const active = month === value;
          return (
            <Pressable
              key={name}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMonth(value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {name.slice(0, 3)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Year</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {yearOptions.map((y) => {
          const active = year === y;
          return (
            <Pressable
              key={y}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setYear(y)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {y}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          disabled={!canContinue}
          onPress={continueNext}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg, padding: 24 },
    header: { marginBottom: 28 },
    kicker: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    title: { fontSize: 28, fontWeight: "700", color: t.text, lineHeight: 34 },
    subtitle: { fontSize: 15, color: t.textMuted, marginTop: 10, lineHeight: 22 },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 8,
    },
    chipRow: { gap: 8, paddingBottom: 16 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: t.surface,
      borderWidth: 2,
      borderColor: "transparent",
    },
    chipActive: { borderColor: t.primary, backgroundColor: t.accentTint },
    chipText: { fontSize: 15, fontWeight: "600", color: t.text },
    chipTextActive: { color: t.accent },
    footer: { marginTop: "auto", paddingBottom: 12 },
    button: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontSize: 17, fontWeight: "700", color: t.onPrimary },
  });
