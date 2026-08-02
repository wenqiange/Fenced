import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppState } from "../../src/hooks/use-app-state";
import { updateUserSettings } from "../../src/lib/local-store";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function AppearanceScreen() {
  const { state } = useAppState();
  const currentTheme = state.settings.theme;

  const setTheme = (theme: "paper" | "slate" | "system") => {
    updateUserSettings({ theme });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Appearance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="moon" size={32} color={PINE} />
          </View>
          <Text style={styles.title}>Theme & Visual Style</Text>
          <Text style={styles.subTitle}>
            Choose between Paper light, Slate dark, or system default.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme Selection</Text>
          <View style={styles.list}>
            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => setTheme("paper")}
            >
              <Ionicons name="sunny-outline" size={22} color={PINE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Paper Light</Text>
                <Text style={styles.rowSub}>Warm paper tones & dark pine accents</Text>
              </View>
              {currentTheme === "paper" && (
                <Ionicons name="checkmark-circle" size={22} color={PINE} />
              )}
            </Pressable>

            <Pressable
              style={[styles.row, styles.rowBorder]}
              onPress={() => setTheme("slate")}
            >
              <Ionicons name="moon-outline" size={22} color={PINE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Slate Dark</Text>
                <Text style={styles.rowSub}>Deep slate background for night focus</Text>
              </View>
              {currentTheme === "slate" && (
                <Ionicons name="checkmark-circle" size={22} color={PINE} />
              )}
            </Pressable>

            <Pressable style={styles.row} onPress={() => setTheme("system")}>
              <Ionicons name="phone-portrait-outline" size={22} color={PINE} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>System Default</Text>
                <Text style={styles.rowSub}>Matches your device's system appearance</Text>
              </View>
              {currentTheme === "system" && (
                <Ionicons name="checkmark-circle" size={22} color={PINE} />
              )}
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
  list: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F0ECE6" },
  rowTitle: { fontSize: 16, fontWeight: "600", color: INK },
  rowSub: { fontSize: 13, color: SLATE, marginTop: 2 },
});
