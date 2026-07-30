import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppState } from "../src/hooks/use-app-state";
import {
  addFencedHour,
  skipFencedHourToday,
  toggleFencedHour,
} from "../src/lib/local-store";
import { getOnboardingState } from "../src/lib/onboarding-state";
import { PINE, PAPER, INK, SLATE, SAND, TIMBER } from "../src/lib/theme";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FenceHubScreen() {
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
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={INK} />
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
              <Pressable
                style={styles.skipButton}
                onPress={() => skipFencedHourToday(h.id)}
              >
                <Text style={styles.skipText}>Skip today</Text>
              </Pressable>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: INK },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSub: { fontSize: 14, color: SLATE, marginTop: 6, marginBottom: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: INK },
  cardBody: { fontSize: 14, color: SLATE, marginTop: 8, lineHeight: 20 },
  status: { fontSize: 14, fontWeight: "700", color: PINE },
  statusOff: { color: SLATE },
  skipButton: { marginTop: 12, alignSelf: "flex-start" },
  skipText: { fontSize: 14, fontWeight: "600", color: TIMBER },
  chipButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: SAND,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipButtonText: { fontWeight: "600", color: PINE },
  historyRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  historyTitle: { fontSize: 15, fontWeight: "600", color: INK },
  historyMeta: { fontSize: 13, color: SLATE, marginTop: 4 },
  button: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: PINE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
