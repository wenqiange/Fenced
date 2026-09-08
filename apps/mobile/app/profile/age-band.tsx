import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { pushOnboardingProfile } from "../../src/lib/sync/profile";
import type { AgeBand } from "@fenced/core";

export default function AgeBandScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();
  const { onboarding, applyAgeAssurance } = useOnboarding();
  const [editing, setEditing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(6);
  const [selectedYear, setSelectedYear] = useState(2008);

  const currentBand = onboarding.ageBand ?? "adult";
  const jurisdiction = onboarding.jurisdiction ?? "US";

  const applyCorrection = () => {
    const res = applyAgeAssurance(selectedMonth, selectedYear, jurisdiction);
    if (auth.isSignedIn) {
      void pushOnboardingProfile(api, auth.user?.displayName, auth.user?.email);
    }

    setEditing(false);
    Alert.alert(
      "Age Band Updated",
      `Your age band is now set to ${res.ageBand.toUpperCase()}. Features have been updated accordingly.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Age Band & Compliance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="people" size={32} color={t.accent} />
          </View>
          <Text style={styles.bandTitle}>
            Current Band: {currentBand.toUpperCase()}
          </Text>
          <Text style={styles.bandSub}>
            Assurance Method: {onboarding.assuranceMethod ?? "Neutral Gate"} · Jurisdiction: {jurisdiction}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Protection Rules</Text>
          <View style={styles.infoBox}>
            <View style={styles.ruleRow}>
              <Ionicons
                name={currentBand === "adult" ? "ellipse-outline" : "checkmark-circle"}
                size={20}
                color={t.accent}
              />
              <Text style={styles.ruleText}>
                Zero analytics data collected for minor accounts
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons
                name={currentBand === "adult" ? "ellipse-outline" : "checkmark-circle"}
                size={20}
                color={t.accent}
              />
              <Text style={styles.ruleText}>
                No personal data sent to third-party AI model providers
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons
                name={currentBand === "adult" ? "ellipse-outline" : "checkmark-circle"}
                size={20}
                color={t.accent}
              />
              <Text style={styles.ruleText}>
                {onboarding.childrensCodeApplies
                  ? "UK Children's Code & GDPR Art. 8 protections active"
                  : "Standard privacy regime active"}
              </Text>
            </View>
          </View>
        </View>

        {!editing ? (
          <Pressable style={styles.correctButton} onPress={() => setEditing(true)}>
            <Ionicons name="create-outline" size={20} color={t.accent} />
            <Text style={styles.correctButtonText}>Correct Age Band</Text>
          </Pressable>
        ) : (
          <View style={styles.editSection}>
            <Text style={styles.editTitle}>Re-verify Birth Month & Year</Text>
            <Text style={styles.editSub}>
              Neutral gate required by Play Families Policy & COPPA rules.
            </Text>

            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Month (1-12)</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelectedMonth(Math.max(1, selectedMonth - 1))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>-</Text>
                  </Pressable>
                  <Text style={styles.valText}>{selectedMonth}</Text>
                  <Pressable
                    onPress={() => setSelectedMonth(Math.min(12, selectedMonth + 1))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Year</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelectedYear(selectedYear - 1)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>-</Text>
                  </Pressable>
                  <Text style={styles.valText}>{selectedYear}</Text>
                  <Pressable
                    onPress={() => setSelectedYear(selectedYear + 1)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={applyCorrection}>
                <Text style={styles.saveText}>Save Correction</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: t.text, marginLeft: 12 },
    scroll: { padding: 20 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: t.accentSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    bandTitle: { fontSize: 20, fontWeight: "700", color: t.text },
    bandSub: { fontSize: 13, color: t.textMuted, marginTop: 4, textAlign: "center" },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoBox: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    ruleText: { fontSize: 14, color: t.text, flex: 1 },
    correctButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.surface,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    correctButtonText: { fontSize: 16, fontWeight: "600", color: t.accent },
    editSection: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 20,
    },
    editTitle: { fontSize: 17, fontWeight: "700", color: t.text, marginBottom: 4 },
    editSub: { fontSize: 13, color: t.textMuted, marginBottom: 16 },
    pickerRow: { flexDirection: "row", gap: 16, marginBottom: 20 },
    pickerCol: { flex: 1 },
    pickerLabel: { fontSize: 13, color: t.textMuted, marginBottom: 6 },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.bg,
      borderRadius: 10,
      padding: 4,
      justifyContent: "space-between",
    },
    stepBtn: {
      width: 36,
      height: 36,
      backgroundColor: t.surface,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: { fontSize: 18, fontWeight: "700", color: t.text },
    valText: { fontSize: 16, fontWeight: "700", color: t.text },
    actionRow: { flexDirection: "row", gap: 12 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: t.bg,
      alignItems: "center",
    },
    cancelText: { fontSize: 15, color: t.textMuted, fontWeight: "600" },
    saveBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: t.primary,
      alignItems: "center",
    },
    saveText: { fontSize: 15, color: t.onPrimary, fontWeight: "600" },
  });
