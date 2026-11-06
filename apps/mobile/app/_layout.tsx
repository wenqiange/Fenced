import { useEffect, useState, type ReactNode } from "react";
import { Stack } from "expo-router";
export { ErrorBoundary } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActiveSessionBanner } from "../src/components/session/ActiveSessionBanner";
import { AuthProvider } from "../src/lib/auth";
import { ApiProvider } from "../src/lib/api";
import {
  hydrateOnboarding,
  isOnboardingHydrated,
} from "../src/lib/onboarding-state";
import { hydrateAppState } from "../src/lib/local-store";
import { SyncBootstrap } from "../src/lib/sync/bootstrap";
import { SessionRuntime } from "../src/lib/session-runtime";
import {
  ThemeProvider,
  useThemeColors,
  useThemedStyles,
  type ThemeColors,
} from "../src/lib/theme";

function Bootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isOnboardingHydrated());
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    let mounted = true;
    // Fallback timer: ensure we never hang on splash/loading if async storage stalls
    const timeout = setTimeout(() => {
      if (mounted) {
        setReady(true);
      }
    }, 1500);

    void Promise.all([hydrateOnboarding(), hydrateAppState()])
      .catch((err) => {
        console.warn("[boot] Hydration error:", err);
      })
      .finally(() => {
        if (mounted) {
          clearTimeout(timeout);
          setReady(true);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

/** Inside ThemeProvider so the chrome (status bar, screen backgrounds) follows the palette. */
function ThemedRoot() {
  const t = useThemeColors();

  return (
    <Bootstrap>
      <SyncBootstrap />
      <SessionRuntime />
      <StatusBar style={t.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Without this, push/modal transitions flash the default white.
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="sso-callback" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="time-block"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="planning-chat"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="session-sheet"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="fence-hub" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile/circles" />
        <Stack.Screen name="circle/[id]" />
        <Stack.Screen
          name="tutorial"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="session"
          options={{
            presentation: "fullScreenModal",
            animation: "fade",
          }}
        />
      </Stack>
      <ActiveSessionBanner />
    </Bootstrap>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <AuthProvider>
      <ApiProvider>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </ApiProvider>
    </AuthProvider>
    </GestureHandlerRootView>
  );
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
