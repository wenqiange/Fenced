import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { FencedBlocking, sandboxAppsFor, type SandboxApp } from "@fenced/blocking";
import { radii } from "@fenced/ui";
import { FenceAssemblyView, type FenceState } from "../src/components/fence";
import { GateBreather } from "../src/components/session/GateBreather";
import { ShieldOverlay } from "../src/components/session/ShieldOverlay";
import { AnimatedPressable, BottomSheetModal, Button, IconButton, Txt } from "../src/components/ui";
import { useAppSelector } from "../src/hooks/use-app-state";
import { useNow } from "../src/hooks/use-now";
import { useAuth } from "../src/lib/auth";
import { useApi } from "../src/lib/api";
import { hapticPanelComplete, hapticPicketDrop, hapticRelease } from "../src/lib/haptics";
import {
  addTask,
  getAppState,
  getTaskById,
  setActiveSession,
  setUnacknowledgedCompletedSession,
  type SessionHistoryEntry,
} from "../src/lib/local-store";
import { completeOnboarding } from "../src/lib/onboarding-state";
import {
  beginSession,
  finishSession,
  markTaskDone,
  passesLeft,
  resumeShield,
  setBreakShield,
  spendEmergencyPass,
} from "../src/lib/session-actions";
import {
  advance,
  cancelStrictUnlock,
  formatClock,
  isShieldPaused,
  phaseProgress,
  remainingMs,
  requestStrictUnlock,
  strictUnlockRemainingMs,
} from "../src/lib/session-engine";
import { AMBIENT_SOUNDS, currentAmbient, playAmbient, playSfx, stopAmbient } from "../src/lib/sound-engine";
import { MINUTES_PER_INTERCEPT } from "../src/lib/stats";
import { pushOnboardingProfile } from "../src/lib/sync/profile";
import { FocusThemeProvider, useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";
import { updateUserSettings } from "../src/lib/local-store";

const PICKETS = 10;

export default function SessionScreen() {
  return (
    <FocusThemeProvider>
      <SessionBody />
    </FocusThemeProvider>
  );
}

function SessionBody() {
  const t = useThemeColors();
  const s = useThemedStyles(styles);
  const auth = useAuth();
  const api = useApi();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const session = useAppSelector((st) => st.activeSession);
  const fenceStyle = useAppSelector((st) => st.settings.fenceStyle);
  const focusSound = useAppSelector((st) => st.settings.focusSound);
  const fences = useAppSelector((st) => st.fences);
  const linkedTask = useAppSelector((st) => st.tasks.find((x) => x.id === st.activeSession?.taskId) ?? null);

  const [summary, setSummary] = useState<SessionHistoryEntry | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [shield, setShield] = useState<{ appName: string | null } | null>(null);
  const [muted, setMuted] = useState(focusSound === "silence");
  const [parkModal, setParkModal] = useState(false);
  const [parkedThought, setParkedThought] = useState("");
  const now = useNow(1000, !!session && !summary);

  function continueWedge() {
    if (!summary) return;
    const task = summary.linkedTaskId ? getTaskById(summary.linkedTaskId) : null;
    beginSession({
      presetLabel: task?.title ?? "Focus",
      presetId: "wedge-deep-block",
      taskId: summary.linkedTaskId,
      fenceId: summary.fenceId,
      durationMinutes: 25,
      cycles: 1,
      breakMinutes: 0,
      strictDelayMinutes: 0,
      practice: false,
    });
    setSummary(null);
  }

  // Cold start mid-session: put the platform shield back up exactly once.
  const resumed = useRef(false);
  useEffect(() => {
    if (session && !resumed.current) {
      resumed.current = true;
      resumeShield(session);
      if (!muted && !currentAmbient() && focusSound !== "silence" && session.phase === "focus") void playAmbient(focusSound);
    }
    const unacknowledged = getAppState().unacknowledgedCompletedSession;
    if (unacknowledged && !summary) {
      setSummary(unacknowledged);
      setUnacknowledgedCompletedSession(null);
      if (params.onboarding === "1") finishOnboarding();
      return;
    }

    if (!session && !summary) {
      router.replace("/(tabs)");
    }
  }, [session, summary, muted, focusSound]);

  // SessionRuntime manages headless wall-clock ticks and phase changes at the root.
  // Reconcile unacknowledged completed sessions here if SessionRuntime finished one while active.
  useEffect(() => {
    const unack = getAppState().unacknowledgedCompletedSession;
    if (unack && !summary) {
      setSummary(unack);
      setUnacknowledgedCompletedSession(null);
      if (params.onboarding === "1") finishOnboarding();
    }
  }, [session, summary]);

  // Picket drop feedback while watching (never while backgrounded).
  const filled = session && session.phase === "focus" ? Math.floor(phaseProgress(session, now) * PICKETS) : 0;
  const lastFilled = useRef(filled);
  useEffect(() => {
    if (filled > lastFilled.current && filled < PICKETS) {
      hapticPicketDrop();
      void playSfx("picket");
    }
    lastFilled.current = filled;
  }, [filled]);

  // Shield hits from the platform (or the sandbox simulator).
  useEffect(
    () =>
      FencedBlocking.onShieldHit((e) => {
        const cur = getAppState().activeSession;
        if (!cur) return;
        setActiveSession({ ...cur, shieldHits: cur.shieldHits + 1 });
        setShield({ appName: e.appName });
      }),
    [],
  );

  // Android back = "leave early" flow, never an instant exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (summary) return false;
      openLeave();
      return true;
    });
    return () => sub.remove();
  });

  function finishOnboarding() {
    completeOnboarding();
    if (auth.isSignedIn) void pushOnboardingProfile(api, auth.user?.displayName, auth.user?.email);
  }

  function openLeave() {
    const cur = getAppState().activeSession;
    if (!cur) return;
    if (cur.strictDelayMinutes > 0) setActiveSession(requestStrictUnlock(cur, new Date()));
    else setConfirmLeave(true);
  }

  function leaveEarly() {
    const cur = getAppState().activeSession;
    if (!cur) return;
    hapticRelease();
    setConfirmLeave(false);
    setSummary(finishSession(cur, "abandoned"));
    setUnacknowledgedCompletedSession(null);
    // A first session cut short still finishes onboarding — never trap the user.
    if (params.onboarding === "1") finishOnboarding();
  }

  function toggleMute() {
    if (muted) {
      const next = focusSound === "silence" ? "rain" : focusSound;
      if (focusSound === "silence") updateUserSettings({ focusSound: next });
      void playAmbient(next);
    } else void stopAmbient();
    setMuted(!muted);
  }

  function cycleSound() {
    const ids = AMBIENT_SOUNDS.map((a) => a.id);
    const next = ids[(ids.indexOf(focusSound as (typeof ids)[number]) + 1) % ids.length];
    updateUserSettings({ focusSound: next });
    setMuted(false);
    void playAmbient(next);
  }

  const sandboxApps: SandboxApp[] = useMemo(() => {
    const f = fences.find((x) => x.id === session?.fenceId) ?? fences[0];
    return f ? sandboxAppsFor(f) : [];
  }, [fences, session?.fenceId]);

  function simulate() {
    const app = sandboxApps.length ? sandboxApps[Math.floor(Math.random() * sandboxApps.length)] : null;
    if (!FencedBlocking.simulateDistraction(app)) setShield(null);
  }

  // ─── Summary / celebration ────────────────────────────────────────────────
  if (summary) {
    return (
      <SessionSummary
        entry={summary}
        styleId={fenceStyle}
        taskTitle={linkedTask?.title ?? null}
        onMarkDone={linkedTask && !linkedTask.completed ? () => markTaskDone(linkedTask.id) : null}
        onKeepGoing={continueWedge}
        onDone={() => router.replace("/(tabs)")}
      />
    );
  }

  if (!session) return <View style={s.container} />;

  // ─── Strict gate ──────────────────────────────────────────────────────────
  const unlockLeft = strictUnlockRemainingMs(session, now);
  if (session.strictDelayMinutes > 0 && unlockLeft !== null) {
    return (
      <SafeAreaView style={s.container}>
        <GateBreather
          remainingMs={unlockLeft}
          delayMinutes={session.strictDelayMinutes}
          onBackToFocus={() => setActiveSession(cancelStrictUnlock(session))}
          onLeave={leaveEarly}
        />
      </SafeAreaView>
    );
  }

  const left = remainingMs(session, now);
  const onBreak = session.phase === "break";
  const paused = isShieldPaused(session, now);
  const until = new Date(session.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const fenceState: FenceState = onBreak ? "complete" : "building";
  const sandbox = FencedBlocking.isSandbox();
  const passes = passesLeft(now);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" tone="muted">
            {session.totalCycles > 1
              ? `${onBreak ? "Break" : "Focus"} · ${session.cycleIndex + 1} of ${session.totalCycles}`
              : session.practice
                ? "Practice session"
                : "Fenced"}
          </Txt>
          <Txt variant="headline" numberOfLines={1}>
            {session.presetLabel}
          </Txt>
          {session.circleId && (
            <Txt variant="caption" tone="accent" style={{ fontWeight: "700", marginTop: 2 }}>
              👥 In Silent Study Room
            </Txt>
          )}
        </View>
        <IconButton icon="musical-notes-outline" label="Change focus sound" onPress={cycleSound} color={t.textMuted} />
        <IconButton
          icon={muted ? "volume-mute-outline" : "volume-medium-outline"}
          label={muted ? "Unmute focus sound" : "Mute focus sound"}
          onPress={toggleMute}
          color={t.textMuted}
        />
      </View>

      <View style={s.center}>
        <Txt
          variant="display"
          numeric
          align="center"
          style={s.timer}
          accessibilityRole="timer"
          accessibilityLabel={`${Math.ceil(left / 60000)} minutes left`}
        >
          {formatClock(left)}
        </Txt>
        <Txt variant="callout" tone="muted" align="center" numeric>
          {onBreak ? `Break until ${until}. The fence is down.` : `Fenced until ${until}`}
          {!muted && focusSound !== "silence" ? ` · ${AMBIENT_SOUNDS.find((a) => a.id === focusSound)?.label}` : ""}
        </Txt>

        <View style={s.fence}>
          <FenceAssemblyView
            progress={onBreak ? 1 : phaseProgress(session, now)}
            pickets={PICKETS}
            styleId={fenceStyle}
            state={fenceState}
          />
        </View>

        {paused && session.shieldPausedUntil && (
          <Animated.View entering={FadeIn} style={s.passBanner} accessibilityLiveRegion="polite">
            <Ionicons name="time-outline" size={16} color={t.breach} />
            <Txt variant="caption" tone="breach" numeric>
              Fence lowered for {formatClock(new Date(session.shieldPausedUntil).getTime() - now.getTime())} — re-arms on its own
            </Txt>
          </Animated.View>
        )}
      </View>

      <View style={s.bottom}>
        {sandbox && !onBreak && (
          <AnimatedPressable onPress={simulate} style={s.sandboxBtn} accessibilityLabel="Sandbox: simulate opening a fenced app">
            <Ionicons name="flask-outline" size={16} color={t.info} />
            <Txt variant="caption" style={{ color: t.info }}>
              Sandbox: try opening a fenced app
            </Txt>
          </AnimatedPressable>
        )}
        <View style={s.bottomRow}>
          {!onBreak && !paused && passes > 0 && (
            <AnimatedPressable
              onPress={() => spendEmergencyPass(session)}
              accessibilityLabel={`Emergency pass. Lowers the fence for 3 minutes. ${passes} left this week.`}
              style={s.quiet}
            >
              <Txt variant="callout" tone="muted">
                Emergency pass ({passes})
              </Txt>
            </AnimatedPressable>
          )}
          {!onBreak && (
            <AnimatedPressable
              onPress={() => setParkModal(true)}
              accessibilityLabel="Park a distracting thought"
              style={s.quiet}
            >
              <Txt variant="callout" tone="muted">
                Park thought 💡
              </Txt>
            </AnimatedPressable>
          )}
          <View style={{ flex: 1 }} />
          <AnimatedPressable onPress={openLeave} accessibilityLabel="Leave early" style={s.quiet}>
            <Txt variant="callout" tone="muted">
              {session.strictDelayMinutes > 0 ? `Leave early · ${session.strictDelayMinutes} min delay` : "Leave early"}
            </Txt>
          </AnimatedPressable>
        </View>
      </View>

      <BottomSheetModal visible={parkModal} onClose={() => setParkModal(false)} title="Park a distracting thought">
        <View style={{ paddingHorizontal: 20, gap: 12, paddingTop: 4 }}>
          <Txt variant="body" tone="muted">
            What's trying to distract you? Park it safely in your tasks so you don't break your focus now.
          </Txt>
          <TextInput
            value={parkedThought}
            onChangeText={setParkedThought}
            placeholder="e.g. Check flight, reply to Alex, buy milk..."
            placeholderTextColor={t.textMuted}
            style={{
              minHeight: 48,
              borderRadius: radii.md,
              backgroundColor: t.surfaceAlt,
              paddingHorizontal: 12,
              color: t.text,
              fontSize: 16,
            }}
            autoFocus
          />
          <Button
            label="Park & keep focusing"
            onPress={() => {
              if (parkedThought.trim()) {
                addTask({
                  title: parkedThought.trim(),
                  priority: "none",
                  tags: ["parked"],
                  dueAt: null,
                  estimateMinutes: null,
                  rrule: null,
                });
                hapticPicketDrop();
                setParkedThought("");
              }
              setParkModal(false);
            }}
          />
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave early?">
        <View style={{ paddingHorizontal: 20, gap: 10, paddingTop: 4 }}>
          <Txt variant="body" tone="muted">
            This panel stays as it is — unfinished, not erased.
          </Txt>
          <Button label="Keep focusing" onPress={() => setConfirmLeave(false)} />
          <Button label="Leave early" kind="ghost" onPress={leaveEarly} />
        </View>
      </BottomSheetModal>

      <ShieldOverlay
        visible={!!shield}
        appName={shield?.appName ?? null}
        endsAt={new Date(session.endsAt)}
        sandbox={sandbox}
        styleId={fenceStyle}
        passesLeft={passes}
        onReturn={() => setShield(null)}
        onEmergencyPass={() => {
          spendEmergencyPass(session);
          setShield(null);
        }}
      />
    </SafeAreaView>
  );
}

function SessionSummary({
  entry,
  styleId,
  taskTitle,
  onMarkDone,
  onKeepGoing,
  onDone,
}: {
  entry: SessionHistoryEntry;
  styleId: string;
  taskTitle: string | null;
  onMarkDone: (() => void) | null;
  onKeepGoing?: (() => void) | null;
  onDone: () => void;
}) {
  const t = useThemeColors();
  const s = useThemedStyles(styles);
  const [marked, setMarked] = useState(false);
  const complete = entry.status === "completed";
  const hits = entry.shieldHits;

  return (
    <SafeAreaView style={[s.container, { justifyContent: "center", paddingHorizontal: 24 }]}>
      <Animated.View entering={FadeIn.duration(300)}>
        <FenceAssemblyView progress={complete ? 1 : entry.durationMinutes / Math.max(1, entry.plannedMinutes)} pickets={PICKETS} styleId={styleId} state={complete ? "complete" : "left-early"} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(450).duration(350)}>
        <Txt variant="title1" align="center" style={{ marginTop: 24 }} accessibilityRole="header">
          {complete ? "Panel complete" : "You left early"}
        </Txt>
        <Txt variant="body" tone="muted" align="center" numeric style={{ marginTop: 6 }}>
          {complete
            ? `${entry.durationMinutes} minutes of focus, fenced.`
            : `${entry.durationMinutes} of ${entry.plannedMinutes} minutes. The panel stays as it is.`}
        </Txt>

        <View style={s.stats}>
          <Stat value={`${entry.durationMinutes}m`} label="Focused" />
          <Stat value={String(hits)} label={hits === 1 ? "Shield hit" : "Shield hits"} />
          <Stat value={`~${hits * MINUTES_PER_INTERCEPT}m`} label="Reclaimed" />
        </View>
        {hits > 0 && (
          <Txt variant="caption" tone="muted" align="center">
            You reached for a fenced app {hits} time{hits === 1 ? "" : "s"}. The fence held.
          </Txt>
        )}

        {entry.plannedMinutes <= 3 && complete && onKeepGoing && (
          <View style={{ marginTop: 16, padding: 14, borderRadius: radii.md, backgroundColor: t.surfaceAlt, gap: 6 }}>
            <Txt variant="headline" align="center" tone="accent">
              Inertia broken! 🪵
            </Txt>
            <Txt variant="caption" tone="muted" align="center">
              You overcame the friction of starting. Want to roll this momentum into a 25-minute deep block?
            </Txt>
            <Button
              label="Keep momentum · 25 min block"
              kind="primary"
              onPress={onKeepGoing}
              style={{ marginTop: 6 }}
            />
          </View>
        )}

        {onMarkDone && taskTitle && !marked && (
          <Button
            label={`Mark "${taskTitle}" done`}
            kind="secondary"
            icon="checkmark-circle-outline"
            style={{ marginTop: 24 }}
            onPress={() => {
              onMarkDone();
              setMarked(true);
            }}
          />
        )}
        <Button label="Done" onPress={onDone} style={{ marginTop: 12 }} />
      </Animated.View>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Txt variant="title2" numeric>
        {value}
      </Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const styles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, gap: 4 },
    center: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
    timer: { fontSize: 72, lineHeight: 80, letterSpacing: 1, fontWeight: "300", color: t.text },
    fence: { marginTop: 36, paddingHorizontal: 8 },
    passBanner: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      alignSelf: "center",
      marginTop: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: t.breachSoft,
    },
    bottom: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    bottomRow: { flexDirection: "row", alignItems: "center" },
    quiet: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
    sandboxBtn: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      alignSelf: "center",
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: t.infoSoft,
    },
    stats: { flexDirection: "row", marginTop: 28, marginBottom: 12 },
  });
