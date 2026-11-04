import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Platform, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth, exchangeCodeForSession } from "../src/lib/auth";
import { useApi } from "../src/lib/api";
import { ensureProfileAfterAuth } from "./(onboarding)/auth";
import { getOnboardingState } from "../src/lib/onboarding-state";

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallbackScreen() {
  const auth = useAuth();
  const api = useApi();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn) return;

    void (async () => {
      try {
        const displayName = auth.user?.displayName ?? "You";
        await ensureProfileAfterAuth(api, displayName, auth.user?.email ?? null);
      } catch (e) {
        console.warn("[sso-callback] Failed to ensure profile:", e);
      }
      const state = getOnboardingState();
      if (state.completed) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(onboarding)/intent");
      }
    })();
  }, [auth.isLoaded, auth.isSignedIn, auth.user, api]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const searchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const code = params.code || searchParams?.get("code");
      const err = params.error_description || searchParams?.get("error_description");

      if (err) {
        setError(err);
        return;
      }

      if (code && !auth.isSignedIn) {
        exchangeCodeForSession(code).catch((e: any) => {
          console.warn("[sso-callback] exchangeCodeForSession:", e?.message);
        });
      }
    }
  }, [auth.isSignedIn, params.code]);

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ActivityIndicator size="large" color="#6366f1" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0f12",
    padding: 24,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
});
