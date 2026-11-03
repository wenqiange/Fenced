import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HIT_TARGET, radii } from "@fenced/ui";
import { Button, FenceCard, Txt } from "../../src/components/ui";
import { setGuardianEmail } from "../../src/lib/onboarding-state";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shown to `child` accounts instead of sign-in. Fenced works fully on the
 * device; syncing waits for a guardian. No account, no child email, nothing
 * leaves the phone from this screen.
 */
export default function GuardianStep() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const [email, setEmail] = useState("");
  const valid = EMAIL.test(email.trim());

  const next = () => router.push("/(onboarding)/intent");

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Txt variant="label" tone="accent">
            Your fence, your phone
          </Txt>
          <Txt variant="title1" style={{ marginTop: 8 }} accessibilityRole="header">
            Everything works right here on this phone
          </Txt>
          <Txt variant="body" tone="muted" style={{ marginTop: 8 }}>
            Sessions, tasks and your fence line all stay on this device. Backing up and syncing to other devices needs a
            parent or guardian to say yes first.
          </Txt>

          <FenceCard style={{ marginTop: 24 }}>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name="phone-portrait-outline" size={20} color={t.success} />
              <Txt variant="headline">On-device mode</Txt>
            </View>
            {["No account needed", "Nothing is sent to our servers", "AI features and analytics stay off"].map((line) => (
              <View key={line} style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Ionicons name="checkmark" size={16} color={t.success} />
                <Txt variant="callout" tone="muted">
                  {line}
                </Txt>
              </View>
            ))}
          </FenceCard>

          <Txt variant="label" tone="muted" style={{ marginTop: 28, marginBottom: 8 }}>
            Parent or guardian email (optional)
          </Txt>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="parent@example.com"
            placeholderTextColor={t.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Parent or guardian email, optional"
            style={s.input}
          />
          <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
            Saved on this phone only. You can send the request later from You › Guardian — it's the only thing that would
            ever be sent, and only when you choose to.
          </Txt>
        </ScrollView>

        <View style={s.footer}>
          <Button
            label={valid ? "Save and continue on this phone" : "Continue on this phone"}
            onPress={() => {
              if (valid) setGuardianEmail(email.trim());
              next();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 24, paddingBottom: 32 },
    input: {
      minHeight: HIT_TARGET + 4,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surface,
      paddingHorizontal: 14,
      fontSize: 16,
      color: t.text,
    },
    footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  });
