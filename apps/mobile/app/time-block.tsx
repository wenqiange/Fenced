import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import type { ScheduledBlock } from "@fenced/core";
import type { ReplanAdvice, SoftPreference } from "@fenced/ai/client";
import { useAppState } from "../src/hooks/use-app-state";
import { useAuth } from "../src/lib/auth";
import { useApi } from "../src/lib/api";
import { canUseLlmUi } from "../src/lib/ai-access";
import { addCalendarEvents } from "../src/lib/local-store";
import {
  describePlacementReason,
  formatBlockRange,
  groupBlocksByDay,
  proposeSchedule,
  proposeScheduleWithAdvice,
  summarizeForReplanAdvice,
  type ScheduleHorizon,
} from "../src/lib/time-block";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

export default function TimeBlockScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { state } = useAppState();
  const auth = useAuth();
  const api = useApi();
  const params = useLocalSearchParams<{ horizon?: string; softPrefs?: string }>();
  const [horizon, setHorizon] = useState<ScheduleHorizon>(
    params.horizon === "today" || params.horizon === "week"
      ? params.horizon
      : "today"
  );
  const [softPrefs, setSoftPrefs] = useState<SoftPreference[] | null>(() => {
    if (params.softPrefs) {
      try {
        return JSON.parse(params.softPrefs);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [advice, setAdvice] = useState<ReplanAdvice | null>(null);
  const [adviseLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const llmOk = canUseLlmUi("llm-replan-advice");

  const proposal = useMemo(
    () =>
      softPrefs
        ? proposeScheduleWithAdvice(horizon, softPrefs)
        : proposeSchedule(horizon),
    [state.tasks, state.calendarEvents, state.fencedHours, horizon, softPrefs],
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const block of proposal.blocks) {
        next[block.id] = prev[block.id] ?? true;
      }
      return next;
    });
  }, [proposal.blocks]);

  useEffect(() => {
    setAdvice(null);
    setAdviceError(null);
  }, [horizon]);

  const selectedBlocks = proposal.blocks.filter((b) => selected[b.id] !== false);
  const selectedMinutes = selectedBlocks.reduce((sum, b) => sum + b.minutes, 0);
  const dayGroups = useMemo(() => groupBlocksByDay(proposal.blocks), [proposal.blocks]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  }

  function accept() {
    if (selectedBlocks.length === 0) return;
    const created = addCalendarEvents(
      selectedBlocks.map((block) => ({
        title: blockTitle(block),
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        linkedTaskId: block.taskId,
        source: "time-block" as const,
        notes: softPrefs ? "Scheduled with AI advice (deterministic packer)" : "Auto-scheduled from Tasks",
      })),
    );
    // Sync happens through the outbox: created events are already queued.
    void created;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/calendar");
  }

  async function requestAdvice() {
    if (!llmOk || !auth.isSignedIn) return;
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      const base = proposeSchedule(horizon);
      const summary = summarizeForReplanAdvice(base, horizon);
      const result = await api.ai.adviseReplan.mutate(summary);
      setAdvice(result);
    } catch {
      setAdviceError("AI advice unavailable offline or for this account.");
    } finally {
      setAdviceLoading(false);
    }
  }

  function applyAdvice() {
    if (!advice) return;
    setHorizon(advice.suggestedHorizon);
    setSoftPrefs(advice.softPreferences);
  }

  function clearAdvice() {
    setSoftPrefs(null);
    setAdvice(null);
  }

  function safeGoBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/tasks");
  }

  const eligibleCount = state.tasks.filter((t) => !t.completed).length;
  const freeTotal = proposal.days.reduce((sum, d) => sum + d.freeMinutes, 0);
  const usedTotal = proposal.days.reduce((sum, d) => sum + d.usedMinutes, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={safeGoBack} hitSlop={8}>
          <Ionicons name="close" size={26} color={t.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Auto-schedule</Text>
        <Pressable onPress={() => router.push("/planning-chat")} hitSlop={8}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={22}
            color={llmOk ? t.accent : t.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lede}>
          Deterministic plan — no model places blocks. AI may only suggest
          preferences; you still review and accept.
        </Text>

        <View style={styles.horizonToggle}>
          {(
            [
              ["today", "Today"],
              ["week", "Next 7 days"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.horizonBtn, horizon === value && styles.horizonBtnActive]}
              onPress={() => {
                setHorizon(value);
                setSoftPrefs(null);
              }}
            >
              <Text
                style={[styles.horizonText, horizon === value && styles.horizonTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {selectedBlocks.length} block{selectedBlocks.length === 1 ? "" : "s"} ·{" "}
            {selectedMinutes}m selected
          </Text>
          <Text style={styles.summarySub}>
            {freeTotal}m free in range
            {usedTotal > 0 ? ` · ${usedTotal}m proposed` : ""}
            {softPrefs ? " · AI prefs applied" : ""}
          </Text>
        </View>

        {llmOk && (
          <View style={styles.adviceCard}>
            <Text style={styles.adviceLabel}>AI suggests</Text>
            {!advice ? (
              <Pressable
                style={styles.adviceBtn}
                onPress={() => void requestAdvice()}
                disabled={adviseLoading || !auth.isSignedIn}
              >
                {adviseLoading ? (
                  <ActivityIndicator color={t.accent} />
                ) : (
                  <Text style={styles.adviceBtnText}>
                    {auth.isSignedIn ? "Explain & advise" : "Sign in for AI advice"}
                  </Text>
                )}
              </Pressable>
            ) : (
              <>
                <Text style={styles.adviceSummary}>{advice.summary}</Text>
                <View style={styles.chipRow}>
                  {advice.softPreferences.map((p, i) => (
                    <Text key={i} style={styles.prefChip}>
                      {p.kind === "batch-tag" ? `batch #${p.tag}` : p.kind}
                    </Text>
                  ))}
                </View>
                <View style={styles.adviceActions}>
                  <Pressable style={styles.advicePrimary} onPress={applyAdvice}>
                    <Text style={styles.advicePrimaryText}>Use suggestion</Text>
                  </Pressable>
                  <Pressable onPress={clearAdvice}>
                    <Text style={styles.adviceDismiss}>Dismiss</Text>
                  </Pressable>
                </View>
              </>
            )}
            {adviceError && <Text style={styles.adviceError}>{adviceError}</Text>}
          </View>
        )}

        {proposal.blocks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to place</Text>
            <Text style={styles.emptyText}>
              {eligibleCount === 0
                ? "Add open tasks first."
                : "No free gaps left, or open tasks are blocked by incomplete dependencies."}
            </Text>
          </View>
        ) : (
          dayGroups.map((group) => (
            <View key={group.dayKey} style={styles.dayGroup}>
              {horizon === "week" && (
                <Text style={styles.dayLabel}>{group.label}</Text>
              )}
              {group.blocks.map((block) => {
                const on = selected[block.id] !== false;
                const reason = describePlacementReason(block.reason);
                return (
                  <View
                    key={block.id}
                    style={[styles.card, !on && styles.cardOff]}
                  >
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{blockTitle(block)}</Text>
                        <Text style={styles.cardTime}>{formatBlockRange(block)}</Text>
                      </View>
                      <Switch
                        value={on}
                        onValueChange={() => toggle(block.id)}
                        trackColor={{ false: t.borderStrong, true: t.primary }}
                        thumbColor={t.onPrimary}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>{block.minutes}m</Text>
                      {block.split && (
                        <Text style={styles.splitChip}>
                          Split {block.partIndex}/{block.partCount}
                        </Text>
                      )}
                      {reason && <Text style={styles.reasonChip}>{reason}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {proposal.unplaced.length > 0 && (
          <View style={styles.unplaced}>
            <Text style={styles.unplacedTitle}>Could not fit</Text>
            {proposal.unplaced.map((u) => (
              <Text key={`${u.taskId}-${u.reason}-${u.unmetMinutes}`} style={styles.unplacedRow}>
                {u.title} — {u.unmetMinutes}m (
                {u.reason === "blocked"
                  ? "blocked by another task"
                  : u.reason === "too-small-gaps"
                    ? "remaining gaps too small"
                    : u.reason === "no-window"
                      ? "no work window"
                      : "no gap large enough"}
                )
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.accept, selectedBlocks.length === 0 && styles.acceptDisabled]}
          onPress={accept}
          disabled={selectedBlocks.length === 0}
        >
          <Text style={styles.acceptText}>
            Accept {selectedBlocks.length > 0 ? `${selectedBlocks.length} blocks` : "selection"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function blockTitle(block: ScheduledBlock): string {
  if (!block.split) return block.title;
  return `${block.title} (${block.partIndex}/${block.partCount})`;
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
    headerTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 120 },
    lede: { fontSize: 15, color: t.textMuted, lineHeight: 22, marginBottom: 14 },
    horizonToggle: {
      flexDirection: "row",
      backgroundColor: t.track,
      borderRadius: 10,
      padding: 3,
      marginBottom: 14,
    },
    horizonBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    horizonBtnActive: { backgroundColor: t.surface },
    horizonText: { fontSize: 14, fontWeight: "500", color: t.textMuted },
    horizonTextActive: { color: t.text, fontWeight: "700" },
    summary: {
      backgroundColor: t.accentSoft,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    summaryText: { fontSize: 15, fontWeight: "700", color: t.text },
    summarySub: { fontSize: 13, color: t.accentAlt, marginTop: 4 },
    adviceCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.primary,
      padding: 12,
      marginBottom: 14,
    },
    adviceLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: t.accent,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    adviceBtn: { paddingVertical: 8 },
    adviceBtnText: { fontSize: 14, fontWeight: "700", color: t.accent },
    adviceSummary: { fontSize: 14, color: t.text, lineHeight: 20 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    prefChip: {
      fontSize: 11,
      fontWeight: "600",
      color: t.accentAlt,
      backgroundColor: t.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      overflow: "hidden",
    },
    adviceActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginTop: 12,
    },
    advicePrimary: {
      backgroundColor: t.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    advicePrimaryText: { color: t.onPrimary, fontWeight: "700", fontSize: 13 },
    adviceDismiss: { fontSize: 13, fontWeight: "600", color: t.textMuted },
    adviceError: { fontSize: 12, color: t.error, marginTop: 8 },
    dayGroup: { marginBottom: 8 },
    dayLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
      marginTop: 4,
    },
    empty: { paddingVertical: 40, alignItems: "center" },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: t.textMuted, textAlign: "center", lineHeight: 20 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    cardOff: { opacity: 0.45 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    cardTitle: { fontSize: 16, fontWeight: "600", color: t.text },
    cardTime: { fontSize: 13, color: t.textMuted, marginTop: 4 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    meta: { fontSize: 12, fontWeight: "600", color: t.textMuted },
    splitChip: {
      fontSize: 12,
      fontWeight: "700",
      color: t.accent,
      backgroundColor: t.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    reasonChip: {
      fontSize: 11,
      fontWeight: "600",
      color: t.accentAlt,
      backgroundColor: t.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    unplaced: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.borderStrong },
    unplacedTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 8,
    },
    unplacedRow: { fontSize: 13, color: t.textMuted, marginBottom: 6, lineHeight: 18 },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: 16,
      paddingBottom: 28,
      backgroundColor: t.bg,
      borderTopWidth: 1,
      borderTopColor: t.borderStrong,
    },
    accept: {
      backgroundColor: t.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    acceptDisabled: { opacity: 0.4 },
    acceptText: { color: t.onPrimary, fontWeight: "700", fontSize: 16 },
  });
