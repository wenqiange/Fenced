import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function PrivacyNoticeScreen() {
  const { onboarding } = useOnboarding();
  const isMinor = onboarding.ageBand === "child" || onboarding.ageBand === "teen";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isMinor ? "Child-Friendly Privacy Notice" : "Privacy Notice"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={32} color={PINE} />
          </View>
          <Text style={styles.title}>
            {isMinor
              ? "How Fenced Protects Your Focus & Privacy"
              : "Fenced Privacy Policy & Data Rights"}
          </Text>
          <Text style={styles.subTitle}>
            {isMinor
              ? "Written in plain language so you know exactly how your data is handled."
              : "Lawful basis: Contractual Necessity (GDPR Art. 6(1)(b)). Zero third-party data sales or behavioral profiling."}
          </Text>
        </View>

        {isMinor ? (
          <View style={styles.noticeList}>
            <View style={styles.noticeItem}>
              <Ionicons name="lock-closed-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>1. Your Data Stays Yours</Text>
                <Text style={styles.itemBody}>
                  Fenced only uses your data to run your focus sessions, keep track of your tasks, and display your streaks. We never sell your info to advertisers.
                </Text>
              </View>
            </View>

            <View style={styles.noticeItem}>
              <Ionicons name="analytics-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>2. No Tracking or Analytics</Text>
                <Text style={styles.itemBody}>
                  Product tracking and analytics are completely turned off for child and teen accounts. We don't watch what you click or record your screen.
                </Text>
              </View>
            </View>

            <View style={styles.noticeItem}>
              <Ionicons name="sparkles-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>3. AI Model Protection</Text>
                <Text style={styles.itemBody}>
                  No minor's data is ever sent to third-party AI companies or model providers. Your tasks are parsed locally on your device.
                </Text>
              </View>
            </View>

            <View style={styles.noticeItem}>
              <Ionicons name="download-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>4. Data Rights & Parent Control</Text>
                <Text style={styles.itemBody}>
                  You or your parent can export a copy of all your data or delete your account at any time with one tap in your profile settings.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noticeList}>
            <View style={styles.noticeItem}>
              <Ionicons name="document-text-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>Contractual Processing</Text>
                <Text style={styles.itemBody}>
                  Under GDPR Article 6(1)(b), we process task, session, and calendar data solely to provide the core Fenced service.
                </Text>
              </View>
            </View>

            <View style={styles.noticeItem}>
              <Ionicons name="shield-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>Zero Third-Party Advertising</Text>
                <Text style={styles.itemBody}>
                  Fenced contains no ads and collects no advertising identifiers (IDFA / Android Advertising ID).
                </Text>
              </View>
            </View>

            <View style={styles.noticeItem}>
              <Ionicons name="phone-portrait-outline" size={22} color={PINE} />
              <View style={styles.noticeTextCol}>
                <Text style={styles.itemTitle}>Local-First Architecture</Text>
                <Text style={styles.itemBody}>
                  App blocking tokens and screen time permissions remain on-device. iOS Screen Time metrics are rendered privately by Apple framework components.
                </Text>
              </View>
            </View>
          </View>
        )}
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
  title: { fontSize: 18, fontWeight: "700", color: INK, textAlign: "center" },
  subTitle: { fontSize: 13, color: SLATE, marginTop: 4, textAlign: "center" },
  noticeList: { gap: 14 },
  noticeItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    gap: 14,
    alignItems: "flex-start",
  },
  noticeTextCol: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: "700", color: INK, marginBottom: 4 },
  itemBody: { fontSize: 14, color: SLATE, lineHeight: 20 },
});
