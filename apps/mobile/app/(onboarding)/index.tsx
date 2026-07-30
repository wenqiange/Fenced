import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

export default function HookScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>Fenced</Text>
        <View style={styles.iconContainer}>
          <Ionicons name="shield" size={64} color={PINE} />
        </View>

        <Text style={styles.title}>Build a fence{"\n"}around your focus</Text>
        <Text style={styles.subtitle}>
          Block distracting apps, manage your tasks, and own your calendar — all
          in one place.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.push("/(onboarding)/age")}
        >
          <Text style={styles.buttonText}>Get started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: PINE,
    letterSpacing: 1,
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: SAND,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: INK,
    textAlign: "center",
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 17,
    color: SLATE,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  button: {
    backgroundColor: PINE,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginTop: 48,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
});
