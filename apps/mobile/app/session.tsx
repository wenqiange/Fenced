import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { colors } from "@fenced/ui";
import { FencedBlocking } from "@fenced/blocking";
import { recordSessionComplete } from "../src/lib/local-store";
import { completeOnboarding } from "../src/lib/onboarding-state";

export default function SessionScreen() {
  const params = useLocalSearchParams<{
    duration?: string;
    practice?: string;
    strictDelay?: string;
    presetLabel?: string;
    finishOnboarding?: string;
    linkedTaskId?: string;
  }>();
  const totalSeconds = Math.max(1, Number(params.duration ?? 25)) * 60;
  const practiceMode = params.practice === "1";
  const strictDelayMinutes = Number(params.strictDelay ?? 0);
  const presetLabel = params.presetLabel ?? "Focus";
  const finishOnboarding = params.finishOnboarding === "1";
  const linkedTaskId = params.linkedTaskId?.trim() || null;

  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [shieldHits] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void FencedBlocking.applyShield();

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      void FencedBlocking.clearShield();
    };
  }, []);

  useEffect(() => {
    if (remainingSeconds === 0 && !recorded) {
      setRecorded(true);
      const minutes = Math.round(totalSeconds / 60);
      recordSessionComplete({
        durationMinutes: minutes,
        shieldHits,
        practice: practiceMode,
        linkedTaskId,
        preset: { label: presetLabel, durationMinutes: minutes },
      });
      if (finishOnboarding) {
        completeOnboarding();
      }
    }
  }, [
    remainingSeconds,
    recorded,
    totalSeconds,
    shieldHits,
    presetLabel,
    finishOnboarding,
    practiceMode,
    linkedTaskId,
  ]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isComplete = remainingSeconds === 0;

  async function leave() {
    if (!isComplete && strictDelayMinutes > 0) {
      Alert.alert(
        "Strict mode",
        `You set a ${strictDelayMinutes}-minute delay when you started. End session early anyway?`,
        [
          { text: "Keep focusing", style: "cancel" },
          {
            text: "End early",
            style: "destructive",
            onPress: () => void exitSession(),
          },
        ]
      );
      return;
    }
    await exitSession();
  }

  async function exitSession() {
    await FencedBlocking.clearShield();
    if (isComplete) {
      if (finishOnboarding) {
        Alert.alert(
          "That’s day one",
          "Your first fence panel is built. Come back tomorrow and the fence grows.",
          [
            {
              text: "OK",
              onPress: () => {
                Alert.alert(
                  "Session reminders",
                  "Want a nudge when your Fenced Hours start? You can turn this on later in You → Notifications.",
                  [{ text: "Not now" }, { text: "OK" }]
                );
                router.replace("/(tabs)");
              },
            },
          ]
        );
        return;
      }
      router.replace("/(tabs)");
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {practiceMode && (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceText}>Practice run</Text>
          </View>
        )}
        <Pressable style={styles.exitButton} onPress={() => void leave()}>
          <Text style={styles.exitText}>
            {isComplete ? "Done" : "End early"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.label}>
          {isComplete ? "Session complete" : "Fenced"}
        </Text>
        <Text style={styles.timer}>
          {minutes.toString().padStart(2, "0")}:
          {seconds.toString().padStart(2, "0")}
        </Text>
        <Text style={styles.shieldLabel}>
          {shieldHits} shield {shieldHits === 1 ? "hit" : "hits"}
        </Text>
        {isComplete && (
          <Text style={styles.completeCopy}>
            That&apos;s day one. Your fence panel is built.
          </Text>
        )}
      </View>

      <View style={styles.fence}>
        {Array.from({ length: 10 }, (_, i) => {
          const progress = 1 - remainingSeconds / totalSeconds;
          const filled = i / 10 < progress;
          return (
            <View
              key={i}
              style={[styles.picket, filled && styles.picketFilled]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.focus.bg,
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  practiceBadge: {
    marginRight: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.focus.surface,
  },
  practiceText: { fontSize: 13, color: colors.timber, fontWeight: "600" },
  exitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.focus.picketEmpty,
  },
  exitText: { fontSize: 14, color: colors.focus.textMuted },
  center: { alignItems: "center" },
  label: {
    fontSize: 15,
    color: colors.focus.textMuted,
    fontWeight: "500",
    marginBottom: 8,
  },
  timer: {
    fontSize: 72,
    fontWeight: "700",
    color: colors.focus.text,
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
  },
  shieldLabel: { fontSize: 14, color: colors.focus.textMuted, marginTop: 16 },
  completeCopy: {
    fontSize: 15,
    color: colors.focus.textMuted,
    marginTop: 20,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  fence: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    height: 60,
    alignItems: "flex-end",
  },
  picket: {
    width: 8,
    height: 40,
    borderRadius: 3,
    backgroundColor: colors.focus.picketEmpty,
  },
  picketFilled: {
    backgroundColor: colors.focus.picketFilled,
    height: 50,
  },
});
