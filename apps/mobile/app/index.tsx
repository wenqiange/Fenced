import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useOnboarding } from "../src/hooks/use-onboarding";
import { PINE, PAPER } from "../src/lib/theme";

export default function Index() {
  const { ready, onboarding } = useOnboarding();

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={PINE} size="large" />
      </View>
    );
  }

  if (!onboarding.completed) {
    return <Redirect href="/(onboarding)" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
  },
});
