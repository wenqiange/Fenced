import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

/** Hidden tab route — center CTA opens session sheet instead. */
export default function FenceTabPlaceholder() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  useEffect(() => {
    router.replace("/(tabs)");
  }, []);

  return (
    <View style={styles.boot}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    boot: { flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" },
  });
