import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useAppState } from "../../src/hooks/use-app-state";
import {
  formatFocusHours,
  getFencedHoursForToday,
  pickNextUpTask,
  type LocalTask,
} from "../../src/lib/local-store";
import {
  getDefaultSessionMinutes,
  INTENT_DEFAULTS,
} from "../../src/lib/onboarding-state";
import { PINE, TIMBER, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function TodayScreen() {
  const { onboarding } = useOnboarding();
  const { state } = useAppState();
  const today = new Date();
  const greeting = getGreeting();
  const showOnboardingCard = !onboarding.completed;
  const nextUp = pickNextUpTask(state.tasks);
  const preset = state.lastPreset;
  const duration = preset?.durationMinutes ?? getDefaultSessionMinutes();
  const presetName =
    preset?.label ??
    (onboarding.intent
      ? INTENT_DEFAULTS[onboarding.intent].label
      : "Focus");
  const fencedToday = getFencedHoursForToday();

  function openSessionSheet() {
    router.push("/session-sheet");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.date}>
            {today.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.streakBadge}>
            <Ionicons name="remove-outline" size={14} color={TIMBER} />
            <Text style={styles.streakText}>
              Your fence line is {state.streakDays} day
              {state.streakDays === 1 ? "" : "s"} long
            </Text>
          </View>
        </View>

        {showOnboardingCard ? (
          <Pressable
            style={styles.onboardingCard}
            onPress={() => router.push("/(onboarding)")}
          >
            <Text style={styles.onboardingTitle}>
              Try your first 5-minute session
            </Text>
            <Text style={styles.onboardingSub}>
              Finish setup and see your first fence panel built.
            </Text>
          </Pressable>
        ) : (
          <>
            {nextUp && (
              <View style={styles.nextUpCard}>
                <Text style={styles.nextUpLabel}>Next up</Text>
                <Text style={styles.nextUpTitle}>{nextUp.title}</Text>
                {nextUp.dueAt && (
                  <Text style={styles.nextUpMeta}>
                    {new Date(nextUp.dueAt).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
              </View>
            )}

            {!nextUp && state.sessionsCompleted > 0 && (
              <View style={styles.nextUpCard}>
                <Text style={styles.nextUpLabel}>Next up</Text>
                <Text style={styles.nextUpTitle}>
                  Nothing due right now — pick what matters.
                </Text>
              </View>
            )}
          </>
        )}

        <Pressable style={styles.sessionCard} onPress={openSessionSheet}>
          <View style={styles.sessionCardIcon}>
            <Ionicons name="shield" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.sessionCardContent}>
            <Text style={styles.sessionCardTitle}>Start a session</Text>
            <Text style={styles.sessionCardSub}>
              {presetName} · {duration}m
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={SLATE} />
        </Pressable>

        {fencedToday.length > 0 && (
          <Pressable
            style={styles.fencedStrip}
            onPress={() => router.push("/fence-hub")}
          >
            <Text style={styles.fencedStripLabel}>Fenced Hours today</Text>
            {fencedToday.map((h) => (
              <Text key={h.id} style={styles.fencedStripRow}>
                {h.label} · {h.startTime}–{h.endTime}
              </Text>
            ))}
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s agenda</Text>
          {state.tasks.filter((t: LocalTask) => !t.completed).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Nothing scheduled yet. Add a task or event to see it here.
              </Text>
            </View>
          ) : (
            state.tasks
              .filter((t: LocalTask) => !t.completed)
              .slice(0, 5)
              .map((t: LocalTask) => (
                <View key={t.id} style={styles.agendaRow}>
                  <Text style={styles.agendaTitle}>{t.title}</Text>
                  {t.dueAt && (
                    <Text style={styles.agendaMeta}>
                      {new Date(t.dueAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  )}
                </View>
              ))
          )}
        </View>

        <Pressable
          style={styles.insightCard}
          onPress={() => router.push("/(tabs)/you")}
        >
          <Text style={styles.insightLabel}>This week</Text>
          <Text style={styles.insightValue}>
            {formatFocusHours(state.focusMinutesThisWeek)} focused
          </Text>
          <Text style={styles.insightDetail}>
            {state.shieldHitsThisWeek} shield hits — tap for Insights
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  date: { fontSize: 13, color: SLATE, fontWeight: "500", marginBottom: 4 },
  greeting: { fontSize: 28, fontWeight: "700", color: INK },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: SAND,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: { fontSize: 13, fontWeight: "600", color: TIMBER },
  onboardingCard: {
    backgroundColor: SAND,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  onboardingTitle: { fontSize: 16, fontWeight: "700", color: PINE },
  onboardingSub: { fontSize: 14, color: SLATE, marginTop: 4, lineHeight: 20 },
  nextUpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  nextUpLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextUpTitle: { fontSize: 17, fontWeight: "600", color: INK, marginTop: 6 },
  nextUpMeta: { fontSize: 14, color: SLATE, marginTop: 4 },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PINE,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  sessionCardContent: { flex: 1 },
  sessionCardTitle: { fontSize: 17, fontWeight: "600", color: INK },
  sessionCardSub: { fontSize: 14, color: SLATE, marginTop: 2 },
  fencedStrip: {
    backgroundColor: SAND,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  fencedStripLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: PINE,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  fencedStripRow: { fontSize: 15, color: INK, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: INK,
    marginBottom: 12,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: SLATE, textAlign: "center" },
  agendaRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  agendaTitle: { fontSize: 15, color: INK, fontWeight: "500" },
  agendaMeta: { fontSize: 13, color: SLATE, marginTop: 4 },
  insightCard: {
    backgroundColor: PINE,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  insightLabel: { fontSize: 13, color: "#98A29B", fontWeight: "500" },
  insightValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F2F0EB",
    marginTop: 4,
  },
  insightDetail: { fontSize: 14, color: "#98A29B", marginTop: 8 },
});
