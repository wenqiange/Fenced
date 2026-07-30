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
import { useSignIn, useSignUp } from "@clerk/expo";
import { useEffect, useState } from "react";
import { useAuth, isClerkConfigured } from "../../src/lib/auth";
import { getOnboardingState } from "../../src/lib/onboarding-state";
import { useApi } from "../../src/lib/api";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

type Mode = "sign-in" | "sign-up";

async function ensureProfileAfterAuth(
  api: ReturnType<typeof useApi>,
  displayName: string,
  email: string | null
) {
  const onboarding = getOnboardingState();
  if (!onboarding.ageBand || !onboarding.assuranceMethod) return;
  try {
    await api.user.ensureProfile.mutate({
      displayName,
      email: email ?? undefined,
      ageBand: onboarding.ageBand,
      jurisdiction: onboarding.jurisdiction,
      assuranceMethod: onboarding.assuranceMethod,
      childrensCodeApplies: onboarding.childrensCodeApplies,
      guardianEmail: onboarding.guardianEmail,
    });
  } catch {
    // API/DB may be offline — onboarding still proceeds.
  }
}

function DevAuthScreen() {
  const auth = useAuth();
  const api = useApi();
  const [busy, setBusy] = useState(false);

  async function continueDev(displayName = "Dev user") {
    setBusy(true);
    auth.signInDev(displayName);
    await ensureProfileAfterAuth(api, displayName, "dev@fenced.local");
    setBusy(false);
    router.push("/(onboarding)/intent");
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
            <ActivityIndicator color="#FFFFFF" />
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
  const auth = useAuth();
  const api = useApi();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const busy =
    finishing ||
    signInStatus === "fetching" ||
    signUpStatus === "fetching";

  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || finishing) return;
    void (async () => {
      setFinishing(true);
      const displayName = auth.user?.displayName ?? "You";
      await ensureProfileAfterAuth(api, displayName, auth.user?.email ?? null);
      router.push("/(onboarding)/intent");
    })();
  }, [auth.isLoaded, auth.isSignedIn, auth.user, api, finishing]);

  function pickErrorMessage(err: { message?: string } | null | undefined): string | null {
    return err?.message ?? null;
  }

  async function handleSignIn() {
    setError(null);
    const { error: err } = await signIn.password({
      emailAddress: email.trim(),
      password,
    });
    if (err) {
      setError(pickErrorMessage(err) ?? "Sign in failed");
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize();
      return;
    }

    if (signIn.status === "needs_client_trust") {
      const emailFactor = signIn.supportedSecondFactors?.find(
        (f) => f.strategy === "email_code"
      );
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        setVerifying(true);
        return;
      }
    }

    setError("Additional verification required. Check your email or try again.");
  }

  async function handleSignUp() {
    setError(null);
    const { error: err } = await signUp.password({
      emailAddress: email.trim(),
      password,
    });
    if (err) {
      setError(pickErrorMessage(err) ?? "Sign up failed");
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setError(pickErrorMessage(sendError) ?? "Could not send verification code");
      return;
    }
    setVerifying(true);
  }

  async function handleVerify() {
    setError(null);
    if (mode === "sign-up") {
      const { error: err } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (err) {
        setError(pickErrorMessage(err) ?? "Invalid code");
        return;
      }
      if (signUp.status === "complete") {
        await signUp.finalize();
      } else {
        setError("Sign-up not complete yet. Try again.");
      }
      return;
    }

    const { error: err } = await signIn.mfa.verifyEmailCode({
      code: code.trim(),
    });
    if (err) {
      setError(pickErrorMessage(err) ?? "Invalid code");
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize();
    } else {
      setError("Sign-in not complete yet. Try again.");
    }
  }

  if (!auth.isLoaded || (auth.isSignedIn && finishing)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator color={PINE} size="large" />
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
              : "Two taps. Your age band stays with your account so fencing and privacy settings stay correct."}
          </Text>

          {verifying ? (
            <>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Verification code"
                placeholderTextColor={SLATE}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                onPress={() => void handleVerify()}
                disabled={busy || !code.trim()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryText}>Verify</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  if (mode === "sign-up") {
                    void signUp.verifications.sendEmailCode();
                  } else {
                    void signIn.mfa.sendEmailCode();
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
                placeholderTextColor={SLATE}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={SLATE}
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
                  <ActivityIndicator color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: PINE,
    letterSpacing: 1,
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "700", color: INK },
  subtitle: {
    fontSize: 15,
    color: SLATE,
    marginTop: 10,
    lineHeight: 22,
    marginBottom: 28,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: INK,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0DCD6",
  },
  primary: {
    backgroundColor: PINE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  linkBtn: { alignItems: "center", paddingVertical: 14 },
  linkText: { fontSize: 15, fontWeight: "600", color: PINE },
  error: {
    marginTop: 12,
    color: "#B3402E",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  devHint: {
    marginTop: 24,
    fontSize: 13,
    color: SLATE,
    textAlign: "center",
    lineHeight: 18,
    backgroundColor: SAND,
    padding: 12,
    borderRadius: 12,
  },
});
