import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FenceStylePicker } from "../../src/components/fence";
import { SectionHeader } from "../../src/components/ui";
import {
  useThemeColors,
  useThemedStyles,
  useThemePreference,
  type ThemeColors,
  type ThemePreference,
} from "../../src/lib/theme";

const OPTIONS: {
  id: ThemePreference;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}[] = [
  {
    id: "paper",
    icon: "sunny-outline",
    title: "Paper Light",
    detail: "Warm paper tones & dark pine accents",
  },
  {
    id: "slate",
    icon: "moon-outline",
    title: "Slate Dark",
    detail: "Deep slate background for night focus",
  },
  {
    id: "system",
    icon: "phone-portrait-outline",
    title: "System Default",
    detail: "Matches your device's system appearance",
  },
];

export default function AppearanceScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { preference, setPreference } = useThemePreference();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Appearance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={t.scheme === "dark" ? "moon" : "sunny"}
              size={32}
              color={t.accent}
            />
          </View>
          <Text style={styles.title}>Theme & Visual Style</Text>
          <Text style={styles.subTitle}>
            Choose between Paper light, Slate dark, or system default.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme Selection</Text>
          <View style={styles.list}>
            {OPTIONS.map((option, i) => (
              <Pressable
                key={option.id}
                style={[styles.row, i < OPTIONS.length - 1 && styles.rowBorder]}
                onPress={() => setPreference(option.id)}
              >
                <Ionicons name={option.icon} size={22} color={t.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{option.title}</Text>
                  <Text style={styles.rowSub}>{option.detail}</Text>
                </View>
                {preference === option.id && (
                  <Ionicons name="checkmark-circle" size={22} color={t.accent} />
                )}
              </Pressable>
            ))}
          </View>
          {preference === "system" && (
            <Text style={styles.resolvedNote}>
              Your device is currently in{" "}
              {t.scheme === "dark" ? "dark" : "light"} mode, so Fenced is showing{" "}
              {t.scheme === "dark" ? "Slate Dark" : "Paper Light"}.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <View style={styles.previewSwatch} />
              <Text style={styles.previewLabel}>Surface & body text</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewSwatch, styles.previewSwatchAccent]} />
              <Text style={styles.previewLabel}>Accent & filled actions</Text>
            </View>
            <View style={styles.previewRow}>
              <View style={[styles.previewSwatch, styles.previewSwatchAlt]} />
              <Text style={styles.previewLabel}>Timber highlights</Text>
            </View>
          </View>
        </View>

        <SectionHeader title="Fence style" />
        <FenceStylePicker />
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
    resolvedNote: { fontSize: 12, color: t.textMuted, marginTop: 8, lineHeight: 17 },
    previewCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    previewSwatch: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.borderStrong,
    },
    previewSwatchAccent: { backgroundColor: t.primary, borderColor: t.primary },
    previewSwatchAlt: { backgroundColor: t.accentAlt, borderColor: t.accentAlt },
    previewLabel: { fontSize: 14, color: t.text },
  });
