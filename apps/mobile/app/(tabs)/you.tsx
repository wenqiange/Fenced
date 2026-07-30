import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useOnboarding } from "../../src/hooks/use-onboarding";
import { useAppState } from "../../src/hooks/use-app-state";
import { useAuth } from "../../src/lib/auth";
import { formatFocusHours } from "../../src/lib/local-store";
import { PINE, PAPER, INK, SLATE, SAND } from "../../src/lib/theme";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
}

function Section({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
          >
            <Ionicons name={item.icon} size={20} color={PINE} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {item.detail && (
                <Text style={styles.rowDetail}>{item.detail}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={SLATE} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function YouScreen() {
  const { onboarding } = useOnboarding();
  const { state } = useAppState();
  const auth = useAuth();
  const ageBand = onboarding.ageBand ?? "—";

  const displayName =
    auth.user?.displayName ?? onboarding.displayName ?? "Your account";
  const signedIn = auth.isSignedIn || onboarding.signedIn;

  const progressItems: MenuItem[] = [
    {
      icon: "analytics-outline",
      label: "Insights",
      detail: `${formatFocusHours(state.focusMinutesThisWeek)} focused · ${state.shieldHitsThisWeek} shield hits · ${state.streakDays} day fence line`,
    },
  ];

  const settingsItems: MenuItem[] = [
    { icon: "notifications-outline", label: "Notifications" },
    { icon: "moon-outline", label: "Appearance" },
    { icon: "musical-notes-outline", label: "Focus sounds" },
    { icon: "shield-checkmark-outline", label: "Privacy" },
  ];

  const accountItems: MenuItem[] = [
    { icon: "person-outline", label: "Profile" },
    { icon: "download-outline", label: "Export data" },
    { icon: "trash-outline", label: "Delete account" },
    { icon: "help-circle-outline", label: "Help & feedback" },
  ];

  const complianceItems: MenuItem[] = [
    {
      icon: "people-outline",
      label: "Age band",
      detail: String(ageBand),
    },
    {
      icon: "document-text-outline",
      label: "Privacy notice",
      detail: onboarding.childrensCodeApplies
        ? "Children's Code defaults on"
        : "Standard privacy settings",
    },
  ];

  if (onboarding.needsGuardianConsent) {
    complianceItems.push({
      icon: "mail-outline",
      label: "Parental consent",
      detail: onboarding.guardianEmail
        ? `Pending · ${onboarding.guardianEmail}`
        : "Required",
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>You</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={PINE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileMeta}>
              {signedIn ? "Signed in" : "Not signed in"}
              {auth.mode === "clerk" ? " · Clerk" : " · Dev"}
              {" · "}
              {onboarding.completed ? "Setup complete" : "Setup in progress"}
              {onboarding.practiceMode ? " · Practice mode" : ""}
            </Text>
          </View>
        </View>

        <Section title="Privacy & age" items={complianceItems} />
        <Section title="Progress" items={progressItems} />
        <Section title="Settings" items={settingsItems} />
        <Section title="Account" items={accountItems} />

        {signedIn && (
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
        )}

        <Text style={styles.version}>Fenced v0.0.1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: INK, marginBottom: 24 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SAND,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: { fontSize: 17, fontWeight: "700", color: INK },
  profileMeta: { fontSize: 13, color: SLATE, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: SLATE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F0ECE6" },
  rowLabel: { fontSize: 16, color: INK },
  rowDetail: { fontSize: 13, color: SLATE, marginTop: 2 },
  signOut: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  signOutText: { fontSize: 16, fontWeight: "600", color: "#B3402E" },
  version: {
    fontSize: 12,
    color: SLATE,
    textAlign: "center",
    marginTop: 20,
  },
});
