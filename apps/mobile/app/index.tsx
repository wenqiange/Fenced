import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useOnboarding } from "../src/hooks/use-onboarding";
import { useAuth } from "../src/lib/auth";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

export default function Index() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { ready, onboarding } = useOnboarding();
  const auth = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if ((!ready || !auth.isLoaded) && !timedOut) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return <Redirect href="/(onboarding)/auth" />;
  }

  if (onboarding.completed || onboarding.intent) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(onboarding)" />;
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    boot: {
      flex: 1,
      backgroundColor: t.bg,
      alignItems: "center",
      justifyContent: "center",
    },
  });
