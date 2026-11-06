import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import { radii } from "@fenced/ui";
import { FenceAssemblyView, GateLatchSlider } from "../src/components/fence";
import { FencePickerSheet, describeFence } from "../src/components/session/FencePickerSheet";
import { TaskPickerSheet } from "../src/components/session/TaskPickerSheet";
import { AnimatedPressable, Chip, IconButton, SectionHeader, SegmentedControl, Txt } from "../src/components/ui";
import { useAppSelector } from "../src/hooks/use-app-state";
import { getDefaultSessionMinutes, getOnboardingState, INTENT_DEFAULTS } from "../src/lib/onboarding-state";
import { beginSession } from "../src/lib/session-actions";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

type Mode = "single" | "waves";

const SINGLE_DURATIONS = [3, 25, 45, 60, 90];
const WAVES = [
  { id: "2x25", cycles: 2, minutes: 25 },
  { id: "4x25", cycles: 4, minutes: 25 },
  { id: "3x45", cycles: 3, minutes: 45 },
] as const;
const BREAKS = [5, 10];
const STRICT_DELAYS = [5, 15, 30, 60];

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(styles);
  return (
    <AnimatedPressable onPress={onPress} haptic="selection" accessibilityLabel={`${label}: ${value}`} style={s.row} pressScale={0.985}>
      <View style={s.rowIcon}>
        <Ionicons name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="caption" tone="muted">
          {label}
        </Txt>
        <Txt variant="headline" numberOfLines={1}>
          {value}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
    </AnimatedPressable>
  );
}

export default function SessionSheetScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(styles);
  const params = useLocalSearchParams<{ linkedTaskId?: string; circleId?: string; circleName?: string }>();
  const onboarding = getOnboardingState();
  const tasks = useAppSelector((st) => st.tasks);
  const fences = useAppSelector((st) => st.fences);
  const fenceStyle = useAppSelector((st) => st.settings.fenceStyle);
  const active = useAppSelector((st) => st.activeSession);

  const intentDefault = getDefaultSessionMinutes();
  const [mode, setMode] = useState<Mode>("single");
  const [minutes, setMinutes] = useState(SINGLE_DURATIONS.includes(intentDefault) ? intentDefault : 25);
  const [wave, setWave] = useState<(typeof WAVES)[number]["id"]>("2x25");
  const [breakMin, setBreakMin] = useState(5);
  const [taskId, setTaskId] = useState<string | null>(params.linkedTaskId || null);
  const [fenceId, setFenceId] = useState<string | null>(null);
  const [strict, setStrict] = useState(false);
  const [delay, setDelay] = useState(15);
  const [sheet, setSheet] = useState<"task" | "fence" | null>(null);

  const delayOptions = useMemo(
    () => (onboarding.ageBand === "child" ? STRICT_DELAYS.filter((d) => d <= MAX_STRICT_DELAY_CHILD) : STRICT_DELAYS),
    [onboarding.ageBand],
  );

  const task = tasks.find((x) => x.id === taskId);
  const fence = fences.find((f) => f.id === fenceId) ?? fences.find((f) => f.isDefault) ?? fences[0];
  const plan =
    mode === "single"
      ? { durationMinutes: minutes, cycles: 1, breakMinutes: 0 }
      : (() => {
          const w = WAVES.find((x) => x.id === wave)!;
          return { durationMinutes: w.minutes, cycles: w.cycles, breakMinutes: breakMin };
        })();
  const totalFocus = plan.durationMinutes * plan.cycles;
  const totalWall = totalFocus + plan.breakMinutes * (plan.cycles - 1);
  const endsAt = new Date(Date.now() + totalWall * 60_000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const label = task?.title ?? (onboarding.intent ? INTENT_DEFAULTS[onboarding.intent].label : "Focus");

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  const start = () => {
    beginSession({
      presetLabel: label,
      presetId: mode === "single" ? `single-${minutes}` : wave,
      taskId,
      fenceId: fence?.id ?? null,
      circleId: params.circleId ?? null,
      subject: task?.title ?? undefined,
      durationMinutes: plan.durationMinutes,
      cycles: plan.cycles,
      breakMinutes: plan.breakMinutes,
      strictDelayMinutes: strict ? delay : 0,
      practice: onboarding.practiceMode,
    });
    router.replace("/session");
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Txt variant="title1" accessibilityRole="header">
          Fence your focus
        </Txt>
        <IconButton icon="close" label="Close" onPress={close} color={t.textMuted} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.preview}>
          <FenceAssemblyView progress={0} pickets={Math.min(12, Math.max(6, Math.round(totalFocus / 5)))} styleId={fenceStyle} state="idle" />
          <Txt variant="callout" tone="muted" align="center" numeric style={{ marginTop: 8 }}>
            {plan.cycles > 1
              ? `${plan.cycles} × ${plan.durationMinutes} min, ${plan.breakMinutes} min breaks · ends ${endsAt}`
              : `${totalFocus} min · ends ${endsAt}`}
          </Txt>
        </View>

        {params.circleName && (
          <Row
            icon="library-outline"
            label="Silent Study Room"
            value={params.circleName}
            onPress={() => router.push(`/circle/${params.circleId}`)}
          />
        )}
        <Row icon="flag-outline" label="Focus target" value={task?.title ?? "No specific task"} onPress={() => setSheet("task")} />
        <Row icon="shield-outline" label="Fenced apps" value={describeFence(fence)} onPress={() => setSheet("fence")} />

        <SectionHeader title="Rhythm" />
        <SegmentedControl
          accessibilityLabel="Session rhythm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "single", label: "Single block" },
            { value: "waves", label: "Deep-work waves" },
          ]}
        />
        <View style={s.chips}>
          {mode === "single"
            ? SINGLE_DURATIONS.map((d) => (
                <Chip
                  key={d}
                  label={d === 3 ? "3m Wedge" : `${d} min`}
                  selected={minutes === d}
                  onPress={() => setMinutes(d)}
                  tone={d === 3 ? "accent" : undefined}
                />
              ))
            : WAVES.map((w) => (
                <Chip key={w.id} label={`${w.cycles} × ${w.minutes}m`} selected={wave === w.id} onPress={() => setWave(w.id)} />
              ))}
        </View>
        {mode === "single" && minutes === 3 && (
          <Txt variant="caption" tone="accent" style={{ marginTop: 4 }}>
            The Picket Wedge: Just 3 minutes to break task inertia. When time is up, you choose whether to continue.
          </Txt>
        )}
        {mode === "waves" && (
          <View style={[s.chips, { alignItems: "center" }]}>
            <Txt variant="caption" tone="muted">
              Breaks
            </Txt>
            {BREAKS.map((b) => (
              <Chip key={b} label={`${b} min`} selected={breakMin === b} onPress={() => setBreakMin(b)} tone="timber" />
            ))}
          </View>
        )}

        <SectionHeader title="Strict mode" />
        <View style={s.strictRow}>
          <Ionicons name={strict ? "lock-closed" : "lock-open-outline"} size={20} color={strict ? t.accentAlt : t.textMuted} />
          <View style={{ flex: 1 }}>
            <Txt variant="headline">{strict ? `${delay}-minute delay to leave early` : "Leave any time"}</Txt>
            <Txt variant="caption" tone="muted">
              {strict ? "Leaving starts your delay. It can't be shortened once it starts." : "Add a delay that makes leaving deliberate."}
            </Txt>
          </View>
          <Switch
            value={strict}
            onValueChange={setStrict}
            accessibilityLabel="Strict mode"
            trackColor={{ true: t.primary, false: t.track }}
            thumbColor={t.surface}
          />
        </View>
        {strict && (
          <View style={s.chips}>
            {delayOptions.map((d) => (
              <Chip key={d} label={`${d} min`} selected={delay === d} onPress={() => setDelay(d)} tone="timber" />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {active ? (
          <AnimatedPressable onPress={() => router.replace("/session")} style={s.resume} accessibilityLabel="Return to the running session">
            <Txt variant="headline" tone="onPrimary">
              A session is already running — return to it
            </Txt>
          </AnimatedPressable>
        ) : (
          <GateLatchSlider onLatched={start} styleId={fenceStyle} />
        )}
      </View>

      <TaskPickerSheet visible={sheet === "task"} selectedId={taskId} onSelect={setTaskId} onClose={() => setSheet(null)} />
      <FencePickerSheet
        visible={sheet === "fence"}
        selectedId={fence?.id ?? null}
        onSelect={setFenceId}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

const styles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 },
    scroll: { paddingHorizontal: 20, paddingBottom: 24 },
    preview: { paddingVertical: 16, paddingHorizontal: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 14,
      marginBottom: 8,
      borderRadius: radii.card,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.cardBorder,
    },
    rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    strictRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderColor: t.borderSubtle, backgroundColor: t.bg },
    resume: { minHeight: 56, borderRadius: radii.md, backgroundColor: t.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  });
