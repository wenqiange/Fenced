import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { computeYardProgression } from "@fenced/core";
import { radii } from "@fenced/ui";
import { Button, FenceCard, IconButton, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { formatFocusHours } from "../../src/lib/local-store";
import { currentStreak, timeReclaimedMinutes } from "../../src/lib/stats";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

/**
 * Deterministic, dependency-free digest over a string. Not cryptographic —
 * it is a tamper-evidence check for a certificate the user controls and
 * shares themselves, not a security boundary.
 */
function digest(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0;
  h2 = (Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export default function CertificateScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const history = useAppSelector((st) => st.sessionHistory);
  const { onboarding } = useOnboarding();
  const [busy, setBusy] = useState(false);

  const yard = useMemo(() => computeYardProgression(history), [history]);
  const streak = useMemo(() => currentStreak(history), [history]);
  const reclaimed = useMemo(() => timeReclaimedMinutes(history), [history]);
  const completed = history.filter((h) => h.status === "completed");
  const totalFocusMinutes = completed.reduce((sum, h) => sum + h.durationMinutes, 0);
  const totalSessions = completed.length;

  const payload = useMemo(() => {
    const body = {
      kind: "fenced-focus-certificate/1",
      issuedAt: new Date().toISOString(),
      holder: onboarding.displayName ?? "Fenced user",
      totals: {
        sessions: totalSessions,
        focusMinutes: totalFocusMinutes,
        currentStreakDays: streak,
        reclaimedMinutes: Math.round(reclaimed),
        yardTier: yard.tier,
      },
      note: "Generated entirely on-device from local session history. Not independently verified by a third party.",
    };
    const json = JSON.stringify(body);
    return { body, signature: digest(json) };
  }, [onboarding.displayName, totalSessions, totalFocusMinutes, streak, reclaimed, yard.tier]);

  const certificateText = useMemo(
    () =>
      [
        "FENCED — FOCUS CERTIFICATE",
        "",
        `Holder: ${payload.body.holder}`,
        `Issued: ${new Date(payload.body.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
        "",
        `Total focused time: ${formatFocusHours(totalFocusMinutes)}`,
        `Sessions completed: ${totalSessions}`,
        `Current fence line: ${streak} day${streak === 1 ? "" : "s"}`,
        `Time reclaimed from distraction (estimate): ${formatFocusHours(Math.round(reclaimed))}`,
        `Yard tier: ${yard.tier.replace(/_/g, " ")}`,
        "",
        `Verification code: ${payload.signature}`,
        "",
        "This certificate is generated entirely on-device from local session history.",
        "It is a personal record of effort, not an institutional credential.",
      ].join("\n"),
    [payload, totalFocusMinutes, totalSessions, streak, reclaimed, yard.tier],
  );

  async function copyToClipboard() {
    await Clipboard.setStringAsync(certificateText);
    Alert.alert("Copied", "The certificate text is on your clipboard.");
  }

  async function shareFile() {
    setBusy(true);
    try {
      const file = new File(Paths.cache, `fenced-focus-certificate-${new Date().toISOString().slice(0, 10)}.txt`);
      if (file.exists) file.delete();
      file.create();
      file.write(certificateText);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing unavailable", "Use Copy instead.");
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: "text/plain", dialogTitle: "Share your focus certificate" });
    } catch {
      Alert.alert("Couldn't create the file", "Use Copy instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Txt variant="title2" accessibilityRole="header">
          Focus Certificate
        </Txt>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="callout" tone="muted" style={{ marginBottom: 16 }}>
          A portable, on-device proof of the real focus work you have done — share it with a tutor, a scholarship
          application, or just keep it for yourself.
        </Txt>

        <FenceCard style={s.certificate}>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="ribbon-outline" size={40} color={t.accent} />
            <Txt variant="title2" align="center" style={{ marginTop: 8 }}>
              Fenced Focus Certificate
            </Txt>
            <Txt variant="caption" tone="muted" align="center">
              {payload.body.holder}
            </Txt>
          </View>

          <View style={{ gap: 10 }}>
            <CertRow icon="time-outline" label="Total focused time" value={formatFocusHours(totalFocusMinutes)} />
            <CertRow icon="checkmark-done-outline" label="Sessions completed" value={String(totalSessions)} />
            <CertRow icon="git-commit-outline" label="Current fence line" value={`${streak} day${streak === 1 ? "" : "s"}`} />
            <CertRow icon="hourglass-outline" label="Time reclaimed" value={`~${formatFocusHours(Math.round(reclaimed))}`} />
            <CertRow icon="leaf-outline" label="Yard tier" value={yard.tier.replace(/_/g, " ")} />
          </View>

          <View style={s.sigBox}>
            <Txt variant="micro" tone="muted">
              Verification code
            </Txt>
            <Txt variant="caption" numeric tone="accent" style={{ fontWeight: "700" }}>
              {payload.signature}
            </Txt>
          </View>
        </FenceCard>

        <SectionHeader title="Share" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label="Copy text" kind="secondary" icon="copy-outline" onPress={() => void copyToClipboard()} style={{ flex: 1 }} />
          <Button label={busy ? "Preparing…" : "Share file"} icon="share-outline" disabled={busy} onPress={() => void shareFile()} style={{ flex: 1 }} />
        </View>

        <Txt variant="caption" tone="muted" style={{ marginTop: 16 }}>
          This certificate is computed entirely from your local session history. It is not independently verified by
          a third party, and the verification code only proves the numbers were not edited after the fact on this
          device — it is a personal record of effort, not an institutional credential.
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}

function CertRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={18} color={t.accent} />
      <Txt variant="callout" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="callout" numeric style={{ fontWeight: "700" }}>
        {value}
      </Txt>
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
    scroll: { padding: 20, paddingBottom: 48 },
    certificate: {
      borderWidth: 1,
      borderColor: t.accent,
      marginBottom: 20,
    },
    sigBox: {
      marginTop: 16,
      padding: 10,
      borderRadius: radii.md,
      backgroundColor: t.accentSoft,
      alignItems: "center",
    },
  });
