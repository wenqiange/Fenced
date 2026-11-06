import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { useProgress } from "../../src/hooks/use-progress";
import { useAuth } from "../../src/lib/auth";
import { formatFocusHours } from "../../src/lib/local-store";
import {
  useThemeColors,
  useThemedStyles,
  type ThemeColors,
  type ThemePreference,
} from "../../src/lib/theme";

const THEME_LABELS: Record<ThemePreference, string> = {
  paper: "Paper light",
  slate: "Slate dark",
  system: "System default",
};

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  route?: string;
}

function Section({ title, items }: { title: string; items: MenuItem[] }) {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
            onPress={() => {
              if (item.route) {
                router.push(item.route as any);
              }
            }}
          >
            <Ionicons name={item.icon} size={20} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {item.detail && (
                <Text style={styles.rowDetail}>{item.detail}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function YouScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { onboarding } = useOnboarding();
  const progress = useProgress();
  const theme = useAppSelector((s) => s.settings.theme);
  const auth = useAuth();
  const ageBand = onboarding.ageBand ?? "—";

  const displayName =
    auth.user?.displayName ?? onboarding.displayName ?? "Your account";
  const signedIn = auth.isSignedIn || onboarding.signedIn;

  const progressItems: MenuItem[] = [
    {
      icon: "analytics-outline",
      label: "Insights",
      detail: `${formatFocusHours(progress.weekFocusMinutes)} focused this week · ${progress.streakDays}-day fence line`,
      route: "/profile/insights",
    },
    {
      icon: "ribbon-outline",
      label: "Focus certificate",
      detail: "A portable, on-device proof of your focus work",
      route: "/profile/certificate",
    },
  ];

  const familyItems: MenuItem[] = [
    {
      icon: "school-outline",
      label: "Class Mode",
      detail: "Auto-shield during class periods, down for breaks",
      route: "/profile/class-mode",
    },
    {
      icon: "people-circle-outline",
      label: "Family Pact",
      detail: "A mutual commitment between student and guardian",
      route: "/profile/family-pact",
    },
  ];

  const settingsItems: MenuItem[] = [
    {
      icon: "compass-outline",
      label: "App guide & tutorial",
      detail: "Interactive walkthrough of Fenced",
      route: "/tutorial",
    },
    { icon: "notifications-outline", label: "Notifications", route: "/profile/notifications" },
    {
      icon: "moon-outline",
      label: "Appearance",
      detail: THEME_LABELS[theme],
      route: "/profile/appearance",
    },
    { icon: "musical-notes-outline", label: "Focus sounds", route: "/profile/focus-sounds" },
    { icon: "shield-checkmark-outline", label: "Privacy", route: "/profile/privacy" },
  ];

  const calendarItems: MenuItem[] = [
    {
      icon: "sync-outline",
      label: "Calendar sync",
      detail: "Two-way sync with Google Calendar",
      route: "/profile/calendar-sync",
    },
    {
      icon: "share-outline",
      label: "Export calendar",
      detail: "Subscribable link or a one-off .ics file",
      route: "/profile/calendar-export",
    },
  ];

  const accountItems: MenuItem[] = [
    ...(!signedIn
      ? [
          {
            icon: "log-in-outline" as const,
            label: "Sign in / Register",
            detail: "Sync your data and connect across devices",
            route: "/(onboarding)/auth",
          },
        ]
      : []),
    { icon: "person-outline", label: "Profile", route: "/profile/details" },
    { icon: "download-outline", label: "Export data", route: "/profile/export" },
    { icon: "trash-outline", label: "Delete account", route: "/profile/delete" },
    { icon: "help-circle-outline", label: "Help & feedback", route: "/profile/help" },
  ];

  const complianceItems: MenuItem[] = [
    {
      icon: "people-outline",
      label: "Age band",
      detail: String(ageBand),
      route: "/profile/age-band",
    },
    {
      icon: "document-text-outline",
      label: "Privacy notice",
      detail: onboarding.childrensCodeApplies
        ? "Children's Code defaults on"
        : "Standard privacy settings",
      route: "/profile/privacy-notice",
    },
  ];

  if (onboarding.needsGuardianConsent) {
    complianceItems.push({
      icon: "mail-outline",
      label: "Parental consent",
      detail: onboarding.guardianEmail
        ? `Pending · ${onboarding.guardianEmail}`
        : "Required",
      route: "/profile/guardian",
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>You</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>
              {signedIn ? "Signed in" : "Not signed in"}
              {auth.mode === "supabase" ? " · Supabase" : " · Dev"}
              {" · "}
              {onboarding.completed ? "Setup complete" : "Setup in progress"}
              {onboarding.practiceMode ? " · Practice mode" : ""}
            </Text>
          </View>
        </View>

        <Section title="Privacy & age" items={complianceItems} />
        <Section title="Progress" items={progressItems} />
        <Section title="Family & school" items={familyItems} />
        <Section title="Settings" items={settingsItems} />
        <Section title="Calendar" items={calendarItems} />
        <Section title="Account" items={accountItems} />

        {signedIn ? (
          <Pressable
            style={styles.signOut}
            onPress={() => {
              void auth.signOut().then(() => {
                router.replace("/(onboarding)/auth");
              });
            }}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.signIn}
            onPress={() => {
              router.push("/(onboarding)/auth");
            }}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        )}

        <Text style={styles.version}>Fenced v0.0.1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 28, fontWeight: "700", color: t.text, marginBottom: 24 },
    profileCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: t.accentSoft,
      justifyContent: "center",
      alignItems: "center",
    },
    profileName: { fontSize: 17, fontWeight: "700", color: t.text },
    profileMeta: { fontSize: 13, color: t.textMuted, marginTop: 2 },
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    sectionCard: {
      backgroundColor: t.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    rowLabel: { fontSize: 16, color: t.text },
    rowDetail: { fontSize: 13, color: t.textMuted, marginTop: 2 },
    signOut: {
      backgroundColor: t.surface,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 8,
    },
    signOutText: { fontSize: 16, fontWeight: "600", color: t.error },
    signIn: {
      backgroundColor: t.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 8,
    },
    signInText: { fontSize: 16, fontWeight: "700", color: t.onPrimary },
    version: {
      fontSize: 12,
      color: t.textMuted,
      textAlign: "center",
      marginTop: 20,
    },
  });
