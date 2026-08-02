import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppState } from "../../src/hooks/use-app-state";
import { formatFocusHours } from "../../src/lib/local-store";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function InsightsScreen() {
  const { state } = useAppState();

  const history = state.sessionHistory;
  const completedCount = state.sessionsCompleted;
  const totalSessions = history.length;
  const completionRate =
    totalSessions > 0
      ? Math.round((completedCount / Math.max(1, totalSessions)) * 100)
      : 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Insights & Analytics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Headline Stat Cards */}
        <View style={styles.gridRow}>
          <View style={[styles.statCard, { backgroundColor: "#EBF3EE" }]}>
            <Ionicons name="time" size={24} color={PINE} />
            <Text style={styles.statNumber}>
              {formatFocusHours(state.focusMinutesThisWeek)}
            </Text>
            <Text style={styles.statLabel}>Focus This Week</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#FDF4E3" }]}>
            <Ionicons name="shield" size={24} color="#D97706" />
            <Text style={styles.statNumber}>{state.shieldHitsThisWeek}</Text>
            <Text style={styles.statLabel}>Shield Hits</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={[styles.statCard, { backgroundColor: "#F3F0EC" }]}>
            <Ionicons name="flame" size={24} color="#E11D48" />
            <Text style={styles.statNumber}>{state.streakDays} Days</Text>
            <Text style={styles.statLabel}>Fence Line Streak</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: "#EEF2FF" }]}>
            <Ionicons name="checkmark-done-circle" size={24} color="#4F46E5" />
            <Text style={styles.statNumber}>{completionRate}%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>

        {/* Platform Transparency Notice */}
        <View style={styles.platformNoticeCard}>
          <Ionicons name="information-circle-outline" size={22} color={PINE} />
          <View style={{ flex: 1 }}>
            <Text style={styles.platformTitle}>
              {Platform.OS === "ios"
                ? "iOS Screen Time Privacy Signal"
                : "Android Usage Analytics"}
            </Text>
            <Text style={styles.platformBody}>
              {Platform.OS === "ios"
                ? "Rendered privately on your device by iOS; Fenced never sees or transmits specific app names or bundle identifiers."
                : "App names and category shield hits are stored locally on your device for high transparency."}
            </Text>
          </View>
        </View>

        {/* Recent Focus Session Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Focus Sessions</Text>
          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No completed sessions yet. Start your first session from the Fence tab!
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((sess, idx) => (
                <View
                  key={sess.id}
                  style={[
                    styles.historyRow,
                    idx < history.length - 1 && styles.historyBorder,
                  ]}
                >
                  <View style={styles.historyIcon}>
                    <Ionicons name="play-circle" size={22} color={PINE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyPreset}>{sess.presetLabel}</Text>
                    <Text style={styles.historyMeta}>
                      {new Date(sess.completedAt).toLocaleDateString()} · {sess.durationMinutes} min
                    </Text>
                  </View>
                  <View style={styles.shieldBadge}>
                    <Ionicons name="shield-outline" size={14} color="#D97706" />
                    <Text style={styles.shieldText}>{sess.shieldHits}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE5DF",
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: INK, marginLeft: 12 },
  scroll: { padding: 20 },
  gridRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: "center",
  },
  statNumber: { fontSize: 24, fontWeight: "700", color: INK, marginTop: 8 },
  statLabel: { fontSize: 13, color: SLATE, marginTop: 2 },
  platformNoticeCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    alignItems: "flex-start",
  },
  platformTitle: { fontSize: 14, fontWeight: "700", color: INK },
  platformBody: { fontSize: 12, color: SLATE, marginTop: 2, lineHeight: 16 },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: SLATE,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: SLATE, textAlign: "center" },
  historyList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: "#F0ECE6" },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SAND,
    alignItems: "center",
    justifyContent: "center",
  },
  historyPreset: { fontSize: 15, fontWeight: "600", color: INK },
  historyMeta: { fontSize: 12, color: SLATE, marginTop: 2 },
  shieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF4E3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  shieldText: { fontSize: 12, fontWeight: "700", color: "#D97706" },
});
