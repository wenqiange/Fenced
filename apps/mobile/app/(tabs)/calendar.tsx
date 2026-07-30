import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useAppState } from "../../src/hooks/use-app-state";
import {
  getFencedHoursForToday,
  parseHour,
} from "../../src/lib/local-store";
import { PINE, PAPER, INK, SLATE, SAND, TIMBER } from "../../src/lib/theme";

type ViewMode = "day" | "week" | "month";

const DAY_START = 7;
const DAY_END = 21;

function hourOverlapsFenced(
  hour: number,
  startTime: string,
  endTime: string
): boolean {
  const slotStart = hour * 60;
  const slotEnd = (hour + 1) * 60;
  const blockStart = parseHour(startTime);
  const blockEnd = parseHour(endTime);
  return blockStart < slotEnd && blockEnd > slotStart;
}

export default function CalendarScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const { state } = useAppState();
  const today = new Date();

  const fencedToday = useMemo(
    () => getFencedHoursForToday(today),
    [state.fencedHours, today.toDateString()]
  );

  const dueToday = useMemo(() => {
    const key = today.toISOString().slice(0, 10);
    return state.tasks.filter((t) => {
      if (t.completed || !t.dueAt) return false;
      return t.dueAt.slice(0, 10) === key;
    });
  }, [state.tasks, today.toDateString()]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.viewToggle}>
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.viewButton,
                viewMode === mode && styles.viewButtonActive,
              ]}
              onPress={() => setViewMode(mode)}
            >
              <Text
                style={[
                  styles.viewText,
                  viewMode === mode && styles.viewTextActive,
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.dateDisplay}>
          {today.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Text>

        {viewMode !== "day" && (
          <Text style={styles.comingSoon}>
            {viewMode === "week" ? "Week" : "Month"} view is coming soon. Day
            view shows Fenced Hours and due tasks.
          </Text>
        )}

        {viewMode === "day" && (
          <>
            <View style={styles.timeline}>
              {Array.from(
                { length: DAY_END - DAY_START },
                (_, i) => i + DAY_START
              ).map((hour) => {
                const blocks = fencedToday.filter((h) =>
                  hourOverlapsFenced(hour, h.startTime, h.endTime)
                );
                return (
                  <View key={hour} style={styles.timeSlot}>
                    <Text style={styles.timeLabel}>
                      {hour.toString().padStart(2, "0")}:00
                    </Text>
                    <View style={styles.timeSlotBody}>
                      <View style={styles.timeSlotLine} />
                      {blocks.map((b) => (
                        <View key={b.id} style={styles.fencedBlock}>
                          <Text style={styles.fencedBlockText} numberOfLines={1}>
                            {b.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {dueToday.length > 0 && (
              <View style={styles.dueSection}>
                <Text style={styles.dueTitle}>Due today</Text>
                {dueToday.map((t) => (
                  <View key={t.id} style={styles.dueRow}>
                    <Text style={styles.dueTask}>{t.title}</Text>
                    <Text style={styles.dueTime}>
                      {new Date(t.dueAt!).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {fencedToday.length === 0 && dueToday.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No Fenced Hours or due tasks today. Add tasks or set Fenced
                  Hours in Fence → Manage.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: "700", color: INK, marginBottom: 12 },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#E8E4DE",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  viewButtonActive: { backgroundColor: "#FFFFFF" },
  viewText: { fontSize: 14, fontWeight: "500", color: SLATE },
  viewTextActive: { color: INK },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  dateDisplay: { fontSize: 15, color: SLATE, marginBottom: 20 },
  comingSoon: {
    fontSize: 14,
    color: SLATE,
    lineHeight: 20,
    marginBottom: 16,
  },
  timeline: { gap: 0 },
  timeSlot: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 56,
  },
  timeLabel: {
    width: 52,
    fontSize: 12,
    color: SLATE,
    fontVariant: ["tabular-nums"],
    paddingTop: 4,
  },
  timeSlotBody: { flex: 1, position: "relative", paddingBottom: 8 },
  timeSlotLine: {
    borderTopWidth: 1,
    borderTopColor: "#E0DCD6",
    marginTop: 8,
  },
  fencedBlock: {
    marginTop: 6,
    backgroundColor: SAND,
    borderLeftWidth: 3,
    borderLeftColor: PINE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fencedBlockText: { fontSize: 13, fontWeight: "600", color: TIMBER },
  dueSection: { marginTop: 24 },
  dueTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: INK,
    marginBottom: 10,
  },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  dueTask: { flex: 1, fontSize: 15, color: INK, marginRight: 8 },
  dueTime: { fontSize: 14, color: SLATE },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: SLATE, textAlign: "center" },
});
