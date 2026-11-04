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
import { useAuth, isClerkConfigured } from "../../src/lib/auth";
import { useApi } from "../../src/lib/api";
import {
  pullOnboardingProfile,
  pushOnboardingProfile,
} from "../../src/lib/sync/profile";
import { getOnboardingState } from "../../src/lib/onboarding-state";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

type Mode = "sign-in" | "sign-up";

async function ensureProfileAfterAuth(
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
          Clerk keys aren&apos;t set — continue with local dev sign-in for now.
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
          Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to enable real Clerk auth.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function ClerkAuthScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const auth = useAuth();
  const api = useApi();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSignIn, useSignUp } = require("@clerk/expo");
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const busy = finishing || submitting;

  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || finishing) return;
    void (async () => {
      setFinishing(true);
      const displayName = auth.user?.displayName ?? "You";
      await ensureProfileAfterAuth(api, displayName, auth.user?.email ?? null);
      const state = getOnboardingState();
      if (state.completed) {
        router.replace("/(tabs)");
      } else {
        router.push("/(onboarding)/intent");
      }
    })();
  }, [auth.isLoaded, auth.isSignedIn, auth.user, api, finishing]);

  function pickErrorMessage(err: any): string {
    return (
      err?.errors?.[0]?.longMessage ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "An unexpected error occurred"
    );
  }

  async function handleSignIn() {
    if (!isSignInLoaded || !signIn) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        if (setSignInActive) {
          await setSignInActive({ session: result.createdSessionId });
        }
      } else if (
        result.status === "needs_first_factor" ||
        result.status === "needs_second_factor"
      ) {
        if (signIn.prepareFirstFactor) {
          await signIn.prepareFirstFactor({ strategy: "email_code" });
        }
        setVerifying(true);
      } else {
        setError(`Additional verification required: ${result.status}`);
      }
    } catch (err: any) {
      setError(pickErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (!isSignUpLoaded || !signUp) return;
    setError(null);
    setSubmitting(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      if (signUp.prepareEmailAddressVerification) {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      }
      setVerifying(true);
    } catch (err: any) {
      setError(pickErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        if (!isSignUpLoaded || !signUp) return;
        const result = await signUp.attemptEmailAddressVerification({
          code: code.trim(),
        });
        if (result.status === "complete") {
          if (setSignUpActive) {
            await setSignUpActive({ session: result.createdSessionId });
          }
        } else {
          setError(`Sign up not complete: ${result.status}`);
        }
      } else {
        if (!isSignInLoaded || !signIn) return;
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: code.trim(),
        });
        if (result.status === "complete") {
          if (setSignInActive) {
            await setSignInActive({ session: result.createdSessionId });
          }
        } else {
          setError(`Sign in not complete: ${result.status}`);
        }
      }
    } catch (err: any) {
      setError(pickErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

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
            {verifying
              ? "Check your email"
              : mode === "sign-in"
                ? "Sign in to continue"
                : "Create your account"}
          </Text>
          <Text style={styles.subtitle}>
            {verifying
              ? "Enter the verification code we sent you."
              : "Sign in with your Clerk account to sync tasks, calendar, and focus sessions."}
          </Text>

          {verifying ? (
            <>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Verification code"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                onPress={() => void handleVerify()}
                disabled={busy || !code.trim()}
              >
                {busy ? (
                  <ActivityIndicator color={t.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>Verify</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  if (mode === "sign-up") {
                    if (signUp?.prepareEmailAddressVerification) {
                      void signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                    }
                  } else {
                    if (signIn?.prepareFirstFactor) {
                      void signIn.prepareFirstFactor({ strategy: "email_code" });
                    }
                  }
                }}
              >
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setVerifying(false);
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={styles.linkText}>Back</Text>
              </Pressable>
            </>
          ) : (
            <>
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
                autoComplete={
                  mode === "sign-in" ? "password" : "new-password"
                }
              />
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                onPress={() =>
                  void (mode === "sign-in" ? handleSignIn() : handleSignUp())
                }
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
                style={styles.linkBtn}
                onPress={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
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

              {/* Required for Clerk bot protection on web */}
              <View nativeID="clerk-captcha" />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function AuthScreen() {
  if (!isClerkConfigured()) {
    return <DevAuthScreen />;
  }
  return <ClerkAuthScreen />;
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
