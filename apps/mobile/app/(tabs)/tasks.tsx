import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { describeRrule, parseTaskInput, type ParsedTask } from "@fenced/nlp";
import type { AiParsedTask } from "@fenced/ai/client";
import { useAppState } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { canUseLlmUi } from "../../src/lib/ai-access";
import { groupTasks, toggleTask } from "../../src/lib/local-store";
import { createLocalTaskWithSync } from "../../src/lib/sync/tasks";
import { PINE, PAPER, INK, SLATE, TIMBER, SAND } from "../../src/lib/theme";

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
    recurrence: ai.recurrence
      ? {
          ...ai.recurrence,
          until: ai.recurrence.until ? new Date(ai.recurrence.until) : null,
        }
      : null,
    ambiguities: ai.ambiguities,
    isAmbiguous: ai.isAmbiguous,
  };
}

export default function TasksScreen() {
  const { state } = useAppState();
  const auth = useAuth();
  const api = useApi();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [aiPreview, setAiPreview] = useState<ParsedTask | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const llmOk = canUseLlmUi("llm-parsing");

  useEffect(() => {
    setAiPreview(null);
    setAiError(null);
  }, [input]);

  const localPreview = useMemo(() => {
    if (!input.trim()) return null;
    return parseTaskInput(input.trim());
  }, [input]);

  const preview = aiPreview ?? localPreview;
  const fromAi = aiPreview != null;

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return state.tasks;
    const q = search.toLowerCase().trim();
    return state.tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [state.tasks, search]);

  const sections = useMemo(
    () =>
      groupTasks(filteredTasks).map((s) => ({
        title: s.title,
        data: s.tasks,
      })),
    [filteredTasks]
  );

  function submitTask() {
    if (!input.trim()) return;
    const parsed = preview ?? parseTaskInput(input.trim());
    createLocalTaskWithSync(api, auth.isSignedIn, {
      title: parsed.title || input.trim(),
      priority: parsed.priority,
      tags: parsed.tags,
      dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
      estimateMinutes: parsed.estimateMinutes,
      rrule: parsed.rrule,
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
        ambiguities: local.ambiguities.map((a) => ({
          kind: a.kind,
          text: a.text,
        })),
      });
      setAiPreview(aiToParsedTask(result));
    } catch {
      setAiError("AI unavailable — use the local options or try again online.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Tasks</Text>
          <Pressable
            style={styles.planChip}
            onPress={() => router.push("/time-block")}
          >
            <Ionicons name="calendar-outline" size={16} color={PINE} />
            <Text style={styles.planChipText}>Schedule</Text>
          </Pressable>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={SLATE} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks or #tags..."
            placeholderTextColor={SLATE}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No tasks yet. Try &quot;essay tomorrow 3pm #uni !high 45m&quot;
            </Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={styles.taskRow}
            onPress={() => router.push(`/task/${item.id}`)}
          >
            <Pressable
              onPress={() => toggleTask(item.id)}
              hitSlop={8}
            >
              <Ionicons
                name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={item.completed ? PINE : SLATE}
              />
            </Pressable>
            <View style={styles.taskBody}>
              <Text
                style={[
                  styles.taskTitle,
                  item.completed && styles.taskCompleted,
                ]}
              >
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                {item.dueAt && (
                  <Text style={styles.meta}>
                    {new Date(item.dueAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
                {item.estimateMinutes != null && (
                  <Text style={styles.meta}>{item.estimateMinutes}m</Text>
                )}
                {describeRrule(item.rrule) && (
                  <Text style={styles.repeat}>↻ {describeRrule(item.rrule)}</Text>
                )}
                {item.priority !== "none" && (
                  <Text style={styles.meta}>{item.priority}</Text>
                )}
                {item.tags.map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    #{tag}
                  </Text>
                ))}
              </View>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.quickAdd}>
        {preview && input.trim().length > 0 && (
          <View style={[styles.preview, fromAi && styles.previewAi]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{preview.title || "Task"}</Text>
              {fromAi && <Text style={styles.aiBadge}>AI draft</Text>}
            </View>
            <View style={styles.chipRow}>
              {preview.dueAt && (
                <Text style={styles.chip}>
                  {preview.dueAt.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              )}
              {describeRrule(preview.rrule) && (
                <Text style={styles.chip}>↻ {describeRrule(preview.rrule)}</Text>
              )}
              {preview.estimateMinutes != null && (
                <Text style={styles.chip}>{preview.estimateMinutes}m</Text>
              )}
              {preview.priority !== "none" && (
                <Text style={styles.chip}>{preview.priority}</Text>
              )}
              {preview.tags.map((t) => (
                <Text key={t} style={styles.chip}>
                  #{t}
                </Text>
              ))}
            </View>
            {!fromAi &&
              preview.ambiguities.map((a) => (
                <View key={`${a.kind}-${a.text}`} style={styles.clarify}>
                  <Text style={styles.clarifyText}>{a.message}</Text>
                  {a.options && (
                    <View style={styles.chipRow}>
                      {a.options.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => setInput(applyClarification(input, a.text, option))}
                        >
                          <Text style={styles.clarifyOption}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            {!fromAi && preview.isAmbiguous && llmOk && (
              <Pressable
                style={[styles.askAi, aiLoading && styles.askAiDisabled]}
                onPress={() => void askAi()}
                disabled={aiLoading || !auth.isSignedIn}
              >
                <Text style={styles.askAiText}>
                  {aiLoading
                    ? "Asking AI…"
                    : auth.isSignedIn
                      ? "Ask AI — review before adding"
                      : "Sign in to use AI suggestions"}
                </Text>
              </Pressable>
            )}
            {aiError && <Text style={styles.aiError}>{aiError}</Text>}
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a task — try 'essay tomorrow 3pm #uni !high 45m'"
            placeholderTextColor={SLATE}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submitTask}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
            onPress={submitTask}
            disabled={!input.trim()}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: "700", color: INK },
  planChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: SAND,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  planChipText: { fontSize: 13, fontWeight: "600", color: PINE },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: INK },
  list: { paddingHorizontal: 20, paddingBottom: 160 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: SLATE,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 16, color: INK },
  taskCompleted: { textDecorationLine: "line-through", color: SLATE },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  meta: { fontSize: 12, color: SLATE, fontWeight: "500" },
  repeat: { fontSize: 12, color: PINE, fontWeight: "600" },
  tag: { fontSize: 12, color: TIMBER, fontWeight: "600" },
  quickAdd: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderTopColor: "#E0DCD6",
    padding: 12,
    paddingBottom: 36,
  },
  preview: {
    backgroundColor: SAND,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  previewAi: {
    borderWidth: 1,
    borderColor: PINE,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  previewTitle: { fontSize: 14, fontWeight: "600", color: INK, flex: 1 },
  aiBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: PINE,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  askAi: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0DCD6",
    paddingTop: 8,
  },
  askAiDisabled: { opacity: 0.5 },
  askAiText: { fontSize: 12, fontWeight: "700", color: PINE },
  aiError: { fontSize: 12, color: "#B3402E", marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    fontSize: 12,
    fontWeight: "600",
    color: PINE,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clarify: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#E0DCD6", paddingTop: 8 },
  clarifyText: { fontSize: 12, color: SLATE, lineHeight: 17 },
  clarifyOption: {
    fontSize: 12,
    fontWeight: "600",
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: INK,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PINE,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: { opacity: 0.4 },
});
