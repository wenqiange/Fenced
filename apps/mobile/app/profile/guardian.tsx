import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function GuardianScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { onboarding, updateState } = useOnboarding();
  const [email, setEmail] = useState(onboarding.guardianEmail ?? "");
  const [sending, setSending] = useState(false);

  const resendNotice = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid guardian email address.");
      return;
    }
    setSending(true);
    await updateState({ guardianEmail: email });
    setSending(false);
    Alert.alert(
      "Notice Sent",
      `COPPA Direct Consent Notice re-sent to ${email}. Check parent inbox for verification link.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Parental Consent & Control</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>COPPA Guardian Notice</Text>
          <Text style={styles.subTitle}>
            For users under 13, US law requires verifiable parental notice and consent before server syncing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consent Status</Text>
          <View style={styles.statusBox}>
            <Ionicons name="alert-circle" size={24} color={t.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Pending Guardian Verification</Text>
              <Text style={styles.statusDesc}>
                Account operating in local-first mode. Data is stored on your device and will sync after guardian approval.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guardian Contact Email</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="parent@example.com"
              placeholderTextColor={t.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.resendBtn, sending && { opacity: 0.5 }]}
              onPress={resendNotice}
              disabled={sending}
            >
              <Text style={styles.resendText}>Resend Notice</Text>
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
    statusBox: {
      flexDirection: "row",
      backgroundColor: t.warningSoft,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      alignItems: "flex-start",
    },
    statusTitle: { fontSize: 16, fontWeight: "700", color: t.warning },
    statusDesc: { fontSize: 13, color: t.text, marginTop: 2, lineHeight: 18 },
    inputCard: {
      flexDirection: "row",
      backgroundColor: t.surface,
      borderRadius: 12,
      padding: 8,
      alignItems: "center",
      gap: 8,
    },
    input: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: t.text,
    },
    resendBtn: {
      backgroundColor: t.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
    },
    resendText: { fontSize: 13, fontWeight: "600", color: t.onPrimary },
  });
