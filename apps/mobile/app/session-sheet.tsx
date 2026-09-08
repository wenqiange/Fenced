import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { MAX_STRICT_DELAY_CHILD } from "@fenced/policy";
import {
  getDefaultSessionMinutes,
  INTENT_DEFAULTS,
  getOnboardingState,
  type Intent,
} from "../src/lib/onboarding-state";
import { setLastPreset } from "../src/lib/local-store";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

const DURATIONS = [15, 25, 50, 90];
const STRICT_DELAYS = [5, 15, 30, 60];

function presetLabel(): string {
  const intent = getOnboardingState().intent as Intent | null;
  if (intent) return INTENT_DEFAULTS[intent].label;
  return "Focus";
}

export default function SessionSheetScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    linkedTaskId?: string;
    linkedTaskTitle?: string;
  }>();
  const onboarding = getOnboardingState();
  const defaultDuration = getDefaultSessionMinutes();
  const [selectedDuration, setSelectedDuration] = useState(
    DURATIONS.includes(defaultDuration) ? defaultDuration : 25
  );
  const [strictEnabled, setStrictEnabled] = useState(false);
  const [strictDelay, setStrictDelay] = useState(15);

  const delayOptions = useMemo(() => {
    if (onboarding.ageBand === "child") {
      return STRICT_DELAYS.filter((d) => d <= MAX_STRICT_DELAY_CHILD);
    }
    return STRICT_DELAYS;
  }, [onboarding.ageBand]);

  function startSession() {
    const label = presetLabel();
    setLastPreset({ label, durationMinutes: selectedDuration });
    router.push({
      pathname: "/session",
      params: {
        duration: String(selectedDuration),
        practice: onboarding.practiceMode ? "1" : "0",
        strictDelay: strictEnabled ? String(strictDelay) : "0",
        presetLabel: label,
        linkedTaskId: params.linkedTaskId ?? "",
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.handleRow}>
        <View style={styles.handle} />
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={t.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Fence your focus</Text>
        <Text style={styles.subtitle}>
          Preset: {presetLabel()} · {selectedDuration} min
          {params.linkedTaskTitle
            ? ` · Task: ${params.linkedTaskTitle}`
            : ""}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.durationChip,
                  selectedDuration === d && styles.durationChipActive,
                ]}
                onPress={() => setSelectedDuration(d)}
              >
                <Text
                  style={[
                    styles.durationText,
                    selectedDuration === d && styles.durationTextActive,
                  ]}
                >
                  {d}m
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fenced apps</Text>
          <Pressable style={styles.optionRow}>
            <Ionicons name="apps-outline" size={20} color={t.accent} />
            <Text style={styles.optionText}>
              {onboarding.categories.length > 0
                ? `${onboarding.categories.length} categories from setup`
                : "Choose apps to fence"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strict mode</Text>
          <Pressable
            style={styles.optionRow}
            onPress={() => setStrictEnabled(!strictEnabled)}
          >
            <Ionicons
              name={strictEnabled ? "lock-closed" : "lock-open-outline"}
              size={20}
              color={strictEnabled ? t.accentAlt : t.textMuted}
            />
            <Text style={styles.optionText}>
              {strictEnabled
                ? `${strictDelay} min delay to end early`
                : "Off — end anytime"}
            </Text>
          </Pressable>
          {strictEnabled && (
            <View style={styles.delayRow}>
              {delayOptions.map((d) => (
                <Pressable
                  key={d}
                  style={[
                    styles.delayChip,
                    strictDelay === d && styles.delayChipActive,
                  ]}
                  onPress={() => setStrictDelay(d)}
                >
                  <Text
                    style={[
                      styles.delayText,
                      strictDelay === d && styles.delayTextActive,
                    ]}
                  >
                    {d}m
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.manageLink} onPress={() => router.push("/fence-hub")}>
          <Text style={styles.manageText}>Manage fences & Fenced Hours</Text>
        </Pressable>
      </ScrollView>

      <Pressable style={styles.startButton} onPress={startSession}>
        <Text style={styles.startText}>Start session</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    handleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.borderStrong,
      marginLeft: "auto",
      marginRight: "auto",
      position: "absolute",
      left: "50%",
      transform: [{ translateX: -20 }],
    },
    scroll: { padding: 20, paddingBottom: 24 },
    title: { fontSize: 26, fontWeight: "700", color: t.text, marginTop: 16 },
    subtitle: { fontSize: 15, color: t.textMuted, marginTop: 6, marginBottom: 20 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    durationRow: { flexDirection: "row", gap: 10 },
    durationChip: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: t.surface,
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    durationChipActive: { borderColor: t.primary, backgroundColor: t.accentTint },
    durationText: { fontSize: 17, fontWeight: "600", color: t.text },
    durationTextActive: { color: t.accent },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 14,
    },
    optionText: { fontSize: 15, color: t.text, flex: 1 },
    delayRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    delayChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: t.surface,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    delayChipActive: { borderColor: t.accentAlt, backgroundColor: t.accentSoft },
    delayText: { fontSize: 15, fontWeight: "500", color: t.text },
    delayTextActive: { color: t.accentAlt },
    manageLink: { paddingVertical: 12 },
    manageText: { fontSize: 15, fontWeight: "600", color: t.accent },
    startButton: {
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    startText: { fontSize: 17, fontWeight: "700", color: t.onPrimary },
  });
