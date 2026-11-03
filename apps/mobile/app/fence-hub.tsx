import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppState } from "../src/hooks/use-app-state";
import {
  addFencedHour,
  deleteFencedHour,
  skipFencedHourToday,
  toggleFencedHour,
} from "../src/lib/local-store";
import { getOnboardingState } from "../src/lib/onboarding-state";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FenceHubScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { state } = useAppState();

  function addStudyBlock() {
    const intent = getOnboardingState().intent;
    addFencedHour({
      label: intent ? "Afternoon focus" : "Fenced Hours",
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: "14:00",
      endTime: "16:00",
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.title}>Manage fence</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Fenced Hours</Text>
        <Text style={styles.sectionSub}>
          Recurring blocks when your fence goes up automatically.
        </Text>

        {state.fencedHours.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              No schedule yet. Add a weekday block to see it on Today and
              Calendar.
            </Text>
            <Pressable style={styles.chipButton} onPress={addStudyBlock}>
              <Text style={styles.chipButtonText}>Add weekday block</Text>
            </Pressable>
          </View>
        ) : (
          state.fencedHours.map((h) => (
            <View key={h.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{h.label}</Text>
                <Pressable onPress={() => toggleFencedHour(h.id)}>
                  <Text style={[styles.status, !h.enabled && styles.statusOff]}>
                    {h.enabled ? "On" : "Off"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.cardBody}>
                {h.startTime}–{h.endTime} ·{" "}
                {h.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ")}
              </Text>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <Pressable
                  style={styles.skipButton}
                  onPress={() => skipFencedHourToday(h.id)}
                  accessibilityRole="button"
                  hitSlop={10}
                >
                  <Text style={styles.skipText}>Skip today</Text>
                </Pressable>
                <Pressable
                  style={styles.skipButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${h.label}`}
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert("Remove this Fenced Hour?", `${h.label}, ${h.startTime}–${h.endTime}`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => deleteFencedHour(h.id) },
                    ])
                  }
                >
                  <Text style={[styles.skipText, { color: t.error }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
          Session history
        </Text>
        {state.sessionHistory.length === 0 ? (
          <Text style={styles.sectionSub}>Complete a session to see it here.</Text>
        ) : (
          state.sessionHistory.slice(0, 8).map((s) => (
            <View key={s.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{s.presetLabel}</Text>
              <Text style={styles.historyMeta}>
                {s.durationMinutes}m · {s.shieldHits} hits ·{" "}
                {new Date(s.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.button} onPress={() => router.push("/session-sheet")}>
        <Text style={styles.buttonText}>Start a session now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    title: { fontSize: 20, fontWeight: "700", color: t.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sectionSub: { fontSize: 14, color: t.textMuted, marginTop: 6, marginBottom: 12 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    cardBody: { fontSize: 14, color: t.textMuted, marginTop: 8, lineHeight: 20 },
    status: { fontSize: 14, fontWeight: "700", color: t.accent },
    statusOff: { color: t.textMuted },
    skipButton: { marginTop: 12, alignSelf: "flex-start" },
    skipText: { fontSize: 14, fontWeight: "600", color: t.accentAlt },
    chipButton: {
      marginTop: 12,
      alignSelf: "flex-start",
      backgroundColor: t.accentSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    chipButtonText: { fontWeight: "600", color: t.accent },
    historyRow: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    historyTitle: { fontSize: 15, fontWeight: "600", color: t.text },
    historyMeta: { fontSize: 13, color: t.textMuted, marginTop: 4 },
    button: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    buttonText: { color: t.onPrimary, fontWeight: "700", fontSize: 16 },
  });
