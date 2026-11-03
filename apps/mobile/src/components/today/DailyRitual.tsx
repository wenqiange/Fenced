import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import {
  addCalendarEvents,
  getDayPlan,
  getFencedHoursForToday,
  groupTasks,
  toggleFencedHour,
  updateDayPlan,
  updateTask,
  type LocalTask,
} from "../../lib/local-store";
import { dateKey } from "../../lib/stats";
import { formatBlockRange, proposeBlocksForDay } from "../../lib/time-block";
import { hapticLatchClose, hapticSelection } from "../../lib/haptics";
import { playSfx } from "../../lib/sound-engine";
import { useThemeColors } from "../../lib/theme";
import { AnimatedPressable, BottomSheetModal, Button, FenceCard, SectionHeader, Txt } from "../ui";

const MAX_KEYSTONES = 3;

function atHour(base: Date, dayOffset: number, hour = 9): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Keeps the task's time of day when moving it to another day. */
function moveTo(task: LocalTask, dayOffset: number) {
  const now = new Date();
  const prev = task.dueAt ? new Date(task.dueAt) : null;
  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(prev?.getHours() ?? 9, prev?.getMinutes() ?? 0, 0, 0);
  updateTask(task.id, { dueAt: target.toISOString() });
}

export type RitualKind = "morning" | "evening";

/** Which ritual (if any) the Today screen should offer right now. */
export function useRitualPrompt(now = new Date()): RitualKind | null {
  const plan = useAppSelector((s) => (s.dayPlan?.date === dateKey(now) ? s.dayPlan : null));
  const h = now.getHours();
  if (h >= 18 && !plan?.eveningDoneAt) return "evening";
  if (h >= 4 && h < 14 && !plan?.morningDoneAt) return "morning";
  return null;
}

export function RitualCard({ kind, onOpen }: { kind: RitualKind; onOpen: () => void }) {
  const t = useThemeColors();
  const morning = kind === "morning";
  return (
    <FenceCard onPress={onOpen} tone="tint" accessibilityLabel={morning ? "Plan and arm today" : "Evening unlatch"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={morning ? "sunny-outline" : "moon-outline"} size={20} color={t.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="headline">{morning ? "Plan & arm today" : "Evening unlatch"}</Txt>
          <Txt variant="caption" tone="muted">
            {morning ? "Carry over, pick 3 keystones, block the time. About a minute." : "See what got built, move what's left, close the day."}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
      </View>
    </FenceCard>
  );
}

export function MorningRitualSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useThemeColors();
  const tasks = useAppSelector((s) => s.tasks);
  const [step, setStep] = useState(0);
  const [keystones, setKeystones] = useState<string[]>(() => getDayPlan().keystoneTaskIds);
  const fencedToday = useAppSelector(() => getFencedHoursForToday());
  const allHours = useAppSelector((s) => s.fencedHours);

  const sections = useMemo(() => groupTasks(tasks), [tasks]);
  const carryOver = sections.find((s) => s.id === "overdue")?.tasks ?? [];
  const candidates = useMemo(
    () => sections.filter((s) => s.id !== "later").flatMap((s) => s.tasks).slice(0, 20),
    [sections],
  );
  const proposal = useMemo(
    () => (step === 2 && keystones.length > 0 ? proposeBlocksForDay(new Date(), { taskIds: keystones }) : null),
    [step, keystones],
  );

  const toggleKeystone = (id: string) => {
    hapticSelection();
    setKeystones((k) => (k.includes(id) ? k.filter((x) => x !== id) : k.length >= MAX_KEYSTONES ? k : [...k, id]));
  };

  const finish = (applyBlocks: boolean) => {
    if (applyBlocks && proposal) {
      addCalendarEvents(
        proposal.blocks.map((b) => ({
          title: b.split ? `${b.title} (${b.partIndex}/${b.partCount})` : b.title,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          linkedTaskId: b.taskId,
          source: "time-block" as const,
          notes: "Morning fence: keystone block",
        })),
      );
    }
    // Keystones without a date land on today so they show up in the agenda.
    for (const id of keystones) {
      const task = tasks.find((x) => x.id === id);
      if (task && !task.dueAt) updateTask(id, { dueAt: atHour(new Date(), 0, 17) });
    }
    updateDayPlan({ keystoneTaskIds: keystones, morningDoneAt: new Date().toISOString() });
    void hapticLatchClose();
    void playSfx("latch");
    setStep(0);
    onClose();
  };

  const titles = ["Carry over", "Keystones", "Arm the day"];

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={`${step + 1}/3 · ${titles[step]}`}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        {step === 0 && (
          <>
            <Txt variant="callout" tone="muted" style={{ marginTop: 4 }}>
              {carryOver.length === 0 ? "Nothing overdue. Clean slate." : "These slipped. Give each one a day — no guilt, just a decision."}
            </Txt>
            {carryOver.map((task) => (
              <View key={task.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: t.borderSubtle }}>
                <Txt variant="body" numberOfLines={1}>
                  {task.title}
                </Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {[
                    { label: "Today", fn: () => moveTo(task, 0) },
                    { label: "Tomorrow", fn: () => moveTo(task, 1) },
                    { label: "Someday", fn: () => updateTask(task.id, { dueAt: null }) },
                  ].map((a) => (
                    <AnimatedPressable
                      key={a.label}
                      onPress={a.fn}
                      haptic="selection"
                      accessibilityLabel={`Move ${task.title} to ${a.label}`}
                      style={{ minHeight: 36, paddingHorizontal: 12, justifyContent: "center", borderRadius: radii.pill, backgroundColor: t.track }}
                    >
                      <Txt variant="caption">{a.label}</Txt>
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            ))}
            <Button label="Next" onPress={() => setStep(1)} style={{ marginTop: 16 }} />
          </>
        )}

        {step === 1 && (
          <>
            <Txt variant="callout" tone="muted" style={{ marginTop: 4 }}>
              Pick up to three. If only these get done, today was a good day.
            </Txt>
            {candidates.map((task) => {
              const on = keystones.includes(task.id);
              return (
                <AnimatedPressable
                  key={task.id}
                  onPress={() => toggleKeystone(task.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: !on && keystones.length >= MAX_KEYSTONES }}
                  accessibilityLabel={task.title}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderColor: t.borderSubtle }}
                >
                  <Ionicons name={on ? "diamond" : "diamond-outline"} size={18} color={on ? t.accentAlt : t.borderStrong} />
                  <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {task.title}
                  </Txt>
                  {task.estimateMinutes != null && (
                    <Txt variant="caption" tone="muted" numeric>
                      {task.estimateMinutes}m
                    </Txt>
                  )}
                </AnimatedPressable>
              );
            })}
            {candidates.length === 0 && (
              <Txt variant="callout" tone="muted" style={{ marginTop: 12 }}>
                No open tasks yet — add some in Tasks, or skip ahead.
              </Txt>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button label="Back" kind="secondary" onPress={() => setStep(0)} style={{ flex: 1 }} />
              <Button label={`Next · ${keystones.length}/3`} onPress={() => setStep(2)} style={{ flex: 2 }} />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <SectionHeader title="Proposed focus blocks" style={{ marginTop: 8 }} />
            {!proposal || proposal.blocks.length === 0 ? (
              <Txt variant="callout" tone="muted">
                {keystones.length === 0
                  ? "No keystones picked, so nothing to block."
                  : "No free gap fits today. Your keystones are still pinned to today."}
              </Txt>
            ) : (
              proposal.blocks.map((b) => (
                <View key={b.id} style={{ flexDirection: "row", gap: 10, alignItems: "center", minHeight: 44 }}>
                  <Txt variant="caption" tone="accent" numeric style={{ width: 110 }}>
                    {formatBlockRange(b)}
                  </Txt>
                  <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {b.title}
                  </Txt>
                </View>
              ))
            )}
            {allHours.length > 0 && (
              <>
                <SectionHeader title="Fenced Hours today" />
                {allHours
                  .filter((h) => h.daysOfWeek.includes(new Date().getDay()))
                  .map((h) => {
                    const on = fencedToday.some((f) => f.id === h.id);
                    return (
                      <AnimatedPressable
                        key={h.id}
                        onPress={() => toggleFencedHour(h.id)}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${h.label} ${h.startTime} to ${h.endTime}`}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}
                      >
                        <Ionicons name={on ? "shield-checkmark" : "shield-outline"} size={18} color={on ? t.success : t.textMuted} />
                        <Txt variant="body" style={{ flex: 1 }}>
                          {h.label}
                        </Txt>
                        <Txt variant="caption" tone="muted" numeric>
                          {h.startTime}–{h.endTime}
                        </Txt>
                      </AnimatedPressable>
                    );
                  })}
              </>
            )}
            <Button
              label={proposal && proposal.blocks.length > 0 ? "Apply blocks & arm the day" : "Arm the day"}
              icon="lock-closed-outline"
              onPress={() => finish(true)}
              style={{ marginTop: 20 }}
            />
            <Button label="Back" kind="ghost" onPress={() => setStep(1)} />
          </>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

export function EveningRitualSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useThemeColors();
  const tasks = useAppSelector((s) => s.tasks);
  const history = useAppSelector((s) => s.sessionHistory);
  const keystones = useAppSelector((s) => (s.dayPlan?.date === dateKey(new Date()) ? s.dayPlan.keystoneTaskIds : []));
  const today = dateKey(new Date());

  const done = history.filter((h) => h.status === "completed" && dateKey(new Date(h.completedAt)) === today);
  const minutes = done.reduce((s, h) => s + h.durationMinutes, 0);
  const completedTasks = tasks.filter((x) => x.completedAt && dateKey(new Date(x.completedAt)) === today);
  const leftovers = tasks.filter(
    (x) => !x.completed && (keystones.includes(x.id) || (x.dueAt && new Date(x.dueAt) <= new Date())),
  );

  const unlatch = () => {
    updateDayPlan({ eveningDoneAt: new Date().toISOString() });
    void playSfx("release");
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Evening unlatch">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          {[
            { v: String(done.length), l: done.length === 1 ? "Panel built" : "Panels built" },
            { v: `${minutes}m`, l: "Focused" },
            { v: String(completedTasks.length), l: "Tasks done" },
          ].map((s) => (
            <View key={s.l} style={{ flex: 1, alignItems: "center" }}>
              <Txt variant="title2" numeric>
                {s.v}
              </Txt>
              <Txt variant="caption" tone="muted">
                {s.l}
              </Txt>
            </View>
          ))}
        </View>

        {leftovers.length > 0 && (
          <>
            <SectionHeader title="Still open" />
            {leftovers.map((x) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                <Ionicons name={keystones.includes(x.id) ? "diamond-outline" : "ellipse-outline"} size={14} color={t.textMuted} />
                <Txt variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {x.title}
                </Txt>
              </View>
            ))}
            <Button
              label="Move all to tomorrow"
              kind="secondary"
              icon="arrow-forward"
              onPress={() => leftovers.forEach((x) => moveTo(x, 1))}
              style={{ marginTop: 12 }}
            />
          </>
        )}
        <Txt variant="callout" tone="muted" align="center" style={{ marginTop: 20 }}>
          {done.length > 0 ? "The fence held today. Leave it there." : "A quiet day still counts as a day. Tomorrow's panel is waiting."}
        </Txt>
        <Button label="Unlatch the day" icon="moon-outline" onPress={unlatch} style={{ marginTop: 12 }} />
      </ScrollView>
    </BottomSheetModal>
  );
}
