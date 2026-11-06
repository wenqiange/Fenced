import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function HelpScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setFeedback("");
      Alert.alert("Feedback Received", "Thank you for helping us improve Fenced!");
    }, 500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Feedback</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="help-circle" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>Fenced Support & Guides</Text>
          <Text style={styles.subTitle}>
            Everything you need to know about app blocking, strict mode, and scheduled focus.
          </Text>
        </View>

        <Pressable
          style={styles.tourCard}
          onPress={() => router.push("/tutorial")}
          accessibilityRole="button"
          accessibilityLabel="Launch Interactive App Tour"
        >
          <View style={styles.tourIconCircle}>
            <Ionicons name="sparkles" size={24} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tourTitle}>Interactive App Tour</Text>
            <Text style={styles.tourSubtitle}>
              Replay the 4-step walkthrough: shield mechanics, agenda integration, emergency passes, and Class Mode.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.accent} />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>How does app shielding work?</Text>
              <Text style={styles.faqA}>
                On iOS, Fenced uses Apple Screen Time Family Controls to shield chosen apps without reading app names. On Android, Fenced monitors foreground apps via UsageStatsManager.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>What is Strict Mode delay?</Text>
              <Text style={styles.faqA}>
                Strict mode imposes an unskippable countdown delay chosen at session arm time before you can edit or end a running fence session.
              </Text>
            </View>

            <View style={styles.faqItem}>
              <Text style={styles.faqQ}>How do Fenced Hours work?</Text>
              <Text style={styles.faqA}>
                Fenced Hours are recurring daily focus schedules (e.g. 14:00 to 17:00 on weekdays). You can skip today's schedule anytime from the Today tab.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Feedback</Text>
          <View style={styles.feedbackCard}>
            <TextInput
              style={styles.textArea}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Tell us what's working well or what features you'd like..."
              placeholderTextColor={t.textMuted}
              multiline
              numberOfLines={4}
            />
            <Pressable
              style={[styles.sendBtn, (!feedback.trim() || submitting) && { opacity: 0.5 }]}
              onPress={submitFeedback}
              disabled={!feedback.trim() || submitting}
            >
              <Text style={styles.sendText}>Submit Feedback</Text>
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
    tourCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: t.accentSoft,
    },
    tourIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.accentSoft,
      justifyContent: "center",
      alignItems: "center",
    },
    tourTitle: { fontSize: 16, fontWeight: "700", color: t.text },
    tourSubtitle: { fontSize: 13, color: t.textMuted, marginTop: 2, lineHeight: 18 },
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
    faqList: { gap: 12 },
    faqItem: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 16,
    },
    faqQ: { fontSize: 15, fontWeight: "700", color: t.text, marginBottom: 4 },
    faqA: { fontSize: 13, color: t.textMuted, lineHeight: 18 },
    feedbackCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    textArea: {
      backgroundColor: t.bg,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: t.text,
      textAlignVertical: "top",
      minHeight: 80,
    },
    sendBtn: {
      backgroundColor: t.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    sendText: { fontSize: 14, fontWeight: "600", color: t.onPrimary },
  });
