import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { evaluateClassMode, type TimetablePeriod } from "@fenced/core";
import { radii } from "@fenced/ui";
import { Badge, Button, Chip, FenceCard, IconButton, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { localId } from "../../src/lib/ids";
import { clearClassSchedule, setClassSchedule } from "../../src/lib/local-store";
import { useNow } from "../../src/hooks/use-now";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCHOOL_DAYS = [1, 2, 3, 4, 5];

function defaultPeriods(): TimetablePeriod[] {
  const mk = (name: string, start: string, end: string, isBreak = false): TimetablePeriod => ({
    id: localId("period"),
    name,
    startTime: start,
    endTime: end,
    daysOfWeek: SCHOOL_DAYS,
    isBreak,
  });
  return [
    mk("Period 1", "08:30", "09:25"),
    mk("Period 2", "09:25", "10:20"),
    mk("Break", "10:20", "10:40", true),
    mk("Period 3", "10:40", "11:35"),
    mk("Period 4", "11:35", "12:30"),
    mk("Lunch", "12:30", "13:30", true),
    mk("Period 5", "13:30", "14:25"),
    mk("Period 6", "14:25", "15:20"),
  ];
}

export default function ClassModeScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const schedule = useAppSelector((st) => st.classSchedule);
  const now = useNow(30_000);
  const [schoolName, setSchoolName] = useState(schedule?.schoolName ?? "My school");
  const [periods, setPeriods] = useState<TimetablePeriod[]>(schedule?.periods ?? defaultPeriods());

  const status = useMemo(
    () =>
      evaluateClassMode(
        { schoolName, enabled: Boolean(schedule?.enabled), periods, strictDelayMinutes: schedule?.strictDelayMinutes ?? 10 },
        now,
      ),
    [schoolName, periods, schedule?.enabled, schedule?.strictDelayMinutes, now],
  );

  function save(enabled: boolean) {
    setClassSchedule({ schoolName, enabled, periods, strictDelayMinutes: schedule?.strictDelayMinutes ?? 10 });
  }

  function removePeriod(id: string) {
    const next = periods.filter((p) => p.id !== id);
    setPeriods(next);
    if (schedule?.enabled) setClassSchedule({ schoolName, enabled: true, periods: next, strictDelayMinutes: schedule.strictDelayMinutes });
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Txt variant="title2" accessibilityRole="header">
          Class Mode
        </Txt>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="callout" tone="muted" style={{ marginBottom: 16 }}>
          Fenced raises the shield automatically during class periods, and lowers it during breaks — no manual arming needed on school days.
        </Txt>

        <FenceCard style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="headline">{schedule?.enabled ? "Class Mode is on" : "Class Mode is off"}</Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {status.inClass
                  ? `In class: ${status.activePeriod?.name ?? ""} — shield is up`
                  : status.nextPeriod
                  ? `Next: ${status.nextPeriod.name} at ${status.nextPeriod.startTime}`
                  : "No class right now"}
              </Txt>
            </View>
            {schedule?.enabled && status.inClass && <Badge label="Shielded" tone="accent" />}
          </View>
          <Button
            label={schedule?.enabled ? "Turn off Class Mode" : "Turn on Class Mode"}
            kind={schedule?.enabled ? "secondary" : "primary"}
            icon={schedule?.enabled ? "pause-circle-outline" : "school-outline"}
            onPress={() => {
              if (schedule?.enabled) {
                clearClassSchedule();
              } else {
                save(true);
              }
            }}
            style={{ marginTop: 12 }}
          />
        </FenceCard>

        <SectionHeader title="School" />
        <FenceCard style={{ marginBottom: 16 }}>
          <TextInput
            value={schoolName}
            onChangeText={(v) => {
              setSchoolName(v);
            }}
            onBlur={() => schedule?.enabled && save(true)}
            placeholder="School name"
            placeholderTextColor={t.textMuted}
            style={s.input}
            accessibilityLabel="School name"
          />
        </FenceCard>

        <SectionHeader title="Timetable" />
        <FenceCard style={{ paddingVertical: 4, marginBottom: 16 }}>
          {periods.map((p, i) => (
            <View key={p.id} style={[s.row, i === periods.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={p.isBreak ? "cafe-outline" : "book-outline"} size={18} color={p.isBreak ? t.info : t.accent} />
              <View style={{ flex: 1 }}>
                <Txt variant="body" numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt variant="caption" tone="muted" numeric>
                  {p.startTime}–{p.endTime} · {DAY_LABELS[p.daysOfWeek[0] ?? 1]}–{DAY_LABELS[p.daysOfWeek[p.daysOfWeek.length - 1] ?? 5]}
                  {p.isBreak ? " · break" : ""}
                </Txt>
              </View>
              <IconButton icon="close" label={`Remove ${p.name}`} size={18} color={t.textMuted} onPress={() => removePeriod(p.id)} />
            </View>
          ))}
        </FenceCard>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <Chip
            label="Add period"
            icon="add"
            onPress={() => {
              const next = [...periods, { id: localId("period"), name: `Period ${periods.length + 1}`, startTime: "09:00", endTime: "10:00", daysOfWeek: SCHOOL_DAYS, isBreak: false }];
              setPeriods(next);
              if (schedule?.enabled) setClassSchedule({ schoolName, enabled: true, periods: next, strictDelayMinutes: schedule.strictDelayMinutes });
            }}
          />
          <Chip
            label="Add break"
            icon="cafe-outline"
            tone="timber"
            onPress={() => {
              const next = [...periods, { id: localId("period"), name: "Break", startTime: "10:00", endTime: "10:15", daysOfWeek: SCHOOL_DAYS, isBreak: true }];
              setPeriods(next);
              if (schedule?.enabled) setClassSchedule({ schoolName, enabled: true, periods: next, strictDelayMinutes: schedule.strictDelayMinutes });
            }}
          />
        </View>

        <Txt variant="caption" tone="muted">
          Class Mode uses the same shield as a focus session — a speed bump, not a lock. Breaks and weekends are never fenced by this schedule.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
    scroll: { padding: 20, paddingBottom: 48 },
    input: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: t.borderStrong,
      color: t.text,
      fontSize: 16,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomWidth: 1, borderColor: t.borderSubtle },
  });
