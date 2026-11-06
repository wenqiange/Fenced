import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { validatePactCompliance, type FamilyPact } from "@fenced/core";
import { radii } from "@fenced/ui";
import { Badge, Button, FenceCard, IconButton, ProgressBar, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useProgress } from "../../src/hooks/use-progress";
import { uuidv4 } from "../../src/lib/ids";
import {
  clearFamilyPact,
  setFamilyPact,
  signFamilyPactAsGuardian,
  signFamilyPactAsStudent,
} from "../../src/lib/local-store";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

function freshPact(guardianEmail: string, studentName: string): FamilyPact {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    guardianEmail,
    studentDisplayName: studentName,
    status: "draft",
    rules: [
      {
        id: uuidv4(),
        type: "daily_focus_target",
        description: "Focus together on school days",
        targetValue: 60,
        allowedTokens: [],
      },
      {
        id: uuidv4(),
        type: "emergency_passes",
        description: "Emergency passes allowed per week",
        targetValue: 3,
        allowedTokens: [],
      },
    ],
    guardianSignedAt: null,
    studentSignedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export default function FamilyPactScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const pact = useAppSelector((st) => st.familyPact);
  const { onboarding } = useOnboarding();
  const progress = useProgress();
  const [guardianEmail, setGuardianEmail] = useState(pact?.guardianEmail ?? onboarding.guardianEmail ?? "");
  const [studentName, setStudentName] = useState(pact?.studentDisplayName ?? onboarding.displayName ?? "Student");

  const compliance = useMemo(() => {
    if (!pact) return null;
    return validatePactCompliance(pact, {
      weeklyFocusMinutes: progress.weekFocusMinutes,
      emergencyPassesUsed: 0,
    });
  }, [pact, progress.weekFocusMinutes]);

  const bothSigned = Boolean(pact?.guardianSignedAt && pact?.studentSignedAt);
  const dailyRule = pact?.rules.find((r) => r.type === "daily_focus_target");
  const passRule = pact?.rules.find((r) => r.type === "emergency_passes");

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Txt variant="title2" accessibilityRole="header">
          Family Pact
        </Txt>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="callout" tone="muted" style={{ marginBottom: 16 }}>
          A mutual commitment, not a one-way rule. Both sides sign the same promise — no one is watched without being seen too.
        </Txt>

        {!pact ? (
          <FenceCard>
            <Txt variant="headline" style={{ marginBottom: 10 }}>
              Start a pact
            </Txt>
            <Txt variant="caption" tone="muted" style={{ marginBottom: 4 }}>
              Student name
            </Txt>
            <TextInput
              value={studentName}
              onChangeText={setStudentName}
              placeholder="Student name"
              placeholderTextColor={t.textMuted}
              style={s.input}
              accessibilityLabel="Student name"
            />
            <Txt variant="caption" tone="muted" style={{ marginTop: 12, marginBottom: 4 }}>
              Guardian email
            </Txt>
            <TextInput
              value={guardianEmail}
              onChangeText={setGuardianEmail}
              placeholder="guardian@example.com"
              placeholderTextColor={t.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={s.input}
              accessibilityLabel="Guardian email"
            />
            <Button
              label="Create the pact"
              icon="people-outline"
              disabled={!guardianEmail.trim() || !studentName.trim()}
              onPress={() => setFamilyPact(freshPact(guardianEmail.trim(), studentName.trim()))}
              style={{ marginTop: 16 }}
            />
          </FenceCard>
        ) : (
          <>
            <FenceCard style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt variant="headline">{pact.studentDisplayName}'s pact</Txt>
                <Badge
                  label={bothSigned ? "Active" : "Awaiting signatures"}
                  tone={bothSigned ? "success" : "neutral"}
                />
              </View>
              <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
                With {pact.guardianEmail}
              </Txt>

              <View style={{ marginTop: 16, gap: 10 }}>
                {dailyRule && (
                  <View style={s.ruleRow}>
                    <Ionicons name="time-outline" size={18} color={t.accent} />
                    <Txt variant="callout" style={{ flex: 1 }}>
                      Focus {dailyRule.targetValue} min/day on school days
                    </Txt>
                  </View>
                )}
                {passRule && (
                  <View style={s.ruleRow}>
                    <Ionicons name="flash-outline" size={18} color={t.accent} />
                    <Txt variant="callout" style={{ flex: 1 }}>
                      Up to {passRule.targetValue} emergency passes/week
                    </Txt>
                  </View>
                )}
              </View>

              {compliance && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Txt variant="caption" tone="muted">
                      This week
                    </Txt>
                    <Txt variant="caption" tone="muted" numeric>
                      {compliance.summary}
                    </Txt>
                  </View>
                  <ProgressBar value={Math.min(1, progress.weekFocusMinutes / Math.max(1, (dailyRule?.targetValue ?? 60) * 5))} />
                </View>
              )}

              <View style={{ marginTop: 18, gap: 10 }}>
                <SignRow
                  label="Student signature"
                  signedAt={pact.studentSignedAt}
                  onSign={signFamilyPactAsStudent}
                />
                <SignRow
                  label="Guardian signature"
                  signedAt={pact.guardianSignedAt}
                  onSign={signFamilyPactAsGuardian}
                />
              </View>
            </FenceCard>

            <SectionHeader title="What this pact never does" />
            <FenceCard style={{ marginBottom: 16 }}>
              <PactPromise text="Never shows the guardian which apps the student opened" />
              <PactPromise text="Never shows the student's private task titles" />
              <PactPromise text="Never frames a missed target as a broken streak" />
            </FenceCard>

            <Button
              label="End this pact"
              kind="ghost"
              icon="close-circle-outline"
              onPress={() => clearFamilyPact()}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SignRow({ label, signedAt, onSign }: { label: string; signedAt: string | null; onSign: () => void }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={signedAt ? "checkmark-circle" : "ellipse-outline"} size={20} color={signedAt ? t.success : t.borderStrong} />
      <Txt variant="callout" style={{ flex: 1 }}>
        {label}
      </Txt>
      {signedAt ? (
        <Txt variant="caption" tone="muted" numeric>
          Signed
        </Txt>
      ) : (
        <Button label="Sign" kind="secondary" onPress={onSign} />
      )}
    </View>
  );
}

function PactPromise({ text }: { text: string }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
      <Ionicons name="shield-checkmark-outline" size={16} color={t.success} style={{ marginTop: 2 }} />
      <Txt variant="callout" tone="muted" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
    scroll: { padding: 20, paddingBottom: 48 },
    input: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: t.borderStrong,
      color: t.text,
      fontSize: 16,
    },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  });
