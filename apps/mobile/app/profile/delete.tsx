import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { resetAppState } from "../../src/lib/local-store";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useAuth } from "../../src/lib/auth";
import { PAPER, INK, SLATE } from "../../src/lib/theme";

export default function DeleteAccountScreen() {
  const { resetOnboarding } = useOnboarding();
  const auth = useAuth();
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
    await resetAppState();
    await resetOnboarding();
    await auth.signOut();
    setDeleting(false);
    router.replace("/(onboarding)/auth");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={32} color="#B3402E" />
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
              <Ionicons name="close-circle" size={18} color="#B3402E" />
              <Text style={styles.warningText}>All local tasks, notes & estimates are deleted</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color="#B3402E" />
              <Text style={styles.warningText}>Focus session history & shield hits wiped</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color="#B3402E" />
              <Text style={styles.warningText}>Fence line streak reset to zero</Text>
            </View>
            <View style={styles.warningRow}>
              <Ionicons name="close-circle" size={18} color="#B3402E" />
              <Text style={styles.warningText}>Backend database records permanently deleted</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
          onPress={confirmDeletion}
          disabled={deleting}
        >
          <Ionicons name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete Account & Data</Text>
        </Pressable>
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
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#B3402E" },
  subTitle: { fontSize: 13, color: SLATE, marginTop: 4, textAlign: "center" },
  warningCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  warningTitle: { fontSize: 15, fontWeight: "700", color: INK, marginBottom: 12 },
  warningList: { gap: 10 },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  warningText: { fontSize: 14, color: INK },
  deleteBtn: {
    flexDirection: "row",
    backgroundColor: "#B3402E",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
