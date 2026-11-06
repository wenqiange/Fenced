import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { radii } from "@fenced/ui";
import { AnimatedPressable, Button, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import {
  formatFocusHours,
  leaveLocalCircle,
  setActiveCircle,
  type LocalCircle,
  type LocalCircleMember,
} from "../../src/lib/local-store";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";
import { useApi } from "../../src/lib/api";
import { hapticSelection } from "../../src/lib/haptics";

export default function CircleLiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const api = useApi();

  const circles = useAppSelector((s) => s.circles);
  const activeSession = useAppSelector((s) => s.activeSession);
  const localCircle = circles.find((c) => c.id === id);

  const [members, setMembers] = useState<LocalCircleMember[]>(
    localCircle?.members ?? []
  );
  const [roomData, setRoomData] = useState<LocalCircle | undefined>(localCircle);

  // Sync latest room presence from server
  useEffect(() => {
    if (!id || id.startsWith("circle-local-") || id === "fenced-global-library") return;

    let mounted = true;
    async function fetchLivePresence() {
      try {
        const remote = await api.circle.get.query({ circleId: id });
        if (mounted && remote) {
          setMembers(
            remote.members.map((m) => ({
              id: m.id,
              userId: m.userId,
              displayName: m.displayName,
              avatarSeed: m.avatarSeed,
              isFocusing: m.isFocusing,
              currentSubject: m.currentSubject,
              activeSessionEndsAt: m.activeSessionEndsAt,
              isSelf: m.isSelf,
            }))
          );
          setRoomData((prev) =>
            prev
              ? {
                  ...prev,
                  name: remote.name,
                  description: remote.description,
                  circleFocusMinutes: remote.circleFocusMinutes,
                  activeCount: remote.summary.activeCount,
                  totalMembers: remote.summary.totalMembers,
                  focusingSubjects: remote.summary.focusingSubjects,
                }
              : undefined
          );
        }
      } catch {
        // Fallback to local store data
      }
    }

    void fetchLivePresence();
    const interval = setInterval(fetchLivePresence, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id, api]);

  const handleShareInvite = async () => {
    if (!roomData?.inviteCode) return;
    try {
      await Share.share({
        message: `Join my silent study room "${roomData.name}" on Fenced with code: ${roomData.inviteCode}`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      "Leave Room",
      `Are you sure you want to leave "${roomData?.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            if (id) {
              leaveLocalCircle(id);
              try {
                await api.circle.leave.mutate({ circleId: id });
              } catch {
                // local fallback already applied
              }
              router.back();
            }
          },
        },
      ]
    );
  };

  const isUserFocusingInRoom =
    activeSession !== null && activeSession.circleId === id;

  const handleJoinFocusSession = () => {
    hapticSelection();
    if (id) {
      setActiveCircle(id);
      router.push({
        pathname: "/session-sheet",
        params: {
          circleId: id,
          circleName: roomData?.name ?? "Study Room",
        },
      });
    }
  };

  if (!roomData && !localCircle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={t.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Room Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentCircle = roomData ?? localCircle!;
  const currentMembers = members.length > 0 ? members : (currentCircle.members ?? []);
  const activeFocusers = currentMembers.filter((m) => m.isFocusing);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentCircle.name}
          </Text>
          <Text style={styles.headerSub}>Silent Timber Room</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={handleShareInvite}
            accessibilityLabel="Share invite code"
          >
            <Ionicons name="share-social-outline" size={20} color={t.accent} />
          </Pressable>

          {currentCircle.id !== "fenced-global-library" && (
            <Pressable
              style={styles.iconBtn}
              onPress={handleLeaveRoom}
              accessibilityLabel="Leave room"
            >
              <Ionicons name="exit-outline" size={20} color={t.error} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Collective Focus Banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statBox}>
            <View style={styles.rowAlign}>
              <View
                style={[
                  styles.pulseDot,
                  { backgroundColor: activeFocusers.length > 0 ? t.success : t.textMuted },
                ]}
              />
              <Text style={styles.statVal}>{activeFocusers.length}</Text>
            </View>
            <Text style={styles.statLbl}>Active Now</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statVal}>{currentMembers.length}</Text>
            <Text style={styles.statLbl}>Members</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statVal}>
              {formatFocusHours(currentCircle.circleFocusMinutes)}
            </Text>
            <Text style={styles.statLbl}>Total Focused</Text>
          </View>
        </View>

        {/* Invite Code Pill */}
        <Pressable style={styles.codePill} onPress={handleShareInvite}>
          <Ionicons name="key-outline" size={14} color={t.accent} />
          <Text style={styles.codeText}>Invite Code: {currentCircle.inviteCode}</Text>
          <Ionicons name="copy-outline" size={14} color={t.accent} />
        </Pressable>

        {/* Study Hall Desks Grid */}
        <View style={styles.desksHeaderRow}>
          <Text style={styles.sectionTitle}>The Study Hall</Text>
          <Text style={styles.minorSafeBadge}>🔒 Zero-DM Safe Room</Text>
        </View>

        <View style={styles.desksGrid}>
          {currentMembers.map((member) => (
            <View
              key={member.id}
              style={[
                styles.deskCard,
                member.isFocusing && {
                  borderColor: t.accent,
                  borderWidth: 1.5,
                  backgroundColor: t.surface,
                },
              ]}
            >
              {/* Avatar circle */}
              <View
                style={[
                  styles.deskAvatar,
                  { backgroundColor: member.isFocusing ? t.accentTint : t.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={member.isFocusing ? "person" : "person-outline"}
                  size={24}
                  color={member.isFocusing ? t.accent : t.textMuted}
                />
                {member.isFocusing && <View style={[styles.activeDot, { backgroundColor: t.success }]} />}
              </View>

              <Text style={styles.deskName} numberOfLines={1}>
                {member.isSelf ? "You" : member.displayName}
              </Text>

              {member.currentSubject ? (
                <View style={[styles.subjectBadge, { backgroundColor: t.surfaceAlt }]}>
                  <Text style={styles.subjectBadgeText} numberOfLines={1}>
                    📚 {member.currentSubject}
                  </Text>
                </View>
              ) : (
                <Text style={styles.restingText}>
                  {member.isFocusing ? "Deep Focus" : "Taking a break"}
                </Text>
              )}

              <View style={styles.statusPill}>
                <Text
                  style={[
                    styles.statusPillText,
                    { color: member.isFocusing ? t.success : t.textMuted },
                  ]}
                >
                  {member.isFocusing ? "In Focus" : "Resting"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Floating Bottom Action */}
      <View style={styles.footer}>
        {isUserFocusingInRoom ? (
          <Pressable
            style={[styles.floatingBtn, { backgroundColor: t.accent }]}
            onPress={() => router.push("/session")}
          >
            <Ionicons name="timer" size={20} color="#fff" />
            <Text style={[styles.floatingBtnText, { color: "#fff" }]}>
              View Active Focus Session
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.floatingBtn, { backgroundColor: t.primary }]}
            onPress={handleJoinFocusSession}
          >
            <Ionicons name="play" size={20} color={t.onPrimary} />
            <Text style={[styles.floatingBtnText, { color: t.onPrimary }]}>
              Study in this Room
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.borderSubtle,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: t.text },
    headerSub: { fontSize: 12, color: t.textMuted },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBtn: { padding: 6 },
    scroll: { padding: 20, paddingBottom: 100 },
    statsBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.surface,
      borderRadius: radii.lg,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: t.borderSubtle,
      marginBottom: 12,
    },
    statBox: { flex: 1, alignItems: "center" },
    statVal: { fontSize: 18, fontWeight: "800", color: t.text },
    statLbl: { fontSize: 11, color: t.textMuted, marginTop: 2, fontWeight: "500" },
    statDivider: { width: 1, height: 26, backgroundColor: t.borderSubtle },
    rowAlign: { flexDirection: "row", alignItems: "center", gap: 6 },
    pulseDot: { width: 8, height: 8, borderRadius: 4 },
    codePill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: t.accentTint,
      borderRadius: radii.pill,
      marginBottom: 20,
      alignSelf: "center",
    },
    codeText: { fontSize: 12, fontWeight: "700", color: t.accent },
    desksHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    minorSafeBadge: {
      fontSize: 11,
      fontWeight: "600",
      color: t.textMuted,
    },
    desksGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    deskCard: {
      width: "48%",
      backgroundColor: t.surface,
      borderRadius: radii.md,
      padding: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.borderSubtle,
    },
    deskAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
      position: "relative",
    },
    activeDot: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: "#fff",
    },
    deskName: {
      fontSize: 14,
      fontWeight: "700",
      color: t.text,
      marginBottom: 4,
    },
    subjectBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
      maxWidth: "100%",
      marginBottom: 6,
    },
    subjectBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: t.textMuted,
    },
    restingText: {
      fontSize: 11,
      color: t.textMuted,
      marginBottom: 6,
    },
    statusPill: {
      marginTop: 2,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: t.surface,
      borderTopWidth: 1,
      borderColor: t.borderSubtle,
    },
    floatingBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radii.md,
    },
    floatingBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });
