import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "@fenced/ui";
import { EventSheet, type EventDraft } from "../../src/components/calendar/EventSheet";
import { AnimatedPressable, IconButton, SegmentedControl, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useNow } from "../../src/hooks/use-now";
import { layoutDay, monthMatrix } from "../../src/lib/calendar-grid";
import { getFencedHoursForToday, parseHour, type LocalCalendarEvent } from "../../src/lib/local-store";
import { dateKey } from "../../src/lib/stats";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

type ViewMode = "day" | "week" | "month";

const HOUR_H = 56;
const GUTTER = 52;
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }));

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function CalendarScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const [mode, setMode] = useState<ViewMode>("day");
  const [selected, setSelected] = useState(() => new Date());
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const events = useAppSelector((st) => st.calendarEvents);
  const tasks = useAppSelector((st) => st.tasks);
  const fencedHours = useAppSelector((st) => st.fencedHours);
  const now = useNow(60_000, mode === "day");
  const scroll = useRef<ScrollView>(null);

  const isToday = sameDay(selected, now);
  const dayEvents = useMemo(() => events.filter((e) => sameDay(new Date(e.startAt), selected) && !e.allDay), [events, selected]);
  const allDay = useMemo(() => events.filter((e) => sameDay(new Date(e.startAt), selected) && e.allDay), [events, selected]);
  const due = useMemo(() => tasks.filter((x) => !x.completed && x.dueAt && sameDay(new Date(x.dueAt), selected)), [tasks, selected]);
  const placed = useMemo(
    () => layoutDay(dayEvents.map((e) => ({ id: e.id, start: new Date(e.startAt), end: new Date(e.endAt), event: e })), selected),
    [dayEvents, selected],
  );
  const fenced = useMemo(() => getFencedHoursForToday(selected), [fencedHours, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the day view around "now" (or 8am on other days).
  useEffect(() => {
    if (mode !== "day") return;
    const h = isToday ? Math.max(0, now.getHours() - 1) : 8;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: h * HOUR_H, animated: false }));
  }, [mode, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (dir: 1 | -1) => {
    const next = new Date(selected);
    if (mode === "day") next.setDate(next.getDate() + dir);
    else if (mode === "week") next.setDate(next.getDate() + 7 * dir);
    else next.setMonth(next.getMonth() + dir, 1);
    setSelected(next);
  };

  const createAt = (hour: number, minute = 0) => {
    const d = new Date(selected);
    d.setHours(hour, minute, 0, 0);
    setDraft({ mode: "create", start: d });
  };

  const title =
    mode === "month"
      ? selected.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : selected.toLocaleDateString(undefined, { weekday: mode === "day" ? "long" : undefined, month: "long", day: "numeric" });

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Txt variant="title1" accessibilityRole="header">
            Calendar
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {!isToday && (
              <AnimatedPressable onPress={() => setSelected(new Date())} style={s.todayChip} accessibilityLabel="Go to today">
                <Txt variant="caption" tone="accent">
                  Today
                </Txt>
              </AnimatedPressable>
            )}
            <IconButton
              icon="add"
              label="New event or focus block"
              onPress={() => {
                const d = new Date(selected);
                d.setHours(isToday ? now.getHours() + 1 : 9, 0, 0, 0);
                setDraft({ mode: "create", start: d });
              }}
              color={t.accent}
            />
          </View>
        </View>
        <View style={s.navRow}>
          <IconButton icon="chevron-back" label="Previous" onPress={() => step(-1)} color={t.textMuted} />
          <Txt variant="headline" style={{ flex: 1, textAlign: "center" }}>
            {title}
          </Txt>
          <IconButton icon="chevron-forward" label="Next" onPress={() => step(1)} color={t.textMuted} />
        </View>
        <SegmentedControl
          accessibilityLabel="Calendar view"
          value={mode}
          onChange={setMode}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </View>

      {mode === "day" && (
        <>
          {(allDay.length > 0 || due.length > 0) && (
            <View style={s.strip}>
              {allDay.map((e) => (
                <AnimatedPressable key={e.id} onPress={() => setDraft({ mode: "edit", event: e })} style={s.stripItem}>
                  <Txt variant="caption" numberOfLines={1}>
                    {e.title}
                  </Txt>
                </AnimatedPressable>
              ))}
              {due.map((x) => (
                <AnimatedPressable key={x.id} onPress={() => router.push(`/task/${x.id}`)} style={[s.stripItem, { backgroundColor: t.accentSoft }]}>
                  <Ionicons name="checkbox-outline" size={12} color={t.onAccentSoft} />
                  <Txt variant="caption" numberOfLines={1} style={{ color: t.onAccentSoft }}>
                    {x.title}
                  </Txt>
                </AnimatedPressable>
              ))}
            </View>
          )}
          <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 140 }}>
            <View style={{ height: 24 * HOUR_H }}>
              {Array.from({ length: 24 }, (_, h) => (
                <Pressable
                  key={h}
                  onPress={() => createAt(h)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add at ${fmtTime(new Date(2000, 0, 1, h))}`}
                  style={[s.hourRow, { top: h * HOUR_H }]}
                >
                  <Txt variant="micro" tone="muted" numeric style={s.hourLabel}>
                    {h === 0 ? "" : fmtTime(new Date(2000, 0, 1, h))}
                  </Txt>
                  <View style={s.hourLine} />
                </Pressable>
              ))}

              {fenced.map((f) => {
                const top = (parseHour(f.startTime) / 60) * HOUR_H;
                const height = Math.max(HOUR_H / 2, ((parseHour(f.endTime) - parseHour(f.startTime)) / 60) * HOUR_H);
                return (
                  <View key={f.id} pointerEvents="none" style={[s.fenced, { top, height }]}>
                    <Ionicons name="shield-outline" size={11} color={t.accent} />
                    <Txt variant="micro" tone="accent" numberOfLines={1}>
                      {f.label}
                    </Txt>
                  </View>
                );
              })}

              {placed.map((p) => {
                const e = p.item.event;
                const block = e.source === "time-block";
                const provider = e.source === "google";
                const width = `${(100 / p.columns) * 0.98}%` as const;
                return (
                  <View
                    key={e.id}
                    style={{ position: "absolute", top: (p.top / 60) * HOUR_H, height: (p.height / 60) * HOUR_H - 2, left: GUTTER, right: 8 }}
                    pointerEvents="box-none"
                  >
                    <AnimatedPressable
                      onPress={() => setDraft({ mode: "edit", event: e })}
                      accessibilityLabel={`${e.title}, ${fmtTime(new Date(e.startAt))} to ${fmtTime(new Date(e.endAt))}${block ? ", focus block" : ""}`}
                      pressScale={0.98}
                      style={[
                        s.event,
                        { width, marginLeft: `${(100 / p.columns) * p.column}%` },
                        block && { backgroundColor: t.accentSoft, borderLeftColor: t.accentAlt },
                        provider && { backgroundColor: t.infoSoft, borderLeftColor: t.info },
                      ]}
                    >
                      <Txt variant="caption" numberOfLines={1} weight="600" style={{ color: block ? t.onAccentSoft : t.text }}>
                        {e.title}
                      </Txt>
                      {p.height >= 40 && (
                        <Txt variant="micro" tone="muted" numeric numberOfLines={1}>
                          {fmtTime(new Date(e.startAt))} – {fmtTime(new Date(e.endAt))}
                        </Txt>
                      )}
                    </AnimatedPressable>
                  </View>
                );
              })}

              {isToday && (
                <View
                  pointerEvents="none"
                  accessibilityLabel={`Now, ${fmtTime(now)}`}
                  style={[s.nowLine, { top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H }]}
                >
                  <View style={[s.nowDot, { backgroundColor: t.error }]} />
                  <View style={{ flex: 1, height: 2, backgroundColor: t.error }} />
                </View>
              )}
            </View>
          </ScrollView>
        </>
      )}

      {mode === "week" && <WeekView selected={selected} onSelect={setSelected} events={events} onOpen={(e) => setDraft({ mode: "edit", event: e })} />}

      {mode === "month" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
          <View style={s.monthHeader}>
            {WEEKDAYS.map((d, i) => (
              <Txt key={i} variant="micro" tone="muted" align="center" style={{ flex: 1 }}>
                {d}
              </Txt>
            ))}
          </View>
          <View style={s.monthGrid}>
            {monthMatrix(selected).map(({ date, inMonth }) => {
              const key = dateKey(date);
              const hasDue = tasks.some((x) => !x.completed && x.dueAt && dateKey(new Date(x.dueAt)) === key);
              const hasEvent = events.some((e) => dateKey(new Date(e.startAt)) === key);
              const isSel = sameDay(date, selected);
              const isNow = sameDay(date, now);
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setSelected(date);
                    setMode("day");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${hasEvent ? ", has events" : ""}${hasDue ? ", tasks due" : ""}`}
                  style={[s.monthCell, isSel && { backgroundColor: t.primary }]}
                >
                  <Txt
                    variant="callout"
                    numeric
                    weight={isNow ? "700" : "400"}
                    style={{ color: isSel ? t.onPrimary : !inMonth ? t.textMuted : isNow ? t.accent : t.text, opacity: inMonth ? 1 : 0.45 }}
                  >
                    {date.getDate()}
                  </Txt>
                  <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
                    {hasEvent && <View style={[s.dot, { backgroundColor: isSel ? t.onPrimary : t.info }]} />}
                    {hasDue && <View style={[s.dot, { backgroundColor: isSel ? t.onPrimary : t.accentAlt }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <EventSheet draft={draft} onClose={() => setDraft(null)} />
    </SafeAreaView>
  );
}

function WeekView({
  selected,
  onSelect,
  events,
  onOpen,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  events: LocalCalendarEvent[];
  onOpen: (e: LocalCalendarEvent) => void;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const start = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
      {days.map((d) => {
        const list = events.filter((e) => sameDay(new Date(e.startAt), d));
        const isSel = sameDay(d, selected);
        return (
          <View key={dateKey(d)} style={s.weekRow}>
            <Pressable onPress={() => onSelect(d)} style={[s.weekDay, isSel && { backgroundColor: t.primary }]} accessibilityRole="button">
              <Txt variant="micro" style={{ color: isSel ? t.onPrimary : t.textMuted }}>
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </Txt>
              <Txt variant="headline" numeric style={{ color: isSel ? t.onPrimary : t.text }}>
                {d.getDate()}
              </Txt>
            </Pressable>
            <View style={{ flex: 1, gap: 6, paddingVertical: 4 }}>
              {list.length === 0 ? (
                <Txt variant="caption" tone="muted" style={{ paddingTop: 10 }}>
                  —
                </Txt>
              ) : (
                list.map((e) => (
                  <AnimatedPressable key={e.id} onPress={() => onOpen(e)} style={[s.weekEvent, e.source === "time-block" && { borderLeftColor: t.accentAlt }]}>
                    <Txt variant="caption" numberOfLines={1} weight="600">
                      {e.title}
                    </Txt>
                    <Txt variant="micro" tone="muted" numeric>
                      {fmtTime(new Date(e.startAt))}
                    </Txt>
                  </AnimatedPressable>
                ))
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 6 },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    navRow: { flexDirection: "row", alignItems: "center" },
    todayChip: { minHeight: 32, paddingHorizontal: 12, justifyContent: "center", borderRadius: radii.pill, backgroundColor: t.accentTint },
    strip: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
    stripItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "48%",
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      backgroundColor: t.infoSoft,
    },
    hourRow: { position: "absolute", left: 0, right: 0, height: HOUR_H, flexDirection: "row" },
    hourLabel: { width: GUTTER - 6, textAlign: "right", marginTop: -7, paddingRight: 6 },
    hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.border },
    fenced: {
      position: "absolute",
      left: GUTTER - 4,
      width: 4,
      borderRadius: 2,
      backgroundColor: t.pineGlow,
      flexDirection: "column",
      overflow: "visible",
    },
    event: {
      flex: 1,
      borderRadius: radii.sm,
      backgroundColor: t.surface,
      borderLeftWidth: 3,
      borderLeftColor: t.accent,
      paddingHorizontal: 8,
      paddingVertical: 4,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.cardBorder,
    },
    nowLine: { position: "absolute", left: GUTTER - 5, right: 0, flexDirection: "row", alignItems: "center", height: 10, marginTop: -5 },
    nowDot: { width: 10, height: 10, borderRadius: 5 },
    monthHeader: { flexDirection: "row", paddingVertical: 8 },
    monthGrid: { flexDirection: "row", flexWrap: "wrap" },
    monthCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.md, gap: 3 },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
    weekRow: { flexDirection: "row", gap: 12, minHeight: 56, borderBottomWidth: 1, borderColor: t.borderSubtle, paddingVertical: 6 },
    weekDay: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.md, paddingVertical: 6 },
    weekEvent: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.sm,
      backgroundColor: t.surface,
      borderLeftWidth: 3,
      borderLeftColor: t.accent,
    },
  });
