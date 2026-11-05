import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import type { WeeklyCoachBrief } from "@fenced/ai/client";
import { computeEnergyCurve } from "@fenced/core";
import { radii } from "@fenced/ui";
import { FenceLineStreakBanner } from "../../src/components/fence";
import { Badge, Button, FenceCard, IconButton, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useProgress } from "../../src/hooks/use-progress";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { canUseLlmUi } from "../../src/lib/ai-access";
import { addFencedHour, formatFocusHours } from "../../src/lib/local-store";
import { hourlyBreaches, MINUTES_PER_INTERCEPT, timeReclaimedMinutes, vulnerableHour } from "../../src/lib/stats";
import { buildWeeklyMetrics } from "../../src/lib/weekly-metrics";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const COACH_CACHE_KEY = "fenced.ai.weeklyCoach.v1";
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
const pad = (n: number) => String(n).padStart(2, "0");

export default function InsightsScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const history = useAppSelector((st) => st.sessionHistory);
  const fencedHours = useAppSelector((st) => st.fencedHours);
  const progress = useProgress();
  const auth = useAuth();

  const energyProfile = useMemo(
    () =>
      computeEnergyCurve(
        history.map((h) => ({
          startedAt: h.startedAt || h.completedAt,
          durationMinutes: h.durationMinutes,
          status: h.status,
          shieldHits: h.shieldHits,
        }))
      ),
    [history]
  );
  const api = useApi();
  const llmOk = canUseLlmUi("llm-weekly-coach");
  const [brief, setBrief] = useState<WeeklyCoachBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const recent = useMemo(() => history.filter((h) => Date.now() - new Date(h.completedAt).getTime() < 30 * 86_400_000), [history]);
  const completionRate = recent.length ? Math.round((recent.filter((h) => h.status === "completed").length / recent.length) * 100) : null;
  const buckets = useMemo(() => hourlyBreaches(history), [history]);
  const weak = useMemo(() => vulnerableHour(buckets), [buckets]);
  const reclaimed = useMemo(() => timeReclaimedMinutes(history), [history]);
  const maxSessions = Math.max(1, ...buckets.map((b) => b.sessions));
  const maxHits = Math.max(1, ...buckets.map((b) => b.shieldHits));
  const totalHits = buckets.reduce((sum, b) => sum + b.shieldHits, 0);
  const alreadyFenced = weak && fencedHours.some((h) => h.enabled && Number(h.startTime.slice(0, 2)) <= weak.hour && Number(h.endTime.slice(0, 2)) > weak.hour);

  useEffect(() => {
    if (!llmOk) return;
    void AsyncStorage.getItem(COACH_CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { at: string; brief: WeeklyCoachBrief };
        if (Date.now() - new Date(parsed.at).getTime() < 7 * 86_400_000) setBrief(parsed.brief);
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
      const result = await api.ai.weeklyCoach.mutate(buildWeeklyMetrics());
      setBrief(result);
      await AsyncStorage.setItem(COACH_CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), brief: result }));
    } catch {
      setError("Coach unavailable — the numbers above are still the source of truth.");
    } finally {
      setLoading(false);
    }
  }

  function fenceWeakHour() {
    if (!weak) return;
    addFencedHour({
      label: `${hourLabel(weak.hour)} guard`,
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: `${pad(weak.hour)}:00`,
      endTime: `${pad((weak.hour + 1) % 24)}:00`,
    });
    setAdded(true);
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Txt variant="title2" accessibilityRole="header">
          Insights
        </Txt>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.grid}>
          <Stat icon="time-outline" value={formatFocusHours(progress.weekFocusMinutes)} label="Focused this week" color={t.accent} />
          <Stat icon="git-commit-outline" value={`${progress.streakDays}d`} label="Fence line" color={t.accentAlt} />
          <Stat icon="checkmark-done-outline" value={completionRate == null ? "—" : `${completionRate}%`} label="Finished (30d)" color={t.success} />
          <Stat icon="hourglass-outline" value={`~${formatFocusHours(reclaimed)}`} label="Time reclaimed" color={t.info} />
        </View>
        <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
          Time reclaimed estimates {MINUTES_PER_INTERCEPT} minutes of refocusing saved per blocked reach. It is an estimate, not a measurement.
        </Txt>

        <SectionHeader title="Fence line · 30 days" />
        <FenceCard>
          <FenceLineStreakBanner days={30} />
        </FenceCard>

        <SectionHeader title="Breach radar" />
        <FenceCard>
          <View style={{ flexDirection: "row", gap: 14, marginBottom: 12 }}>
            <Legend color={t.accent} icon="shield-checkmark-outline" label="Sessions" />
            <Legend color={t.breach} icon="hand-left-outline" label="Shield hits" />
          </View>
          <View
            accessible
            accessibilityLabel={`Sessions and shield hits by hour of day. ${totalHits} shield hits in total.${weak ? ` Most around ${hourLabel(weak.hour)}.` : ""}`}
            style={s.radar}
          >
            {buckets.map((b) => (
              <View key={b.hour} style={s.radarCol}>
                <View style={s.radarHalf}>
                  <View style={[s.bar, { height: `${(b.sessions / maxSessions) * 100}%`, backgroundColor: t.accent }]} />
                </View>
                <View style={[s.radarHalf, { justifyContent: "flex-start" }]}>
                  <View style={[s.bar, { height: `${(b.shieldHits / maxHits) * 100}%`, backgroundColor: t.breach, opacity: weak?.hour === b.hour ? 1 : 0.65 }]} />
                </View>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            {[0, 6, 12, 18, 23].map((h) => (
              <Txt key={h} variant="micro" tone="muted" numeric>
                {hourLabel(h)}
              </Txt>
            ))}
          </View>

          {weak ? (
            <View style={s.reco}>
              <Ionicons name="bulb-outline" size={18} color={t.breach} />
              <View style={{ flex: 1 }}>
                <Txt variant="callout">
                  Reaches for fenced apps cluster around {hourLabel(weak.hour)} ({weak.shieldHits} shield hits across {weak.sessions} session
                  {weak.sessions === 1 ? "" : "s"}).
                </Txt>
                {alreadyFenced || added ? (
                  <View style={{ marginTop: 8 }}>
                    <Badge label="Fenced Hour covers it" tone="success" />
                  </View>
                ) : (
                  <Button label={`Add a Fenced Hour at ${hourLabel(weak.hour)}`} kind="secondary" icon="time-outline" onPress={fenceWeakHour} style={{ marginTop: 10 }} />
                )}
              </View>
            </View>
          ) : (
            <Txt variant="caption" tone="muted" style={{ marginTop: 12 }}>
              A pattern shows up once there are a few shield hits to compare. Nothing to act on yet.
            </Txt>
          )}
        </FenceCard>

        <SectionHeader title="Biological Energy Curve" />
        <FenceCard>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Txt variant="headline">
              {energyProfile.chronotype === "morning_lark"
                ? "Morning Lark"
                : energyProfile.chronotype === "night_owl"
                ? "Night Owl"
                : "Balanced Chronotype"}
            </Txt>
            <Badge
              label={`Peak ~${hourLabel(energyProfile.peakHour)}`}
              tone="accent"
            />
          </View>
          <Txt variant="callout" tone="muted">
            Your personal focus efficiency peaks around {hourLabel(energyProfile.peakHour)}. Align your highest-load tasks with this biological window for maximal focus with minimal friction.
          </Txt>
        </FenceCard>

        {llmOk && (
          <>
            <SectionHeader title="Weekly coach" />
            <FenceCard>
              <Badge label="AI suggests" tone="info" />
              {brief ? (
                <>
                  <Txt variant="headline" style={{ marginTop: 8 }}>
                    {brief.headline}
                  </Txt>
                  {brief.bullets.map((b, i) => (
                    <Txt key={i} variant="callout" tone="muted" style={{ marginTop: 4 }}>
                      · {b}
                    </Txt>
                  ))}
                  <Txt variant="callout" tone="accent" style={{ marginTop: 8 }}>
                    {brief.nextAction}
                  </Txt>
                </>
              ) : (
                <Txt variant="callout" tone="muted" style={{ marginTop: 8 }}>
                  The numbers above are authoritative. Generate a short brief from them (cached for a week).
                </Txt>
              )}
              {loading ? (
                <ActivityIndicator color={t.accent} style={{ marginTop: 12 }} />
              ) : (
                <Button
                  label={brief ? "Cached for this week" : auth.isSignedIn ? "Generate weekly coach" : "Sign in for weekly coach"}
                  kind="secondary"
                  disabled={!auth.isSignedIn || Boolean(brief)}
                  onPress={() => void generateCoach()}
                  style={{ marginTop: 12 }}
                />
              )}
              {error && (
                <Txt variant="caption" tone="error" style={{ marginTop: 6 }}>
                  {error}
                </Txt>
              )}
            </FenceCard>
          </>
        )}

        <View style={s.notice}>
          <Ionicons name="information-circle-outline" size={20} color={t.accent} />
          <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
            {Platform.OS === "ios"
              ? "We can't see what you do in your apps. Apple doesn't tell us. Shield hits are counted on this phone."
              : "App names for shield hits are stored on this phone only."}
          </Txt>
        </View>

        <SectionHeader title="Recent sessions" />
        <FenceCard style={{ paddingVertical: 4 }}>
          {history.length === 0 ? (
            <Txt variant="callout" tone="muted" style={{ paddingVertical: 12 }}>
              No sessions yet. Your first panel shows up here.
            </Txt>
          ) : (
            history.slice(0, 20).map((h, i, arr) => (
              <View key={h.id} style={[s.histRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons
                  name={h.status === "completed" ? "checkmark-circle-outline" : "remove-circle-outline"}
                  size={20}
                  color={h.status === "completed" ? t.success : t.breach}
                />
                <View style={{ flex: 1 }}>
                  <Txt variant="body" numberOfLines={1}>
                    {h.presetLabel}
                  </Txt>
                  <Txt variant="caption" tone="muted" numeric>
                    {new Date(h.completedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                    {h.durationMinutes} min{h.status === "abandoned" ? " · left early" : ""}
                  </Txt>
                </View>
                {h.shieldHits > 0 && (
                  <Txt variant="caption" tone="breach" numeric>
                    {h.shieldHits} hit{h.shieldHits === 1 ? "" : "s"}
                  </Txt>
                )}
              </View>
            ))
          )}
        </FenceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label, color }: { icon: React.ComponentProps<typeof Ionicons>["name"]; value: string; label: string; color: string }) {
  const s = useThemedStyles(createStyles);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={20} color={color} />
      <Txt variant="title2" numeric style={{ marginTop: 6 }}>
        {value}
      </Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

function Legend({ color, icon, label }: { color: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
    scroll: { padding: 20, paddingBottom: 48 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stat: {
      flexBasis: "47%",
      flexGrow: 1,
      padding: 14,
      borderRadius: radii.card,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.cardBorder,
    },
    radar: { flexDirection: "row", height: 120, gap: 2 },
    radarCol: { flex: 1 },
    radarHalf: { flex: 1, justifyContent: "flex-end" },
    bar: { width: "100%", borderRadius: 2, minHeight: 1 },
    reco: { flexDirection: "row", gap: 10, marginTop: 16, padding: 12, borderRadius: radii.md, backgroundColor: t.breachSoft },
    notice: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 20 },
    histRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomWidth: 1, borderColor: t.borderSubtle },
  });
