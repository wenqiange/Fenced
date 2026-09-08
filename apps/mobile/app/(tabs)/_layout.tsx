import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Pressable } from "react-native";
import {
  useThemeColors,
  useThemedStyles,
  type ThemeColors,
} from "../../src/lib/theme";

function FenceButton({ onPress }: { onPress: () => void }) {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={styles.fenceButton}>
      <View style={styles.fenceButtonInner}>
        <Ionicons name="shield" size={28} color={t.onPrimary} />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const t = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          backgroundColor: t.bg,
          borderTopColor: t.borderStrong,
          height: 88,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fence"
        options={{
          title: "Fence",
          tabBarIcon: () => null,
          tabBarButton: () => (
            <FenceButton onPress={() => router.push("/session-sheet")} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    fenceButton: {
      top: -16,
      justifyContent: "center",
      alignItems: "center",
      width: 64,
      height: 64,
    },
    fenceButtonInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  });
