import { memo, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, SectionList, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { describeRrule, parseTaskInput, type ParsedTask } from "@fenced/nlp";
import type { AiParsedTask } from "@fenced/ai/client";
import { HIT_TARGET, radii } from "@fenced/ui";
import { AnimatedPressable, Badge, Chip, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { canUseLlmUi } from "../../src/lib/ai-access";
import { hapticTaskCheck } from "../../src/lib/haptics";
import { addTask, deleteTask, groupTasks, toggleTask, type LocalTask } from "../../src/lib/local-store";
import { getNlpDateLocale } from "../../src/lib/locale";
import { dateKey } from "../../src/lib/stats";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

/** Rewrites the raw input so the chosen reading is the only one left, e.g. "at 9" -> "at 9pm". */
function applyClarification(input: string, ambiguous: string, option: string): string {
  const time = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(option);
  if (!time) return input;
  return input.replace(ambiguous, `at ${time[1]}${time[3].toLowerCase()}`);
}

function aiToParsedTask(ai: AiParsedTask): ParsedTask {
  return {
    title: ai.title,
    dueAt: ai.dueAt ? new Date(ai.dueAt) : null,
    estimateMinutes: ai.estimateMinutes,
    priority: ai.priority,
    tags: ai.tags,
    rrule: ai.rrule,
    recurrence: ai.recurrence ? { ...ai.recurrence, until: ai.recurrence.until ? new Date(ai.recurrence.until) : null } : null,
    ambiguities: ai.ambiguities,
    isAmbiguous: ai.isAmbiguous,
  };
}

type Filter = "all" | "today" | "high" | "estimate" | "done";

const FILTERS: { id: Filter; label: string; icon?: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today", icon: "today-outline" },
  { id: "high", label: "!High / Urgent", icon: "flag-outline" },
  { id: "estimate", label: "With estimate", icon: "timer-outline" },
  { id: "done", label: "Done", icon: "checkmark-done-outline" },
];

const fmtDue = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TasksScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const tasks = useAppSelector((st) => st.tasks);
  const projects = useAppSelector((st) => st.projects);
  const auth = useAuth();
  const api = useApi();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<ParsedTask | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const llmOk = canUseLlmUi("llm-parsing");

  useEffect(() => {
    setAiPreview(null);
    setAiError(null);
  }, [input]);

  const localPreview = useMemo(
    () => (input.trim() ? parseTaskInput(input.trim(), undefined, getNlpDateLocale()) : null),
    [input],
  );
  const preview = aiPreview ?? localPreview;
  const fromAi = aiPreview != null;

  const allTags = useMemo(() => [...new Set(tasks.flatMap((x) => x.tags))].sort().slice(0, 12), [tasks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const today = dateKey(new Date());
    return tasks.filter((x) => {
      if (q && !x.title.toLowerCase().includes(q) && !x.tags.some((tg) => tg.toLowerCase().includes(q))) return false;
      if (tag && !x.tags.includes(tag)) return false;
      if (projectId && x.projectId !== projectId) return false;
      switch (filter) {
        case "today":
          return !!x.dueAt && dateKey(new Date(x.dueAt)) <= today;
        case "high":
          return x.priority === "high" || x.priority === "urgent";
        case "estimate":
          return x.estimateMinutes != null;
        default:
          return true;
      }
    });
  }, [tasks, search, filter, tag, projectId]);

  const sections = useMemo(() => {
    if (filter === "done") {
      const done = filtered
        .filter((x) => x.completed)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
        .slice(0, 100);
      return done.length ? [{ title: "Done", data: done }] : [];
    }
    return groupTasks(filtered).map((sec) => ({ title: sec.title, data: sec.tasks }));
  }, [filtered, filter]);

  function submitTask() {
    const text = input.trim();
    if (!text) return;
    const parsed = preview ?? parseTaskInput(text, undefined, getNlpDateLocale());
    hapticTaskCheck();
    addTask({
      title: parsed.title || text,
      priority: parsed.priority,
      tags: parsed.tags,
      dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
      estimateMinutes: parsed.estimateMinutes,
      rrule: parsed.rrule,
      projectId,
    });
    setInput("");
    setAiPreview(null);
  }

  async function askAi() {
    if (!input.trim() || !llmOk || !auth.isSignedIn) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const local = parseTaskInput(input.trim());
      const result = await api.ai.parseTask.mutate({
        rawText: input.trim(),
        referenceDate: new Date().toISOString(),
        ambiguities: local.ambiguities.map((a) => ({ kind: a.kind, text: a.text })),
      });
      setAiPreview(aiToParsedTask(result));
    } catch {
      setAiError("AI unavailable — use the local options or try again online.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
        <View style={s.header}>
          <View style={s.headerTop}>
            <Txt variant="title1" accessibilityRole="header">
              Tasks
            </Txt>
            <AnimatedPressable onPress={() => router.push("/time-block")} style={s.planChip} accessibilityLabel="Auto-schedule tasks" haptic="selection">
              <Ionicons name="calendar-outline" size={16} color={t.accent} />
              <Txt variant="caption" tone="accent">
                Schedule
              </Txt>
            </AnimatedPressable>
          </View>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color={t.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search tasks or #tags"
              placeholderTextColor={t.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              accessibilityLabel="Search tasks"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} icon={f.icon} selected={filter === f.id} onPress={() => setFilter(f.id)} />
            ))}
            {projects.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                icon="folder-outline"
                tone="timber"
                selected={projectId === p.id}
                onPress={() => setProjectId(projectId === p.id ? null : p.id)}
              />
            ))}
            {allTags.map((tg) => (
              <Chip key={tg} label={`#${tg}`} tone="timber" selected={tag === tg} onPress={() => setTag(tag === tg ? null : tg)} />
            ))}
          </ScrollView>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="leaf-outline" size={28} color={t.textMuted} />
              <Txt variant="callout" tone="muted" align="center">
                {tasks.length === 0
                  ? 'No tasks yet. Try "essay tomorrow 3pm #uni !high 45m"'
                  : "Nothing matches these filters."}
              </Txt>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Txt variant="label" tone={section.title === "Overdue" ? "breach" : "muted"} style={s.sectionHeader}>
              {section.title} · {section.data.length}
            </Txt>
          )}
          renderItem={({ item }) => <TaskRow task={item} projectName={projects.find((p) => p.id === item.projectId)?.name} />}
        />

        <View style={s.quickAdd}>
          {preview && input.trim().length > 0 && (
            <Animated.View entering={FadeIn.duration(150)} style={[s.preview, fromAi && s.previewAi]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt variant="headline" style={{ flex: 1 }} numberOfLines={1}>
                  {preview.title || "Task"}
                </Txt>
                {fromAi && <Badge label="AI draft" tone="info" />}
              </View>
              <View style={s.metaRow}>
                {preview.dueAt && <Meta icon="calendar-outline" text={fmtDue(preview.dueAt.toISOString())} />}
                {describeRrule(preview.rrule) && <Meta icon="repeat" text={describeRrule(preview.rrule)!} />}
                {preview.estimateMinutes != null && <Meta icon="timer-outline" text={`${preview.estimateMinutes}m`} />}
                {preview.priority !== "none" && <Meta icon="flag-outline" text={preview.priority} />}
                {preview.tags.map((tg) => (
                  <Meta key={tg} text={`#${tg}`} />
                ))}
              </View>
              {!fromAi &&
                preview.ambiguities.map((a) => (
                  <View key={`${a.kind}-${a.text}`} style={{ marginTop: 8 }}>
                    <Txt variant="caption" tone="breach">
                      {a.message}
                    </Txt>
                    {a.options && (
                      <View style={[s.metaRow, { marginTop: 6 }]}>
                        {a.options.map((option) => (
                          <Chip key={option} label={option} onPress={() => setInput(applyClarification(input, a.text, option))} />
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              {!fromAi && preview.isAmbiguous && llmOk && (
                <AnimatedPressable onPress={() => void askAi()} disabled={aiLoading || !auth.isSignedIn} style={s.askAi}>
                  <Txt variant="caption" tone="accent">
                    {aiLoading ? "Asking AI…" : auth.isSignedIn ? "Ask AI — review before adding" : "Sign in to use AI suggestions"}
                  </Txt>
                </AnimatedPressable>
              )}
              {aiError && (
                <Txt variant="caption" tone="error" style={{ marginTop: 6 }}>
                  {aiError}
                </Txt>
              )}
            </Animated.View>
          )}
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Add a task — 'essay tomorrow 3pm #uni !high 45m'"
              placeholderTextColor={t.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submitTask}
              returnKeyType="done"
              accessibilityLabel="Add a task. Natural language is understood."
            />
            <AnimatedPressable
              onPress={submitTask}
              disabled={!input.trim()}
              accessibilityLabel="Add task"
              haptic="soft"
              style={s.addButton}
            >
              <Ionicons name="add" size={24} color={t.onPrimary} />
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon?: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      {icon && <Ionicons name={icon} size={12} color={t.textMuted} />}
      <Txt variant="caption" tone="muted" numeric>
        {text}
      </Txt>
    </View>
  );
}

const PRIORITY_TONE: Record<string, "breach" | "timber" | "muted"> = { urgent: "breach", high: "breach", medium: "timber", low: "muted" };

const TaskRow = memo(function TaskRow({ task, projectName }: { task: LocalTask; projectName?: string }) {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const doneItems = task.checklist.filter((c) => c.done).length;

  const renderDelete = () => (
    <AnimatedPressable
      onPress={() => deleteTask(task.id)}
      accessibilityLabel={`Delete ${task.title}`}
      style={s.deleteAction}
    >
      <Ionicons name="trash-outline" size={20} color={t.onPrimary} />
      <Txt variant="caption" tone="onPrimary">
        Delete
      </Txt>
    </AnimatedPressable>
  );

  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <Swipeable renderRightActions={renderDelete} overshootRight={false} friction={2}>
        <View
          style={s.taskRow}
          accessibilityActions={[{ name: "delete", label: "Delete task" }, { name: "focus", label: "Start focus session" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "delete") deleteTask(task.id);
            if (e.nativeEvent.actionName === "focus") router.push({ pathname: "/session-sheet", params: { linkedTaskId: task.id } });
          }}
        >
          <AnimatedPressable
            onPress={() => {
              hapticTaskCheck();
              toggleTask(task.id);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.completed }}
            accessibilityLabel={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
            style={s.iconHit}
            pressScale={0.85}
          >
            <Ionicons name={task.completed ? "checkmark-circle" : "ellipse-outline"} size={24} color={task.completed ? t.success : t.borderStrong} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push(`/task/${task.id}`)} style={{ flex: 1, paddingVertical: 10 }} pressScale={1}>
            <Txt variant="body" tone={task.completed ? "muted" : "default"} style={task.completed && { textDecorationLine: "line-through" }} numberOfLines={2}>
              {task.title}
            </Txt>
            <View style={s.metaRow}>
              {task.priority !== "none" && (
                <Txt variant="caption" tone={PRIORITY_TONE[task.priority]}>
                  {task.priority === "urgent" ? "!!" : task.priority === "high" ? "!" : ""}
                  {task.priority}
                </Txt>
              )}
              {task.dueAt && <Meta icon="calendar-outline" text={fmtDue(task.dueAt)} />}
              {task.estimateMinutes != null && <Meta icon="timer-outline" text={`${task.estimateMinutes}m`} />}
              {describeRrule(task.rrule) && <Meta icon="repeat" text={describeRrule(task.rrule)!} />}
              {task.checklist.length > 0 && <Meta icon="list-outline" text={`${doneItems}/${task.checklist.length}`} />}
              {task.blockedByTaskIds.length > 0 && <Meta icon="git-merge-outline" text="blocked" />}
              {projectName && <Meta icon="folder-outline" text={projectName} />}
              {task.tags.map((tg) => (
                <Txt key={tg} variant="caption" tone="timber">
                  #{tg}
                </Txt>
              ))}
            </View>
          </AnimatedPressable>
          {!task.completed && (
            <AnimatedPressable
              onPress={() => router.push({ pathname: "/session-sheet", params: { linkedTaskId: task.id } })}
              accessibilityLabel={`Focus on ${task.title}`}
              haptic="selection"
              style={s.iconHit}
            >
              <Ionicons name="shield-half-outline" size={22} color={t.accent} />
            </AnimatedPressable>
          )}
        </View>
      </Swipeable>
    </Animated.View>
  );
});

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingTop: 12, paddingBottom: 4 },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 20 },
    planChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: t.accentTint,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 20,
      paddingHorizontal: 12,
      minHeight: HIT_TARGET,
      borderRadius: radii.md,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.cardBorder,
    },
    searchInput: { flex: 1, color: t.text, fontSize: 16, minHeight: HIT_TARGET },
    filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
    list: { paddingHorizontal: 20, paddingBottom: 24 },
    sectionHeader: { marginTop: 16, marginBottom: 6 },
    taskRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.bg,
      borderBottomWidth: 1,
      borderColor: t.borderSubtle,
      minHeight: 56,
    },
    iconHit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 3 },
    deleteAction: { width: 88, backgroundColor: t.error, alignItems: "center", justifyContent: "center", gap: 2 },
    empty: { alignItems: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
    quickAdd: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderColor: t.borderSubtle, backgroundColor: t.bg },
    preview: { padding: 12, borderRadius: radii.md, backgroundColor: t.surface, borderWidth: 1, borderColor: t.cardBorder, marginBottom: 8 },
    previewAi: { borderColor: t.info },
    askAi: { marginTop: 10, minHeight: 36, justifyContent: "center" },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.borderStrong,
      color: t.text,
      fontSize: 16,
    },
    addButton: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: t.primary, alignItems: "center", justifyContent: "center" },
  });
