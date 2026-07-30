import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  INTENT_DEFAULTS,
  setIntent,
  type Intent,
} from "../../src/lib/onboarding-state";
import { PINE, PAPER, INK, SLATE } from "../../src/lib/theme";

const ORDER: Intent[] = ["study", "deep-work", "phone-less"];

export default function IntentScreen() {
  function choose(intent: Intent) {
    setIntent(intent);
    router.push("/(onboarding)/sources");
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.kicker}>Setup</Text>
      <Text style={styles.title}>What are you trying to do?</Text>
      <Text style={styles.subtitle}>
        This sets your default session length and fence — you can change it later.
      </Text>

      <View style={styles.list}>
        {ORDER.map((id) => {
          const item = INTENT_DEFAULTS[id];
          return (
            <Pressable key={id} style={styles.card} onPress={() => choose(id)}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardDetail}>{item.description}</Text>
              <Text style={styles.cardMeta}>{item.sessionMinutes} min default</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, padding: 24 },
  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: INK },
  subtitle: { fontSize: 15, color: SLATE, marginTop: 10, lineHeight: 22, marginBottom: 24 },
  list: { gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: INK },
  cardDetail: { fontSize: 14, color: SLATE, marginTop: 6, lineHeight: 20 },
  cardMeta: { fontSize: 13, fontWeight: "600", color: PINE, marginTop: 12 },
});
