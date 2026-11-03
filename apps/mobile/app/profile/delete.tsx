import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { resetAppState } from "../../src/lib/local-store";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useAuth } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import { stopAmbient } from "../../src/lib/sound-engine";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

export default function DeleteAccountScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { resetOnboarding } = useOnboarding();
  const auth = useAuth();
  const api = useApi();
  const [deleting, setDeleting] = useState(false);

  const confirmDeletion = () => {
    Alert.alert(
      "Permanently Delete Account?",
      "This action cannot be undone. All your tasks, session statistics, streak data, and settings will be permanently erased.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Permanently", style: "destructive", onPress: executeDeletion },
      ]
    );
  };

  const executeDeletion = async () => {
    setDeleting(true);
    // Server first: if it fails, keep the local copy and say so. Wiping the
    // phone while the account survives would look like deletion but isn't.
    if (auth.isSignedIn) {
      try {
        await api.user.deleteAccount.mutate();
      } catch (err) {
        // Only "no server profile yet" (never synced) means nothing to delete
        // there. An expired session must not be mistaken for that.
        const noProfile = (err as { message?: string })?.message === "Complete profile setup first";
        if (!noProfile) {
          setDeleting(false);
          Alert.alert(
            "Couldn't delete your account",
            "We couldn't reach the server, so nothing was deleted. Check your connection and try again.",
          );
          return;
        }
      }
    }
    await stopAmbient(0);
    await resetAppState();
    await resetOnboarding();
    await auth.signOut();
    setDeleting(false);
    router.replace("/(onboarding)");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={32} color={t.error} />
          </View>
          <Text style={styles.title}>Permanently Delete Account</Text>
          <Text style={styles.subTitle}>
            Cascading deletion as required by COPPA & GDPR Article 17.
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>What happens when you delete:</Text>
          <View style={styles.warningList}>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color={t.error} />
              <Text style={styles.warningText}>All local tasks, notes & estimates are deleted</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color={t.error} />
              <Text style={styles.warningText}>Focus session history & shield hits wiped</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color={t.error} />
              <Text style={styles.warningText}>Fence line streak reset to zero</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color={t.error} />
              <Text style={styles.warningText}>Backend database records permanently deleted</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
          onPress={confirmDeletion}
          disabled={deleting}
        >
          <Ionicons name="trash" size={20} color={t.onPrimary} />
          <Text style={styles.deleteText}>Delete Account & Data</Text>
        </Pressable>
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
      backgroundColor: t.errorSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "700", color: t.error },
    subTitle: { fontSize: 13, color: t.textMuted, marginTop: 4, textAlign: "center" },
    warningCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    warningTitle: { fontSize: 15, fontWeight: "700", color: t.text, marginBottom: 12 },
    warningList: { gap: 10 },
    warningRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    warningText: { fontSize: 14, color: t.text },
    deleteBtn: {
      flexDirection: "row",
      backgroundColor: t.error,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    deleteText: { fontSize: 16, fontWeight: "600", color: t.onPrimary },
  });
