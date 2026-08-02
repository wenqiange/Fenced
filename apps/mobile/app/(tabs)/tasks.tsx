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
import { useMemo, useState } from "react";
import { parseTaskInput } from "@fenced/nlp";
import { useAppState } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { groupTasks, toggleTask } from "../../src/lib/local-store";
import { createLocalTaskWithSync } from "../../src/lib/sync/tasks";
import { PINE, PAPER, INK, SLATE, TIMBER, SAND } from "../../src/lib/theme";

export default function TasksScreen() {
  const { state } = useAppState();
  const auth = useAuth();
  const api = useApi();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const preview = useMemo(() => {
    if (!input.trim()) return null;
    return parseTaskInput(input.trim());
  }, [input]);

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
    const parsed = parseTaskInput(input.trim());
    createLocalTaskWithSync(api, auth.isSignedIn, {
      title: parsed.title || input.trim(),
      priority: parsed.priority,
      tags: parsed.tags,
      dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
      estimateMinutes: parsed.estimateMinutes,
    });
    setInput("");
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
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
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{preview.title || "Task"}</Text>
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
  title: { fontSize: 28, fontWeight: "700", color: INK, marginBottom: 10 },
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
  previewTitle: { fontSize: 14, fontWeight: "600", color: INK },
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
