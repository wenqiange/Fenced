import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth, isSupabaseConfigured } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import {
  pullOnboardingProfile,
  pushOnboardingProfile,
} from "../../src/lib/sync/profile";
import { getOnboardingState } from "../../src/lib/onboarding-state";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

type Mode = "sign-in" | "sign-up";

export async function ensureProfileAfterAuth(
  api: ReturnType<typeof useApi>,
  displayName: string,
  email: string | null
) {
  await pushOnboardingProfile(api, displayName, email);
  await pullOnboardingProfile(api);
}

function DevAuthScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();
  const [busy, setBusy] = useState(false);

  async function continueDev(displayName = "Dev user") {
    setBusy(true);
    auth.signInDev(displayName);
    await ensureProfileAfterAuth(api, displayName, "dev@fenced.local");
    setBusy(false);
    const state = getOnboardingState();
    if (state.completed) {
      router.replace("/(tabs)");
    } else {
      router.push("/(onboarding)/intent");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>Fenced</Text>
        <Text style={styles.title}>Sign in to continue</Text>
        <Text style={styles.subtitle}>
          Supabase keys aren&apos;t set — continue with local dev sign-in for now.
        </Text>

        <Pressable
          style={styles.primary}
          onPress={() => void continueDev("Dev user")}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={t.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Continue as local user</Text>
          )}
        </Pressable>

        <Text style={styles.devHint}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable real auth.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function SupabaseAuthScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = finishing || submitting;

  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || finishing) return;
    void (async () => {
      try {
        setFinishing(true);
        const displayName = auth.user?.displayName ?? "You";
        try {
          await ensureProfileAfterAuth(api, displayName, auth.user?.email ?? null);
        } catch (e) {
          console.warn("[auth] Failed to ensure profile:", e);
        }
        const state = getOnboardingState();
        if (state.completed) {
          router.replace("/(tabs)");
        } else {
          router.push("/(onboarding)/intent");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to finalize authentication");
        setFinishing(false);
      }
    })();
  }, [auth.isLoaded, auth.isSignedIn, auth.user, api, finishing]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await action();
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  const handleSubmit = () =>
    run(async () => {
      if (mode === "sign-in") {
        await auth.signInWithPassword(email.trim(), password);
      } else {
        const { needsEmailConfirm } = await auth.signUpWithPassword(email.trim(), password);
        if (needsEmailConfirm) setNotice("Check your email to confirm your account, then sign in.");
      }
    });

  if (!auth.isLoaded || (auth.isSignedIn && finishing)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {router.canGoBack() && (
            <Pressable
              style={{ paddingVertical: 8, marginBottom: 12, alignSelf: "flex-start" }}
              onPress={() => router.back()}
            >
              <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>← Back</Text>
            </Pressable>
          )}

          <Text style={styles.brand}>Fenced</Text>
          <Text style={styles.title}>
            {mode === "sign-in" ? "Sign in to continue" : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            Sign in to sync tasks, calendar, and focus sessions.
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={t.textMuted}
            secureTextEntry
            autoComplete={mode === "sign-in" ? "password" : "new-password"}
          />
          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={() => void handleSubmit()}
            disabled={busy || !email.trim() || !password}
          >
            {busy ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={styles.primaryText}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={() => void run(auth.signInWithGoogle)}
            disabled={busy}
          >
            <Text style={styles.linkText}>Continue with Google</Text>
          </Pressable>

          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.linkText}>
              {mode === "sign-in"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>

          <Pressable
            style={{ marginTop: 16, paddingVertical: 10, alignItems: "center" }}
            onPress={() => {
              const state = getOnboardingState();
              if (state.completed) {
                router.replace("/(tabs)");
              } else {
                router.push("/(onboarding)/intent");
              }
            }}
          >
            <Text style={{ color: t.textMuted, fontSize: 14 }}>
              Continue in practice mode (Offline)
            </Text>
          </Pressable>

          {notice ? <Text style={styles.subtitle}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function AuthScreen() {
  return isSupabaseConfigured() ? <SupabaseAuthScreen /> : <DevAuthScreen />;
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },
    brand: {
      fontSize: 18,
      fontWeight: "700",
      color: t.accent,
      letterSpacing: 1,
      marginBottom: 20,
    },
    title: { fontSize: 28, fontWeight: "700", color: t.text },
    subtitle: {
      fontSize: 15,
      color: t.textMuted,
      marginTop: 10,
      lineHeight: 22,
      marginBottom: 28,
    },
    input: {
      backgroundColor: t.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: t.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
    },
    primary: {
      backgroundColor: t.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 4,
    },
    primaryText: { color: t.onPrimary, fontWeight: "700", fontSize: 16 },
    disabled: { opacity: 0.6 },
    secondary: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
    },
    linkBtn: { alignItems: "center", paddingVertical: 14 },
    linkText: { fontSize: 15, fontWeight: "600", color: t.accent },
    error: {
      marginTop: 12,
      color: t.error,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    devHint: {
      marginTop: 24,
      fontSize: 13,
      color: t.textMuted,
      textAlign: "center",
      lineHeight: 18,
      backgroundColor: t.accentSoft,
      padding: 12,
      borderRadius: 12,
    },
  });
