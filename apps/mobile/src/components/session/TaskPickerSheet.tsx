import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HIT_TARGET, radii } from "@fenced/ui";
import { parseTaskInput } from "@fenced/nlp";
import { useAppSelector } from "../../hooks/use-app-state";
import { addTask, groupTasks } from "../../lib/local-store";
import { useThemeColors } from "../../lib/theme";
import { AnimatedPressable, BottomSheetModal, Button, SectionHeader, Txt } from "../ui";

/** "Focus target": link the session to a task, or jot one down fast. */
export function TaskPickerSheet({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const t = useThemeColors();
  const tasks = useAppSelector((s) => s.tasks);
  const sections = useMemo(() => groupTasks(tasks), [tasks]);
  const [quick, setQuick] = useState("");

  const createQuick = () => {
    const text = quick.trim();
    if (!text) return;
    const parsed = parseTaskInput(text);
    const task = addTask({
      title: parsed.title || text,
      priority: parsed.priority,
      tags: parsed.tags,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt).toISOString() : null,
      estimateMinutes: parsed.estimateMinutes,
      rrule: parsed.recurrence?.rrule ?? null,
    });
    setQuick("");
    onSelect(task.id);
    onClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Focus target">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput
            value={quick}
            onChangeText={setQuick}
            onSubmitEditing={createQuick}
            returnKeyType="done"
            placeholder="New task, e.g. Draft intro 45m"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Quick add a task to focus on"
            style={{ flex: 1, minHeight: HIT_TARGET, borderRadius: radii.md, borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 12, color: t.text, backgroundColor: t.surface }}
          />
          <Button label="Add" kind="secondary" disabled={!quick.trim()} onPress={createQuick} style={{ minHeight: HIT_TARGET }} />
        </View>

        <AnimatedPressable
          onPress={() => {
            onSelect(null);
            onClose();
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedId === null }}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, marginTop: 8 }}
        >
          <Ionicons name={selectedId === null ? "radio-button-on" : "radio-button-off"} size={20} color={t.accent} />
          <Txt variant="body" tone="muted">
            No specific task
          </Txt>
        </AnimatedPressable>

        {sections.map((section) => (
          <View key={section.id}>
            <SectionHeader title={section.title} style={{ marginTop: 12 }} />
            {section.tasks.map((task) => {
              const selected = task.id === selectedId;
              return (
                <AnimatedPressable
                  key={task.id}
                  onPress={() => {
                    onSelect(task.id);
                    onClose();
                  }}
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: 1, borderColor: t.borderSubtle }}
                >
                  <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? t.accent : t.borderStrong} />
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
          </View>
        ))}
        {sections.length === 0 && (
          <Txt variant="callout" tone="muted" style={{ marginTop: 16 }}>
            No open tasks. Add one above, or focus without one.
          </Txt>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}
