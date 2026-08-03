import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import type { ScheduledBlock } from "@fenced/core";
import { useAppState } from "../src/hooks/use-app-state";
import { addCalendarEvents } from "../src/lib/local-store";
import {
  describePlacementReason,
  formatBlockRange,
  groupBlocksByDay,
  proposeSchedule,
  type ScheduleHorizon,
} from "../src/lib/time-block";
import { PINE, PAPER, INK, SLATE, SAND, TIMBER } from "../src/lib/theme";

export default function TimeBlockScreen() {
  const { state } = useAppState();
  const [horizon, setHorizon] = useState<ScheduleHorizon>("today");

  const proposal = useMemo(
    () => proposeSchedule(horizon),
    [state.tasks, state.calendarEvents, state.fencedHours, horizon],
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

  const selectedBlocks = proposal.blocks.filter((b) => selected[b.id] !== false);
  const selectedMinutes = selectedBlocks.reduce((sum, b) => sum + b.minutes, 0);
  const dayGroups = useMemo(() => groupBlocksByDay(proposal.blocks), [proposal.blocks]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !(prev[id] !== false) }));
  }

  function accept() {
    if (selectedBlocks.length === 0) return;
    addCalendarEvents(
      selectedBlocks.map((block) => ({
        title: blockTitle(block),
        startAt: block.startAt.toISOString(),
        endAt: block.endAt.toISOString(),
        linkedTaskId: block.taskId,
        source: "time-block" as const,
        notes: "Auto-scheduled from Tasks",
      })),
    );
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/calendar");
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
          <Ionicons name="close" size={26} color={SLATE} />
        </Pressable>
        <Text style={styles.headerTitle}>Auto-schedule</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lede}>
          Deterministic plan — no model. Review the blocks, turn off what you do
          not want, then accept.
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
              onPress={() => setHorizon(value)}
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
          </Text>
        </View>

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
                        trackColor={{ false: "#D8D2CA", true: PINE }}
                        thumbColor="#FFFFFF"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: INK },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  lede: { fontSize: 15, color: SLATE, lineHeight: 22, marginBottom: 14 },
  horizonToggle: {
    flexDirection: "row",
    backgroundColor: "#E8E4DE",
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
  horizonBtnActive: { backgroundColor: "#FFFFFF" },
  horizonText: { fontSize: 14, fontWeight: "500", color: SLATE },
  horizonTextActive: { color: INK, fontWeight: "700" },
  summary: {
    backgroundColor: SAND,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryText: { fontSize: 15, fontWeight: "700", color: INK },
  summarySub: { fontSize: 13, color: TIMBER, marginTop: 4 },
  dayGroup: { marginBottom: 8 },
  dayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: INK, marginBottom: 8 },
  emptyText: { fontSize: 14, color: SLATE, textAlign: "center", lineHeight: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardOff: { opacity: 0.45 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: INK },
  cardTime: { fontSize: 13, color: SLATE, marginTop: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  meta: { fontSize: 12, fontWeight: "600", color: SLATE },
  splitChip: {
    fontSize: 12,
    fontWeight: "700",
    color: PINE,
    backgroundColor: SAND,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  reasonChip: {
    fontSize: 11,
    fontWeight: "600",
    color: TIMBER,
    backgroundColor: SAND,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  unplaced: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E0DCD6" },
  unplacedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  unplacedRow: { fontSize: 13, color: SLATE, marginBottom: 6, lineHeight: 18 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderTopColor: "#E0DCD6",
  },
  accept: {
    backgroundColor: PINE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  acceptDisabled: { opacity: 0.4 },
  acceptText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
