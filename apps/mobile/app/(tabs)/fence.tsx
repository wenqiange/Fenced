import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { PAPER, PINE } from "../../src/lib/theme";

/** Hidden tab route — center CTA opens session sheet instead. */
export default function FenceTabPlaceholder() {
  useEffect(() => {
    router.replace("/(tabs)");
  }, []);

  return (
    <View style={styles.boot}>
      <ActivityIndicator color={PINE} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: PAPER, alignItems: "center", justifyContent: "center" },
});
