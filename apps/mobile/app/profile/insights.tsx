import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { WeeklyCoachBrief } from "@fenced/ai/client";
import { useAppState } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { canUseLlmUi } from "../../src/lib/ai-access";
import { formatFocusHours } from "../../src/lib/local-store";
import { buildWeeklyMetrics } from "../../src/lib/weekly-metrics";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const COACH_CACHE_KEY = "fenced.ai.weeklyCoach.v1";

export default function InsightsScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { state } = useAppState();
  const auth = useAuth();
  const api = useApi();
  const llmOk = canUseLlmUi("llm-weekly-coach");
  const [brief, setBrief] = useState<WeeklyCoachBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = state.sessionHistory;
  const completedCount = state.sessionsCompleted;
  const totalSessions = history.length;
  const completionRate =
    totalSessions > 0
      ? Math.round((completedCount / Math.max(1, totalSessions)) * 100)
      : 100;

  useEffect(() => {
    if (!llmOk) return;
    void AsyncStorage.getItem(COACH_CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          at: string;
          brief: WeeklyCoachBrief;
        };
        const age = Date.now() - new Date(parsed.at).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) setBrief(parsed.brief);
      } catch {
        /* ignore */
      }
    });
  }, [llmOk]);

  async function generateCoach() {
    if (!llmOk || !auth.isSignedIn) return;
    setLoading(true);
    setError(null);
    try {
      const metrics = buildWeeklyMetrics();
      const result = await api.ai.weeklyCoach.mutate(metrics);
      setBrief(result);
      await AsyncStorage.setItem(
        COACH_CACHE_KEY,
        JSON.stringify({ at: new Date().toISOString(), brief: result }),
      );
    } catch {
      setError("Coach unavailable — metrics above are still the source of truth.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Insights & Analytics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.gridRow}>
          <View style={[styles.statCard, { backgroundColor: t.accentTint }]}>
            <Ionicons name="time" size={24} color={t.accent} />
            <Text style={styles.statNumber}>
              {formatFocusHours(state.focusMinutesThisWeek)}
            </Text>
            <Text style={styles.statLabel}>Focus This Week</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: t.warningSoft }]}>
            <Ionicons name="shield" size={24} color={t.warning} />
            <Text style={styles.statNumber}>{state.shieldHitsThisWeek}</Text>
            <Text style={styles.statLabel}>Shield Hits</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={[styles.statCard, { backgroundColor: t.surfaceAlt }]}>
            <Ionicons name="flame" size={24} color={t.error} />
            <Text style={styles.statNumber}>{state.streakDays} Days</Text>
            <Text style={styles.statLabel}>Fence Line Streak</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: t.infoSoft }]}>
            <Ionicons name="checkmark-done-circle" size={24} color={t.info} />
            <Text style={styles.statNumber}>{completionRate}%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>

        {llmOk && (
          <View style={styles.coachCard}>
            <Text style={styles.coachEyebrow}>AI suggests</Text>
            {brief ? (
              <>
                <Text style={styles.coachHeadline}>{brief.headline}</Text>
                {brief.bullets.map((b, i) => (
                  <Text key={i} style={styles.coachBullet}>
                    · {b}
                  </Text>
                ))}
                <Text style={styles.coachNext}>{brief.nextAction}</Text>
              </>
            ) : (
              <Text style={styles.coachHint}>
                Numbers above are authoritative. Generate a short coach brief from
                them (once per week cached).
              </Text>
            )}
            <Pressable
              style={styles.coachBtn}
              onPress={() => void generateCoach()}
              disabled={loading || !auth.isSignedIn || Boolean(brief)}
            >
              {loading ? (
                <ActivityIndicator color={t.onPrimary} />
              ) : (
                <Text style={styles.coachBtnText}>
                  {brief
                    ? "Cached for this week"
                    : auth.isSignedIn
                      ? "Generate weekly coach"
                      : "Sign in for weekly coach"}
                </Text>
              )}
            </Pressable>
            {error && <Text style={styles.coachError}>{error}</Text>}
          </View>
        )}

        <View style={styles.platformNoticeCard}>
          <Ionicons name="information-circle-outline" size={22} color={t.accent} />
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
                    <Ionicons name="play-circle" size={22} color={t.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyPreset}>{sess.presetLabel}</Text>
                    <Text style={styles.historyMeta}>
                      {new Date(sess.completedAt).toLocaleDateString()} · {sess.durationMinutes} min
                    </Text>
                  </View>
                  <View style={styles.shieldBadge}>
                    <Ionicons name="shield-outline" size={14} color={t.warning} />
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

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: t.text, marginLeft: 12 },
    scroll: { padding: 20 },
    gridRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      justifyContent: "center",
    },
    statNumber: { fontSize: 24, fontWeight: "700", color: t.text, marginTop: 8 },
    statLabel: { fontSize: 13, color: t.textMuted, marginTop: 2 },
    coachCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary,
      padding: 14,
      marginBottom: 12,
    },
    coachEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: t.accent,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    coachHeadline: { fontSize: 16, fontWeight: "700", color: t.text, marginBottom: 8 },
    coachBullet: { fontSize: 13, color: t.textMuted, lineHeight: 18, marginBottom: 4 },
    coachNext: { fontSize: 13, fontWeight: "600", color: t.accent, marginTop: 8 },
    coachHint: { fontSize: 13, color: t.textMuted, lineHeight: 18, marginBottom: 10 },
    coachBtn: {
      marginTop: 12,
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    coachBtnText: { color: t.onPrimary, fontWeight: "700", fontSize: 13 },
    coachError: { fontSize: 12, color: t.error, marginTop: 8 },
    platformNoticeCard: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 14,
      marginVertical: 12,
      alignItems: "flex-start",
    },
    platformTitle: { fontSize: 14, fontWeight: "700", color: t.text },
    platformBody: { fontSize: 12, color: t.textMuted, marginTop: 2, lineHeight: 16 },
    section: { marginTop: 12 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    emptyCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
    },
    emptyText: { fontSize: 14, color: t.textMuted, textAlign: "center" },
    historyList: {
      backgroundColor: t.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      gap: 12,
    },
    historyBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    historyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    historyPreset: { fontSize: 15, fontWeight: "600", color: t.text },
    historyMeta: { fontSize: 12, color: t.textMuted, marginTop: 2 },
    shieldBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.warningSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    shieldText: { fontSize: 12, fontWeight: "700", color: t.warning },
  });
