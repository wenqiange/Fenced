import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { calculateLoadScore, computeYardProgression } from "@fenced/core";
import { radii } from "@fenced/ui";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { FenceLineStreakBanner } from "../../src/components/fence";
import { AppTutorialModal } from "../../src/components/tutorial";
import {
  EveningRitualSheet,
  MorningRitualSheet,
  RitualCard,
  useRitualPrompt,
} from "../../src/components/today/DailyRitual";
import { AnimatedPressable, FenceCard, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useProgress } from "../../src/hooks/use-progress";
import { hapticTaskCheck } from "../../src/lib/haptics";
import {
  formatFocusHours,
  getFencedHoursForToday,
  pickNextUpTask,
  toggleTask,
  type LocalTask,
} from "../../src/lib/local-store";
import { getDefaultSessionMinutes, INTENT_DEFAULTS } from "../../src/lib/onboarding-state";
import { dateKey } from "../../src/lib/stats";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

function greeting(h: number): string {
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

type AgendaItem =
  | { kind: "task"; at: string | null; task: LocalTask }
  | { kind: "event"; at: string; id: string; title: string; endAt: string; block: boolean };

export default function TodayScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const { onboarding } = useOnboarding();
  const tasks = useAppSelector((st) => st.tasks);
  const events = useAppSelector((st) => st.calendarEvents);
  const lastPreset = useAppSelector((st) => st.lastPreset);
  const plan = useAppSelector((st) => st.dayPlan);
  const fencedHours = useAppSelector((st) => st.fencedHours);
  const history = useAppSelector((st) => st.sessionHistory);
  const progress = useProgress();

  const now = new Date();
  const today = dateKey(now);

  const yard = useMemo(() => computeYardProgression(history || []), [history]);

  const todayLoad = useMemo(() => {
    const todayTasks = tasks.filter((x) => !x.completed && (x.dueAt ? dateKey(new Date(x.dueAt)) === today : true));
    if (todayTasks.length === 0) return null;
    const prioOrder = { urgent: 5, high: 4, medium: 3, low: 2, none: 1 };
    let highestPrio: LocalTask["priority"] = "none";
    let totalMins = 0;
    let totalChecks = 0;
    let totalBlocked = 0;
    const allTags: string[] = [];

    for (const taskItem of todayTasks) {
      if ((prioOrder[taskItem.priority] || 1) > (prioOrder[highestPrio] || 1)) {
        highestPrio = taskItem.priority;
      }
      totalMins += taskItem.estimateMinutes || 30;
      totalChecks += taskItem.checklist?.length || 0;
      totalBlocked += taskItem.blockedByTaskIds?.length || 0;
      allTags.push(...(taskItem.tags || []));
    }

    return calculateLoadScore({
      priority: highestPrio,
      estimateMinutes: totalMins,
      checklistLength: totalChecks,
      blockedByCount: totalBlocked,
      tags: allTags,
    });
  }, [tasks, today]);
  const ritual = useRitualPrompt();
  const hasSeenTutorial = useAppSelector((st) => st.settings.hasSeenTutorial);
  const [sheet, setSheet] = useState<"morning" | "evening" | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);

  useEffect(() => {
    if (!hasSeenTutorial && (onboarding.completed || onboarding.intent)) {
      setTutorialVisible(true);
    }
  }, [hasSeenTutorial, onboarding.completed, onboarding.intent]);

  const keystoneIds = plan?.date === today ? plan.keystoneTaskIds : [];
  const keystones = keystoneIds.map((id) => tasks.find((x) => x.id === id)).filter((x): x is LocalTask => !!x);
  const nextUp = pickNextUpTask(tasks.filter((x) => !keystoneIds.includes(x.id)));
  const fencedToday = useMemo(() => getFencedHoursForToday(), [fencedHours]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = lastPreset?.durationMinutes ?? getDefaultSessionMinutes();
  const presetName = lastPreset?.label ?? (onboarding.intent ? INTENT_DEFAULTS[onboarding.intent].label : "Focus");

  const agenda = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [];
    for (const task of tasks) {
      if (task.completed && !(task.completedAt && dateKey(new Date(task.completedAt)) === today)) continue;
      if (task.dueAt && dateKey(new Date(task.dueAt)) === today) items.push({ kind: "task", at: task.dueAt, task });
    }
    for (const e of events) {
      if (dateKey(new Date(e.startAt)) !== today) continue;
      items.push({ kind: "event", at: e.startAt, id: e.id, title: e.title, endAt: e.endAt, block: e.source === "time-block" });
    }
    return items.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  }, [tasks, events, today]);

  const check = (id: string) => {
    hapticTaskCheck();
    toggleTask(id);
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="caption" tone="muted">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Txt>
        <Txt variant="title1" accessibilityRole="header" style={{ marginBottom: 16 }}>
          {greeting(now.getHours())}
          {onboarding.displayName && onboarding.displayName !== "You" ? `, ${onboarding.displayName.split(" ")[0]}` : ""}
        </Txt>

        <FenceCard style={{ marginBottom: 12 }}>
          <FenceLineStreakBanner days={21} />
        </FenceCard>

        {todayLoad && (
          <FenceCard style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Txt variant="headline">Today's Focus Load</Txt>
              <Txt variant="callout" numeric tone="accent" style={{ fontWeight: "700" }}>
                {todayLoad.score}/100
              </Txt>
            </View>
            <Txt variant="caption" tone="muted">
              Recommended Fence: <Txt variant="caption" tone="accent" style={{ fontWeight: "700" }}>{todayLoad.recommendation.toUpperCase()}</Txt> · {todayLoad.suggestedFocusMinutes}m blocks ({todayLoad.suggestedStrictDelayMinutes}m shield)
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {todayLoad.reason}
            </Txt>
            {todayLoad.score >= 80 && (
              <View style={{ marginTop: 8, padding: 8, borderRadius: radii.sm, backgroundColor: t.surfaceAlt, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="shield-half-outline" size={16} color={t.accent} />
                <Txt variant="caption" tone="accent" style={{ flex: 1, fontWeight: "600" }}>
                  Burnout Defense: High load detected. Rest is part of the work — non-urgent tasks can wait.
                </Txt>
              </View>
            )}
          </FenceCard>
        )}

        {!onboarding.completed && (
          <FenceCard tone="tint" onPress={() => router.push("/(onboarding)")} style={{ marginBottom: 12 }}>
            <Txt variant="headline">Try your first 5-minute session</Txt>
            <Txt variant="callout" tone="muted">
              Finish setup and watch your first panel go up.
            </Txt>
          </FenceCard>
        )}

        {onboarding.completed && ritual && (
          <Animated.View entering={FadeInDown.duration(250)} style={{ marginBottom: 12 }}>
            <RitualCard kind={ritual} onOpen={() => setSheet(ritual)} />
          </Animated.View>
        )}

        {/* Primary action: start a session. */}
        <AnimatedPressable
          onPress={() => router.push("/session-sheet")}
          accessibilityLabel={`Start a session. ${presetName}, ${duration} minutes`}
          haptic="selection"
          style={s.startCard}
          pressScale={0.98}
        >
          <View style={s.startIcon}>
            <Ionicons name="shield" size={22} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="title2" tone="onPrimary">
              Start a session
            </Txt>
            <Txt variant="callout" numeric style={{ color: t.onPrimaryMuted }}>
              {presetName} · {duration} min
            </Txt>
          </View>
          <Ionicons name="arrow-forward" size={22} color={t.onPrimary} />
        </AnimatedPressable>

        {keystones.length > 0 && (
          <>
            <SectionHeader title="Keystones" />
            <FenceCard style={{ paddingVertical: 4 }}>
              {keystones.map((k, i) => (
                <TaskLine key={k.id} task={k} onCheck={() => check(k.id)} keystone last={i === keystones.length - 1} />
              ))}
            </FenceCard>
          </>
        )}

        {nextUp && keystones.length === 0 && (
          <>
            <SectionHeader title="Next up" />
            <FenceCard style={{ paddingVertical: 4 }}>
              <TaskLine task={nextUp} onCheck={() => check(nextUp.id)} last />
            </FenceCard>
          </>
        )}

        {fencedToday.length > 0 && (
          <>
            <SectionHeader title="Fenced Hours today" action="Manage" onAction={() => router.push("/fence-hub")} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {fencedToday.map((h) => (
                <View key={h.id} style={s.hourPill}>
                  <Ionicons name="time-outline" size={14} color={t.accent} />
                  <Txt variant="caption" numeric>
                    {h.label} · {h.startTime}–{h.endTime}
                  </Txt>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionHeader title="Today's agenda" action="Calendar" onAction={() => router.push("/(tabs)/calendar")} />
        <FenceCard style={{ paddingVertical: 4 }}>
          {agenda.length === 0 ? (
            <View style={{ paddingVertical: 16 }}>
              <Txt variant="callout" tone="muted">
                Nothing on the books for today. Add a task with a date, or plan the day above.
              </Txt>
            </View>
          ) : (
            agenda.map((item, i) =>
              item.kind === "task" ? (
                <TaskLine key={item.task.id} task={item.task} onCheck={() => check(item.task.id)} showTime last={i === agenda.length - 1} />
              ) : (
                <Animated.View key={item.id} layout={LinearTransition} style={[s.line, i === agenda.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.eventBar, { backgroundColor: item.block ? t.accentAlt : t.info }]} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" numberOfLines={1}>
                      {item.title}
                    </Txt>
                    <Txt variant="caption" tone="muted" numeric>
                      {timeOf(item.at)}–{timeOf(item.endAt)}
                      {item.block ? " · focus block" : ""}
                    </Txt>
                  </View>
                </Animated.View>
              ),
            )
          )}
        </FenceCard>

        <SectionHeader title="The Yard" />
        <FenceCard style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="leaf-outline" size={24} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="headline" style={{ textTransform: "capitalize" }}>
                {yard.tier.replace(/_/g, " ")}
              </Txt>
              <Txt variant="caption" tone="muted" numeric>
                {yard.totalPicketsPlanted} pickets planted · {yard.fencesCompleted} fences completed
              </Txt>
            </View>
            <Txt variant="caption" tone="accent" numeric style={{ fontWeight: "700" }}>
              {yard.durabilityScore}% durability
            </Txt>
          </View>
        </FenceCard>

        <SectionHeader title="This week" />
        <FenceCard onPress={() => router.push("/profile/insights")} accessibilityLabel="Open insights">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="title2" numeric>
                {formatFocusHours(progress.weekFocusMinutes)}
              </Txt>
              <Txt variant="caption" tone="muted" numeric>
                focused across {progress.weekSessions} session{progress.weekSessions === 1 ? "" : "s"}
              </Txt>
            </View>
            <Txt variant="caption" tone="accent">
              Insights
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={t.accent} />
          </View>
        </FenceCard>
      </ScrollView>

      <MorningRitualSheet visible={sheet === "morning"} onClose={() => setSheet(null)} />
      <EveningRitualSheet visible={sheet === "evening"} onClose={() => setSheet(null)} />
      <AppTutorialModal visible={tutorialVisible} onClose={() => setTutorialVisible(false)} />
    </SafeAreaView>
  );
}

function TaskLine({
  task,
  onCheck,
  keystone,
  showTime,
  last,
}: {
  task: LocalTask;
  onCheck: () => void;
  keystone?: boolean;
  showTime?: boolean;
  last?: boolean;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  return (
    <Animated.View layout={LinearTransition} style={[s.line, last && { borderBottomWidth: 0 }]}>
      <AnimatedPressable
        onPress={onCheck}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={`Complete ${task.title}`}
        style={s.check}
        pressScale={0.85}
      >
        <Ionicons
          name={task.completed ? "checkmark-circle" : keystone ? "diamond-outline" : "ellipse-outline"}
          size={22}
          color={task.completed ? t.success : keystone ? t.accentAlt : t.borderStrong}
        />
      </AnimatedPressable>
      <AnimatedPressable onPress={() => router.push(`/task/${task.id}`)} style={{ flex: 1, minHeight: 44, justifyContent: "center" }} pressScale={1}>
        <Txt variant="body" numberOfLines={1} tone={task.completed ? "muted" : "default"} style={task.completed && { textDecorationLine: "line-through" }}>
          {task.title}
        </Txt>
        {showTime && task.dueAt && (
          <Txt variant="caption" tone="muted" numeric>
            {timeOf(task.dueAt)}
          </Txt>
        )}
      </AnimatedPressable>
      {!task.completed && (
        <AnimatedPressable
          onPress={() => router.push({ pathname: "/session-sheet", params: { linkedTaskId: task.id } })}
          accessibilityLabel={`Start a focus session on ${task.title}`}
          haptic="selection"
          style={s.check}
        >
          <Ionicons name="play-circle-outline" size={24} color={t.accent} />
        </AnimatedPressable>
      )}
    </Animated.View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 20, paddingBottom: 140 },
    startCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      borderRadius: 16,
      backgroundColor: t.primary,
      marginBottom: 4,
    },
    startIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.onPrimary, alignItems: "center", justifyContent: "center" },
    line: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 52, borderBottomWidth: 1, borderColor: t.borderSubtle },
    check: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    eventBar: { width: 4, alignSelf: "stretch", borderRadius: 2, marginVertical: 10, marginHorizontal: 20 },
    hourPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      minHeight: 34,
      borderRadius: 999,
      backgroundColor: t.accentTint,
    },
  });
