import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../src/lib/auth";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function ProfileDetailsScreen() {
  const auth = useAuth();
  const { onboarding, updateState } = useOnboarding();
  const [displayName, setDisplayName] = useState(
    auth.user?.displayName ?? onboarding.displayName ?? "Student"
  );
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    setSaving(true);
    await updateState({ displayName });
    setSaving(false);
    Alert.alert("Profile Updated", "Your display name has been saved.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={PINE} />
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileMeta}>
            {auth.isSignedIn ? "Signed in with Clerk" : "Dev Scaffolding User"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Name</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor={SLATE}
            />
            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={saveName}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <View style={styles.list}>
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={styles.label}>Auth Provider</Text>
              <Text style={styles.val}>{auth.mode === "clerk" ? "Clerk" : "Dev Auth"}</Text>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={styles.label}>Age Band</Text>
              <Text style={styles.val}>{onboarding.ageBand?.toUpperCase() ?? "ADULT"}</Text>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <Text style={styles.label}>Setup Status</Text>
              <Text style={styles.val}>{onboarding.completed ? "Complete" : "In Progress"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Practice Mode</Text>
              <Text style={styles.val}>{onboarding.practiceMode ? "Enabled" : "Disabled"}</Text>
            </View>
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
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SAND,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileName: { fontSize: 20, fontWeight: "700", color: INK },
  profileMeta: { fontSize: 13, color: SLATE, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: SLATE,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: INK,
  },
  saveBtn: {
    backgroundColor: PINE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  list: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F0ECE6" },
  label: { fontSize: 15, color: INK },
  val: { fontSize: 14, fontWeight: "600", color: SLATE },
});
