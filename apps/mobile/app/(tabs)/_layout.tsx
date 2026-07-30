import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Pressable } from "react-native";

const PINE = "#1F3D30";
const TIMBER = "#C08A4E";
const SLATE = "#5C6560";
const PAPER = "#FAF7F2";

function FenceButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fenceButton}>
      <View style={styles.fenceButtonInner}>
        <Ionicons name="shield" size={28} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PINE,
        tabBarInactiveTintColor: SLATE,
        tabBarStyle: {
          backgroundColor: PAPER,
          borderTopColor: "#E0DCD6",
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

const styles = StyleSheet.create({
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
    backgroundColor: PINE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
