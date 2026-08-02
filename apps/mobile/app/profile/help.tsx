import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function HelpScreen() {
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
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Feedback</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="help-circle" size={32} color={PINE} />
          </View>
          <Text style={styles.title}>Fenced Support & Guides</Text>
          <Text style={styles.subTitle}>
            Everything you need to know about app blocking, strict mode, and scheduled focus.
          </Text>
        </View>

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
              placeholderTextColor={SLATE}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAE5DF",
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: INK, marginLeft: 12 },
  scroll: { padding: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: SAND,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: INK },
  subTitle: { fontSize: 13, color: SLATE, marginTop: 4, textAlign: "center" },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: SLATE,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  faqList: { gap: 12 },
  faqItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  faqQ: { fontSize: 15, fontWeight: "700", color: INK, marginBottom: 4 },
  faqA: { fontSize: 13, color: SLATE, lineHeight: 18 },
  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  textArea: {
    backgroundColor: PAPER,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: INK,
    textAlignVertical: "top",
    minHeight: 80,
  },
  sendBtn: {
    backgroundColor: PINE,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  sendText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
