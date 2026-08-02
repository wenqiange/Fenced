import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppState } from "../../src/hooks/use-app-state";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function ExportDataScreen() {
  const { state } = useAppState();
  const { onboarding } = useOnboarding();
  const [exportedJson, setExportedJson] = useState<string | null>(null);

  const generateExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      onboarding,
      appState: state,
      version: "0.0.1",
    };
    setExportedJson(JSON.stringify(data, null, 2));
  };

  const copyToClipboard = () => {
    Alert.alert(
      "Data Generated",
      "Full JSON export generated successfully. You can inspect or save it below."
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Export Data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="download" size={32} color={PINE} />
          </View>
          <Text style={styles.title}>Self-Service Data Export</Text>
          <Text style={styles.subTitle}>
            Download a complete machine-readable JSON copy of your profile, tasks, session history, and settings.
          </Text>
        </View>

        {!exportedJson ? (
          <Pressable style={styles.generateBtn} onPress={generateExport}>
            <Ionicons name="code-download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.generateText}>Generate JSON Export</Text>
          </Pressable>
        ) : (
          <View style={styles.exportContainer}>
            <View style={styles.exportHeader}>
              <Text style={styles.exportTitle}>Generated Data Package</Text>
              <Pressable style={styles.copyBtn} onPress={copyToClipboard}>
                <Ionicons name="copy-outline" size={16} color={PINE} />
                <Text style={styles.copyText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.jsonBox}>
              <Text style={styles.jsonText}>{exportedJson}</Text>
            </ScrollView>
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
  title: { fontSize: 18, fontWeight: "700", color: INK },
  subTitle: { fontSize: 13, color: SLATE, marginTop: 4, textAlign: "center" },
  generateBtn: {
    flexDirection: "row",
    backgroundColor: PINE,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  exportContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
  },
  exportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exportTitle: { fontSize: 16, fontWeight: "700", color: INK },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SAND,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyText: { fontSize: 13, fontWeight: "600", color: PINE },
  jsonBox: {
    maxHeight: 300,
    backgroundColor: PAPER,
    borderRadius: 8,
    padding: 12,
  },
  jsonText: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, color: INK },
});
