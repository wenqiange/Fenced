import { useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HIT_TARGET, radii } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  type LocalCalendarEvent,
} from "../../lib/local-store";
import { beginSession } from "../../lib/session-actions";
import { useThemeColors } from "../../lib/theme";
import { BottomSheetModal, Button, Chip, IconButton, SegmentedControl, Txt } from "../ui";

const DURATIONS = [15, 30, 45, 60, 90, 120];

export type EventDraft = { mode: "create"; start: Date } | { mode: "edit"; event: LocalCalendarEvent };

const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Create a plain event or a focus block, or view/edit/delete an existing one. */
export function EventSheet({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
  const t = useThemeColors();
  const tasks = useAppSelector((s) => s.tasks);
  const editing = draft?.mode === "edit" ? draft.event : null;
  const readOnly = editing?.source === "google";

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"event" | "focus">("focus");
  const [start, setStart] = useState(new Date());
  const [minutes, setMinutes] = useState(60);

  useEffect(() => {
    if (!draft) return;
    if (draft.mode === "create") {
      setTitle("");
      setKind("focus");
      setStart(draft.start);
      setMinutes(60);
    } else {
      const s = new Date(draft.event.startAt);
      setTitle(draft.event.title);
      setKind(draft.event.source === "time-block" ? "focus" : "event");
      setStart(s);
      setMinutes(Math.max(5, Math.round((new Date(draft.event.endAt).getTime() - s.getTime()) / 60_000)));
    }
  }, [draft]);

  const end = new Date(start.getTime() + minutes * 60_000);
  const shift = (m: number) => setStart(new Date(start.getTime() + m * 60_000));
  const linked = editing?.linkedTaskId ? tasks.find((x) => x.id === editing.linkedTaskId) : null;

  const save = () => {
    const name = title.trim() || (kind === "focus" ? "Focus block" : "Event");
    if (editing) {
      updateCalendarEvent(editing.id, { title: name, startAt: start.toISOString(), endAt: end.toISOString() });
    } else {
      addCalendarEvent({
        title: name,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        linkedTaskId: null,
        source: kind === "focus" ? "time-block" : "local",
      });
    }
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert(
      "Delete this event?",
      readOnly ? "It's also removed from your Google Calendar on the next sync." : "It's removed from every device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCalendarEvent(editing.id);
            onClose();
          },
        },
      ],
    );
  };

  const focusNow = () => {
    beginSession({
      presetLabel: linked?.title ?? (title.trim() || "Focus block"),
      taskId: linked?.id ?? null,
      durationMinutes: Math.min(180, Math.max(5, Math.round((end.getTime() - Math.max(Date.now(), start.getTime())) / 60_000)) || minutes),
    });
    onClose();
    router.push("/session");
  };

  return (
    <BottomSheetModal visible={!!draft} onClose={onClose} title={editing ? (readOnly ? "Google event" : "Edit") : "New"}>
      <View style={{ paddingHorizontal: 20, gap: 14, paddingTop: 4, paddingBottom: 4 }}>
        {!editing && (
          <SegmentedControl
            accessibilityLabel="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "focus", label: "Focus block" },
              { value: "event", label: "Event" },
            ]}
          />
        )}
        <TextInput
          value={title}
          onChangeText={setTitle}
          editable={!readOnly}
          placeholder={kind === "focus" ? "What will you focus on?" : "Title"}
          placeholderTextColor={t.textMuted}
          accessibilityLabel="Title"
          style={{
            minHeight: HIT_TARGET + 4,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: t.borderStrong,
            paddingHorizontal: 14,
            fontSize: 17,
            color: t.text,
            backgroundColor: t.surface,
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {!readOnly && <IconButton icon="remove-circle-outline" label="15 minutes earlier" onPress={() => shift(-15)} color={t.accent} />}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Txt variant="title2" numeric>
              {fmt(start)} – {fmt(end)}
            </Txt>
            <Txt variant="caption" tone="muted">
              {start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </Txt>
          </View>
          {!readOnly && <IconButton icon="add-circle-outline" label="15 minutes later" onPress={() => shift(15)} color={t.accent} />}
        </View>

        {!readOnly && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {DURATIONS.map((d) => (
              <Chip key={d} label={d < 60 ? `${d}m` : `${d / 60}h`} selected={minutes === d} onPress={() => setMinutes(d)} />
            ))}
          </View>
        )}

        {linked && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name="link-outline" size={16} color={t.textMuted} />
            <Txt variant="callout" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              For task: {linked.title}
            </Txt>
          </View>
        )}

        {editing && end.getTime() > Date.now() && (
          <Button label="Start focus session now" icon="shield-outline" kind="secondary" onPress={focusNow} />
        )}
        {!readOnly && <Button label={editing ? "Save" : kind === "focus" ? "Add focus block" : "Add event"} onPress={save} />}
        {editing && <Button label="Delete" kind="destructive" icon="trash-outline" onPress={remove} />}
      </View>
    </BottomSheetModal>
  );
}
