import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function PrivacyScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { onboarding } = useOnboarding();
  const isMinor = onboarding.ageBand === "child" || onboarding.ageBand === "teen";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy & Data Control</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>Privacy First Architecture</Text>
          <Text style={styles.subTitle}>
            Fenced is built around local-first storage, contractual necessity, and total user ownership over data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Declarations</Text>
          <View style={styles.list}>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push("/profile/privacy-notice")}
            >
              <Ionicons name="document-text-outline" size={22} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Privacy Notice</Text>
                <Text style={styles.rowSub}>
                  {isMinor ? "Child-Friendly Privacy Explanation" : "Standard GDPR & COPPA Policy"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Pressable>

            <Pressable
              style={styles.row}
              onPress={() => router.push("/profile/age-band")}
            >
              <Ionicons name="people-outline" size={22} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Age Band & Compliance</Text>
                <Text style={styles.rowSub}>
                  Band: {onboarding.ageBand?.toUpperCase() ?? "ADULT"} · Gate: {onboarding.assuranceMethod ?? "Neutral"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Rights</Text>
          <View style={styles.list}>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => router.push("/profile/export")}
            >
              <Ionicons name="download-outline" size={22} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Export All Data</Text>
                <Text style={styles.rowSub}>Download machine-readable JSON copy of tasks, stats & settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Pressable>

            <Pressable
              style={styles.row}
              onPress={() => router.push("/profile/delete")}
            >
              <Ionicons name="trash-outline" size={22} color={t.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: t.error }]}>
                  Delete Account & Wipe Data
                </Text>
                <Text style={styles.rowSub}>Cascading erasure of local storage and backend database</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </Pressable>
          </View>
        </View>
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
    title: { fontSize: 18, fontWeight: "700", color: t.text },
    subTitle: { fontSize: 13, color: t.textMuted, marginTop: 4, textAlign: "center" },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    list: {
      backgroundColor: t.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    rowTitle: { fontSize: 16, fontWeight: "600", color: t.text },
    rowSub: { fontSize: 13, color: t.textMuted, marginTop: 2 },
  });
