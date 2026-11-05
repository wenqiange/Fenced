import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Priority } from "@fenced/core";
import { calculateLoadScore, planDeadlineGravity } from "@fenced/core";
import { describeRrule } from "@fenced/nlp";
import { HIT_TARGET, radii } from "@fenced/ui";
import { AnimatedPressable, Button, Chip, IconButton, ProgressBar, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { hapticTaskCheck } from "../../src/lib/haptics";
import { localId } from "../../src/lib/ids";
import { addProject, deleteTask, toggleTask, updateTask, addCalendarEvents, type LocalTask } from "../../src/lib/local-store";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];
const ESTIMATES = [15, 30, 45, 60, 90, 120];
const TIMES: [number, number][] = [
  [9, 0],
  [13, 0],
  [17, 0],
  [20, 0],
];

function dayFrom(base: Date | null, offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(base?.getHours() ?? 17, base?.getMinutes() ?? 0, 0, 0);
  return d;
}

function nextMonday(base: Date | null): Date {
  const d = dayFrom(base, 0);
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return d;
}

/** Every task that (transitively) waits on `id` — picking one as a blocker would make a cycle. */
export function dependentsOf(id: string, tasks: readonly LocalTask[]): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const x of tasks) {
      if (x.blockedByTaskIds.includes(cur) && !out.has(x.id)) {
        out.add(x.id);
        stack.push(x.id);
      }
    }
  }
  return out;
}

export default function TaskDetailScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasks = useAppSelector((st) => st.tasks);
  const projects = useAppSelector((st) => st.projects);
  const events = useAppSelector((st) => st.calendarEvents);
  const task = tasks.find((x) => x.id === id);

  const loadInfo = useMemo(() => {
    if (!task) return null;
    return calculateLoadScore({
      priority: task.priority,
      estimateMinutes: task.estimateMinutes,
      checklistLength: task.checklist.length,
      tags: task.tags,
      blockedByCount: task.blockedByTaskIds.length,
    });
  }, [task?.priority, task?.estimateMinutes, task?.checklist.length, task?.tags, task?.blockedByTaskIds.length]);

  function handlePlanDeadlineGravity() {
    if (!task || !task.dueAt || !task.estimateMinutes) {
      Alert.alert("Missing Details", "Task needs both a due date and an estimated duration to plan with Deadline Gravity.");
      return;
    }

    const dueAtDate = new Date(task.dueAt);
    const now = new Date();
    if (dueAtDate.getTime() <= now.getTime()) {
      Alert.alert("Invalid Deadline", "Deadline must be in the future to schedule focus blocks.");
      return;
    }

    const sortedEvents = [...events]
      .filter((e) => new Date(e.endAt).getTime() > now.getTime() && new Date(e.startAt).getTime() < dueAtDate.getTime())
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const freeGaps: { startAt: Date; endAt: Date }[] = [];
    let cursor = new Date(now.getTime() + 5 * 60_000);

    for (const ev of sortedEvents) {
      const evStart = new Date(ev.startAt);
      const evEnd = new Date(ev.endAt);
      if (evStart.getTime() > cursor.getTime()) {
        freeGaps.push({ startAt: new Date(cursor), endAt: new Date(evStart) });
      }
      if (evEnd.getTime() > cursor.getTime()) {
        cursor = new Date(evEnd);
      }
    }
    if (cursor.getTime() < dueAtDate.getTime()) {
      freeGaps.push({ startAt: new Date(cursor), endAt: new Date(dueAtDate) });
    }

    const placements = planDeadlineGravity({
      taskDueAt: dueAtDate,
      estimateMinutes: task.estimateMinutes,
      now,
      freeGaps,
      maxBlockMinutes: 60,
      minBlockMinutes: 25,
    });

    if (placements.length === 0) {
      Alert.alert("No Fitting Gaps", "Could not find open calendar gaps before the deadline. Free up calendar time first.");
      return;
    }

    addCalendarEvents(
      placements.map((p, idx) => ({
        title: `${task.title} (Focus block ${idx + 1}/${placements.length})`,
        notes: `Planned via Deadline Gravity (pull: ${(p.gravitationalPull * 100).toFixed(0)}%)`,
        startAt: p.startAt.toISOString(),
        endAt: p.endAt.toISOString(),
        allDay: false,
        linkedTaskId: task.id,
        source: "time-block" as const,
      }))
    );

    Alert.alert(
      "Deadline Gravity Planned",
      `Scheduled ${placements.length} preparation focus block(s) leading up to your deadline.`
    );
  }

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const [itemDraft, setItemDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [customEstimate, setCustomEstimate] = useState("");

  const blockerCandidates = useMemo(() => {
    if (!task) return [];
    const cyclic = dependentsOf(task.id, tasks);
    return tasks.filter((x) => x.id !== task.id && !x.completed && !cyclic.has(x.id));
  }, [tasks, task]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/tasks"));

  if (!task) {
    return (
      <SafeAreaView style={[s.container, { alignItems: "center", justifyContent: "center", gap: 12 }]}>
        <Txt variant="headline">This task is gone</Txt>
        <Button label="Go back" kind="secondary" onPress={close} />
      </SafeAreaView>
    );
  }

  const due = task.dueAt ? new Date(task.dueAt) : null;
  const patch = (p: Parameters<typeof updateTask>[1]) => updateTask(task.id, p);
  const saveText = () => {
    const nextTitle = title.trim() || task.title;
    if (nextTitle !== task.title || notes !== task.notes) patch({ title: nextTitle, notes });
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase();
    if (tag && !task.tags.includes(tag)) patch({ tags: [...task.tags, tag] });
    setTagDraft("");
  };

  const addItem = () => {
    const text = itemDraft.trim();
    if (!text) return;
    patch({ checklist: [...task.checklist, { id: localId("chk"), title: text, done: false }] });
    setItemDraft("");
  };

  const doneCount = task.checklist.filter((c) => c.done).length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-down" label="Close" onPress={() => { saveText(); close(); }} color={t.textMuted} />
        <Txt variant="headline">Task</Txt>
        <IconButton
          icon="trash-outline"
          label="Delete task"
          color={t.error}
          onPress={() =>
            Alert.alert("Delete this task?", "It's removed from every device.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { deleteTask(task.id); close(); } },
            ])
          }
        />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
            <AnimatedPressable
              onPress={() => { hapticTaskCheck(); toggleTask(task.id); }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.completed }}
              accessibilityLabel={task.completed ? "Reopen task" : "Complete task"}
              style={s.hit}
              pressScale={0.85}
            >
              <Ionicons name={task.completed ? "checkmark-circle" : "ellipse-outline"} size={28} color={task.completed ? t.success : t.borderStrong} />
            </AnimatedPressable>
            <TextInput
              style={s.titleInput}
              value={title}
              onChangeText={setTitle}
              onBlur={saveText}
              placeholder="Title"
              placeholderTextColor={t.textMuted}
              multiline
              accessibilityLabel="Task title"
            />
          </View>
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            onBlur={saveText}
            placeholder="Notes"
            placeholderTextColor={t.textMuted}
            multiline
            accessibilityLabel="Notes"
          />

          {loadInfo && (
            <View style={{ marginVertical: 8, padding: 12, borderRadius: 12, backgroundColor: t.accentSoft, borderWidth: 1, borderColor: t.borderSubtle }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="headline">Fence Recommendation</Txt>
                <Txt variant="callout" numeric tone="accent" style={{ fontWeight: "700" }}>
                  {loadInfo.score}/100 Load
                </Txt>
              </View>
              <Txt variant="caption" tone="accent" style={{ fontWeight: "700", marginTop: 2, textTransform: "uppercase" }}>
                {loadInfo.recommendation} Fence · {loadInfo.suggestedFocusMinutes}m session ({loadInfo.suggestedStrictDelayMinutes}m shield)
              </Txt>
              <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {loadInfo.reason}
              </Txt>
            </View>
          )}

          <SectionHeader title="Priority" />
          <View style={s.chips}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={p === "none" ? "None" : p[0].toUpperCase() + p.slice(1)}
                selected={task.priority === p}
                tone={p === "urgent" || p === "high" ? "breach" : "accent"}
                onPress={() => patch({ priority: p })}
              />
            ))}
          </View>

          <SectionHeader title="Due" />
          <Txt variant="headline" numeric style={{ marginBottom: 8 }}>
            {due ? due.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No date"}
          </Txt>
          <View style={s.chips}>
            <Chip label="Today" onPress={() => patch({ dueAt: dayFrom(due, 0).toISOString() })} />
            <Chip label="Tomorrow" onPress={() => patch({ dueAt: dayFrom(due, 1).toISOString() })} />
            <Chip label="Next Monday" onPress={() => patch({ dueAt: nextMonday(due).toISOString() })} />
            {due && <Chip label="Clear" icon="close" onPress={() => patch({ dueAt: null })} />}
          </View>
          {due && (
            <View style={[s.chips, { alignItems: "center" }]}>
              <IconButton icon="remove-circle-outline" label="One day earlier" onPress={() => { const d = new Date(due); d.setDate(d.getDate() - 1); patch({ dueAt: d.toISOString() }); }} color={t.accent} />
              <IconButton icon="add-circle-outline" label="One day later" onPress={() => { const d = new Date(due); d.setDate(d.getDate() + 1); patch({ dueAt: d.toISOString() }); }} color={t.accent} />
              {TIMES.map(([h, m]) => {
                const d = new Date(due);
                d.setHours(h, m, 0, 0);
                return (
                  <Chip
                    key={h}
                    label={d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    selected={due.getHours() === h && due.getMinutes() === m}
                    onPress={() => patch({ dueAt: d.toISOString() })}
                  />
                );
              })}
            </View>
          )}
          {describeRrule(task.rrule) && (
            <View style={[s.chips, { alignItems: "center" }]}>
              <Ionicons name="repeat" size={16} color={t.accent} />
              <Txt variant="callout" tone="accent">
                Repeats {describeRrule(task.rrule)!.toLowerCase()}
              </Txt>
              <Chip label="Stop repeating" onPress={() => patch({ rrule: null })} />
            </View>
          )}

          {due && task.estimateMinutes && (
            <View style={{ marginTop: 8 }}>
              <Button
                label="Plan with Deadline Gravity"
                kind="secondary"
                icon="magnet-outline"
                onPress={handlePlanDeadlineGravity}
              />
            </View>
          )}

          <SectionHeader title="Estimate" />
          <View style={s.chips}>
            {ESTIMATES.map((m) => (
              <Chip key={m} label={m < 60 ? `${m}m` : `${m / 60}h`} selected={task.estimateMinutes === m} onPress={() => patch({ estimateMinutes: task.estimateMinutes === m ? null : m })} />
            ))}
            <TextInput
              value={customEstimate}
              onChangeText={(v) => setCustomEstimate(v.replace(/[^0-9]/g, ""))}
              onSubmitEditing={() => {
                const n = Number(customEstimate);
                if (n > 0 && n <= 24 * 60) patch({ estimateMinutes: n });
                setCustomEstimate("");
              }}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="custom"
              placeholderTextColor={t.textMuted}
              accessibilityLabel="Custom estimate in minutes"
              style={s.smallInput}
            />
          </View>

          <SectionHeader title={`Checklist${task.checklist.length ? ` · ${doneCount}/${task.checklist.length}` : ""}`} />
          {task.checklist.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <ProgressBar value={doneCount / task.checklist.length} />
            </View>
          )}
          {task.checklist.map((c) => (
            <View key={c.id} style={s.checkRow}>
              <AnimatedPressable
                onPress={() => {
                  hapticTaskCheck();
                  patch({ checklist: task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) });
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: c.done }}
                accessibilityLabel={c.title}
                style={s.hit}
                pressScale={0.85}
              >
                <Ionicons name={c.done ? "checkbox" : "square-outline"} size={22} color={c.done ? t.success : t.borderStrong} />
              </AnimatedPressable>
              <Txt variant="body" tone={c.done ? "muted" : "default"} style={[{ flex: 1 }, c.done && { textDecorationLine: "line-through" }]}>
                {c.title}
              </Txt>
              <IconButton icon="close" label={`Remove ${c.title}`} size={18} color={t.textMuted} onPress={() => patch({ checklist: task.checklist.filter((x) => x.id !== c.id) })} />
            </View>
          ))}
          <TextInput
            value={itemDraft}
            onChangeText={setItemDraft}
            onSubmitEditing={addItem}
            blurOnSubmit={false}
            returnKeyType="next"
            placeholder="+ Add a step"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Add a checklist step"
            style={s.lineInput}
          />

          <SectionHeader title="Tags" />
          <View style={s.chips}>
            {task.tags.map((tag) => (
              <Chip key={tag} label={`#${tag}`} icon="close" tone="timber" selected onPress={() => patch({ tags: task.tags.filter((x) => x !== tag) })} accessibilityHint="Removes the tag" />
            ))}
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={addTag}
              returnKeyType="done"
              placeholder="#add"
              placeholderTextColor={t.textMuted}
              autoCapitalize="none"
              accessibilityLabel="Add a tag"
              style={s.smallInput}
            />
          </View>

          <SectionHeader title="Project" />
          <View style={s.chips}>
            <Chip label="None" selected={!task.projectId} onPress={() => patch({ projectId: null })} />
            {projects.map((p) => (
              <Chip key={p.id} label={p.name} icon="folder-outline" selected={task.projectId === p.id} onPress={() => patch({ projectId: p.id })} />
            ))}
            <TextInput
              value={projectDraft}
              onChangeText={setProjectDraft}
              onSubmitEditing={() => {
                const name = projectDraft.trim();
                if (name) patch({ projectId: addProject(name).id });
                setProjectDraft("");
              }}
              returnKeyType="done"
              placeholder="+ New project"
              placeholderTextColor={t.textMuted}
              accessibilityLabel="Create a project"
              style={[s.smallInput, { minWidth: 120 }]}
            />
          </View>

          {blockerCandidates.length > 0 && (
            <>
              <SectionHeader title="Waits on" />
              <Txt variant="caption" tone="muted" style={{ marginBottom: 8 }}>
                Auto-schedule holds this task until these are done.
              </Txt>
              <View style={s.chips}>
                {blockerCandidates.slice(0, 30).map((c) => {
                  const on = task.blockedByTaskIds.includes(c.id);
                  return (
                    <Chip
                      key={c.id}
                      label={c.title.length > 28 ? `${c.title.slice(0, 27)}…` : c.title}
                      icon={on ? "git-merge" : undefined}
                      selected={on}
                      onPress={() =>
                        patch({
                          blockedByTaskIds: on ? task.blockedByTaskIds.filter((b) => b !== c.id) : [...task.blockedByTaskIds, c.id],
                        })
                      }
                    />
                  );
                })}
              </View>
            </>
          )}

          {!task.completed && (
            <Button
              label="Fence time for this task"
              icon="shield-outline"
              onPress={() => {
                saveText();
                router.push({ pathname: "/session-sheet", params: { linkedTaskId: task.id } });
              }}
              style={{ marginTop: 28 }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
    scroll: { paddingHorizontal: 20, paddingBottom: 48 },
    hit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
    titleInput: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "600", color: t.text, paddingTop: 8 },
    notesInput: {
      marginTop: 8,
      minHeight: 72,
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.cardBorder,
      color: t.text,
      fontSize: 16,
      textAlignVertical: "top",
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    smallInput: {
      minHeight: 36,
      minWidth: 80,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.borderStrong,
      color: t.text,
    },
    checkRow: { flexDirection: "row", alignItems: "center", minHeight: HIT_TARGET },
    lineInput: { minHeight: HIT_TARGET, color: t.text, fontSize: 16, paddingLeft: 12 },
  });
