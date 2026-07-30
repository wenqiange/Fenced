import { useEffect, useState, type ReactNode } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { AuthProvider } from "../src/lib/auth";
import { ApiProvider } from "../src/lib/api";
import {
  hydrateOnboarding,
  isOnboardingHydrated,
} from "../src/lib/onboarding-state";
import { hydrateAppState } from "../src/lib/local-store";
import { SyncBootstrap } from "../src/lib/sync/bootstrap";
import { PINE, PAPER } from "../src/lib/theme";

function Bootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isOnboardingHydrated());

  useEffect(() => {
    void Promise.all([hydrateOnboarding(), hydrateAppState()]).then(() =>
      setReady(true)
    );
  }, []);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={PINE} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ApiProvider>
        <Bootstrap>
          <SyncBootstrap />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="task/[id]"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="session-sheet"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="fence-hub"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="session"
              options={{
                presentation: "fullScreenModal",
                animation: "fade",
              }}
            />
          </Stack>
        </Bootstrap>
      </ApiProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
  },
});
