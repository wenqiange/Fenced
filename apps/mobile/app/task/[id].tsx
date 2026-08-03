import { useLocalSearchParams, router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { describeRrule } from "@fenced/nlp";
import { useAppState } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import {
  deleteTask,
  getTaskById,
  toggleTask,
  updateTask,
} from "../../src/lib/local-store";
import { pushTaskUpdate } from "../../src/lib/sync/tasks";
import { PINE, PAPER, INK, SLATE, TIMBER, SAND } from "../../src/lib/theme";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAppState();
  const auth = useAuth();
  const api = useApi();

  const task = useMemo(
    () => state.tasks.find((t) => t.id === id) ?? getTaskById(id ?? ""),
    [state.tasks, id]
  );

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");

  const blockerCandidates = useMemo(
    () => state.tasks.filter((t) => t.id !== task?.id),
    [state.tasks, task?.id],
  );

  function toggleBlocker(blockerId: string) {
    if (!task) return;
    const current = task.blockedByTaskIds ?? [];
    const next = current.includes(blockerId)
      ? current.filter((id) => id !== blockerId)
      : [...current, blockerId];
    updateTask(task.id, { blockedByTaskIds: next });
    const updated = getTaskById(task.id);
    if (updated && auth.isSignedIn) {
      void pushTaskUpdate(api, updated);
    }
  }

  function safeGoBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.missing}>Task not found</Text>
        <Pressable onPress={safeGoBack}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const taskId = task.id;
  const taskTitle = task.title;

  function save() {
    updateTask(taskId, { title: title.trim() || taskTitle, notes });
    const updated = getTaskById(taskId);
    if (updated && auth.isSignedIn) {
      void pushTaskUpdate(api, updated);
    }
  }

  function startLinkedSession() {
    save();
    router.push({
      pathname: "/session-sheet",
      params: { linkedTaskId: taskId, linkedTaskTitle: taskTitle },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={safeGoBack}>
          <Ionicons name="close" size={26} color={SLATE} />
        </Pressable>
        <Text style={styles.headerTitle}>Task</Text>
        <Pressable
          onPress={() => {
            save();
            safeGoBack();
          }}
        >
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={SLATE}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes"
          placeholderTextColor={SLATE}
          multiline
        />

        <View style={styles.metaCard}>
          {task.dueAt && (
            <Text style={styles.meta}>
              Due{" "}
              {new Date(task.dueAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          )}
          {task.estimateMinutes != null && (
            <Text style={styles.meta}>{task.estimateMinutes} min estimate</Text>
          )}
          {describeRrule(task.rrule) && (
            <Text style={styles.repeat}>Repeats {describeRrule(task.rrule)?.toLowerCase()}</Text>
          )}
          {task.priority !== "none" && (
            <Text style={styles.meta}>Priority: {task.priority}</Text>
          )}
          {task.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>

        {blockerCandidates.length > 0 && (
          <View style={styles.depSection}>
            <Text style={styles.label}>Blocked by</Text>
            <Text style={styles.depHint}>
              Auto-schedule waits until these are complete.
            </Text>
            <View style={styles.depRow}>
              {blockerCandidates.map((candidate) => {
                const on = (task.blockedByTaskIds ?? []).includes(candidate.id);
                return (
                  <Pressable
                    key={candidate.id}
                    style={[styles.depChip, on && styles.depChipOn]}
                    onPress={() => toggleBlocker(candidate.id)}
                  >
                    <Text style={[styles.depChipText, on && styles.depChipTextOn]}>
                      {candidate.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Pressable
          style={styles.primary}
          onPress={() => {
            toggleTask(task.id);
            if (auth.isSignedIn) {
              const updated = getTaskById(task.id);
              if (updated) void pushTaskUpdate(api, updated);
            }
            safeGoBack();
          }}
        >
          <Text style={styles.primaryText}>
            {task.completed ? "Mark incomplete" : "Mark complete"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={startLinkedSession}>
          <Text style={styles.secondaryText}>Fence time for this task</Text>
        </Pressable>

        <Pressable
          style={styles.danger}
          onPress={() => {
            deleteTask(task.id);
            safeGoBack();
          }}
        >
          <Text style={styles.dangerText}>Delete task</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: INK },
  save: { fontSize: 16, fontWeight: "600", color: PINE },
  scroll: { padding: 20, paddingBottom: 40 },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: INK,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: INK,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  metaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginBottom: 24,
  },
  meta: { fontSize: 14, color: SLATE },
  repeat: { fontSize: 14, fontWeight: "600", color: PINE },
  tag: { fontSize: 13, fontWeight: "600", color: TIMBER },
  depSection: { marginBottom: 24 },
  depHint: { fontSize: 13, color: SLATE, marginBottom: 10, marginTop: -4 },
  depRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  depChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E0DCD6",
  },
  depChipOn: { backgroundColor: SAND, borderColor: PINE },
  depChipText: { fontSize: 13, color: INK, fontWeight: "500" },
  depChipTextOn: { color: PINE, fontWeight: "700" },
  primary: {
    backgroundColor: PINE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  secondary: {
    borderWidth: 1,
    borderColor: PINE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryText: { color: PINE, fontWeight: "600", fontSize: 16 },
  danger: { alignItems: "center", paddingVertical: 12 },
  dangerText: { color: "#B3402E", fontWeight: "600" },
  missing: { textAlign: "center", marginTop: 40, color: INK },
  link: { textAlign: "center", marginTop: 12, color: PINE },
});
