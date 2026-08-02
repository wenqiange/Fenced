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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { state } = useAppState();

  const handlePrevDate = () => {
    const next = new Date(selectedDate);
    if (viewMode === "day") next.setDate(next.getDate() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else if (viewMode === "month") next.setMonth(next.getMonth() - 1);
    setSelectedDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(selectedDate);
    if (viewMode === "day") next.setDate(next.getDate() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else if (viewMode === "month") next.setMonth(next.getMonth() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const fencedToday = useMemo(
    () => getFencedHoursForToday(selectedDate),
    [state.fencedHours, selectedDate.toDateString()]
  );

  const dueForSelectedDate = useMemo(() => {
    const key = selectedDate.toISOString().slice(0, 10);
    return state.tasks.filter((t) => {
      if (t.completed || !t.dueAt) return false;
      return t.dueAt.slice(0, 10) === key;
    });
  }, [state.tasks, selectedDate.toDateString()]);

  // Generate 7 days for Week View
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Generate Month Matrix (35 cells)
  const monthMatrix = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const cells: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < 35; i++) {
      const dayNum = i - offset + 1;
      const cellDate = new Date(year, month, dayNum);
      cells.push({
        date: cellDate,
        inMonth: cellDate.getMonth() === month,
      });
    }
    return cells;
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Calendar</Text>
          <Pressable style={styles.todayChip} onPress={handleToday}>
            <Text style={styles.todayChipText}>Today</Text>
          </Pressable>
        </View>

        <View style={styles.navRow}>
          <Pressable style={styles.navArrow} onPress={handlePrevDate}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>

          <Text style={styles.dateDisplay}>
            {selectedDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
              ...(viewMode === "day" ? { day: "numeric", weekday: "short" } : {}),
            })}
          </Text>

          <Pressable style={styles.navArrow} onPress={handleNextDate}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

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
                            🔒 {b.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {dueForSelectedDate.length > 0 && (
              <View style={styles.dueSection}>
                <Text style={styles.dueTitle}>Scheduled Tasks</Text>
                {dueForSelectedDate.map((t) => (
                  <View key={t.id} style={styles.dueRow}>
                    <Text style={styles.dueTask}>✓ {t.title}</Text>
                    <Text style={styles.dueTime}>
                      {new Date(t.dueAt!).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {fencedToday.length === 0 && dueForSelectedDate.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No Fenced Hours or scheduled tasks for this date.
                </Text>
              </View>
            )}
          </>
        )}

        {viewMode === "week" && (
          <View style={styles.weekContainer}>
            <View style={styles.weekHeaderRow}>
              {weekDays.map((d, i) => {
                const isSelected = d.toDateString() === selectedDate.toDateString();
                return (
                  <Pressable
                    key={i}
                    style={[styles.weekDayCol, isSelected && styles.weekDayColActive]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={[styles.weekDayLabel, isSelected && styles.weekTextActive]}>
                      {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                    </Text>
                    <Text style={[styles.weekDayNum, isSelected && styles.weekTextActive]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.weekAgenda}>
              <Text style={styles.dueTitle}>
                {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </Text>
              {dueForSelectedDate.length > 0 ? (
                dueForSelectedDate.map((t) => (
                  <View key={t.id} style={styles.dueRow}>
                    <Text style={styles.dueTask}>{t.title}</Text>
                    <Text style={styles.dueTime}>
                      {new Date(t.dueAt!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No scheduled items for this day.</Text>
              )}
            </View>
          </View>
        )}

        {viewMode === "month" && (
          <View style={styles.monthContainer}>
            <View style={styles.monthDaysHeader}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={styles.monthHeaderCell}>{d}</Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {monthMatrix.map(({ date, inMonth }, i) => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const key = date.toISOString().slice(0, 10);
                const hasDue = state.tasks.some(
                  (t) => !t.completed && t.dueAt && t.dueAt.slice(0, 10) === key
                );

                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.monthCell,
                      !inMonth && styles.monthCellDimmed,
                      isSelected && styles.monthCellSelected,
                    ]}
                    onPress={() => {
                      setSelectedDate(date);
                      setViewMode("day");
                    }}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextSelected]}>
                      {date.getDate()}
                    </Text>
                    {hasDue && <View style={styles.dotIndicator} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: INK },
  todayChip: {
    backgroundColor: SAND,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todayChipText: { fontSize: 13, fontWeight: "600", color: PINE },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 22, fontWeight: "600", color: INK, marginTop: -2 },
  dateDisplay: { fontSize: 16, fontWeight: "600", color: INK },
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

  // Week view styles
  weekContainer: { gap: 16 },
  weekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  weekDayCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  weekDayColActive: { backgroundColor: PINE },
  weekDayLabel: { fontSize: 12, color: SLATE, marginBottom: 4 },
  weekDayNum: { fontSize: 15, fontWeight: "700", color: INK },
  weekTextActive: { color: "#FFFFFF" },
  weekAgenda: { marginTop: 8 },

  // Month view styles
  monthContainer: { gap: 12 },
  monthDaysHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0DCD6",
  },
  monthHeaderCell: { fontSize: 13, fontWeight: "600", color: SLATE },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  monthCell: {
    width: "13.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  monthCellDimmed: { opacity: 0.3 },
  monthCellSelected: { backgroundColor: PINE },
  monthCellText: { fontSize: 14, fontWeight: "600", color: INK },
  monthCellTextSelected: { color: "#FFFFFF" },
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TIMBER,
    marginTop: 2,
  },
});
