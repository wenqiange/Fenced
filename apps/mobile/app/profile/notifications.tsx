import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppState } from "../../src/hooks/use-app-state";
import { updateUserSettings } from "../../src/lib/local-store";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function NotificationsScreen() {
  const { state } = useAppState();
  const notifs = state.settings.notifications;

  const toggleSetting = (key: keyof typeof notifs) => {
    updateUserSettings({
      notifications: {
        ...notifs,
        [key]: !notifs[key],
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={32} color={PINE} />
          </View>
          <Text style={styles.title}>Notification Preferences</Text>
          <Text style={styles.subTitle}>
            Fenced notifications are non-coercive and descriptive to support healthy focus habits.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminders & Alerts</Text>
          <View style={styles.list}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Session Reminders</Text>
                <Text style={styles.rowSub}>Alert when a planned focus session begins</Text>
              </View>
              <Switch
                value={notifs.sessionReminders}
                onValueChange={() => toggleSetting("sessionReminders")}
                trackColor={{ false: "#EAE5DF", true: PINE }}
              />
            </View>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Streak Preservation</Text>
                <Text style={styles.rowSub}>Gentle reminder before your fence line breaks</Text>
              </View>
              <Switch
                value={notifs.streakAlerts}
                onValueChange={() => toggleSetting("streakAlerts")}
                trackColor={{ false: "#EAE5DF", true: PINE }}
              />
            </View>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Scheduled Fenced Hours</Text>
                <Text style={styles.rowSub}>Notify 5 minutes before scheduled blocking starts</Text>
              </View>
              <Switch
                value={notifs.scheduledHoursAlerts}
                onValueChange={() => toggleSetting("scheduledHoursAlerts")}
                trackColor={{ false: "#EAE5DF", true: PINE }}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Daily Focus Summary</Text>
                <Text style={styles.rowSub}>Evening report of focus hours and shield hits</Text>
              </View>
              <Switch
                value={notifs.dailySummary}
                onValueChange={() => toggleSetting("dailySummary")}
                trackColor={{ false: "#EAE5DF", true: PINE }}
              />
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
