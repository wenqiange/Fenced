import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { radii } from "@fenced/ui";
import { AnimatedPressable, Button, FenceCard, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import {
  addLocalCircle,
  formatFocusHours,
  type LocalCircle,
} from "../../src/lib/local-store";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";
import { useApi } from "../../src/lib/api";
import { hapticSelection } from "../../src/lib/haptics";

export default function CirclesScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const api = useApi();
  const circles = useAppSelector((s) => s.circles);

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync circles from server on mount
  useEffect(() => {
    async function loadCircles() {
      try {
        const remoteCircles = await api.circle.list.query();
        if (remoteCircles && remoteCircles.length > 0) {
          for (const rc of remoteCircles) {
            addLocalCircle({
              id: rc.id,
              name: rc.name,
              description: rc.description,
              inviteCode: rc.inviteCode,
              circleFocusMinutes: rc.circleFocusMinutes,
              activeCount: rc.activeCount,
              totalMembers: rc.totalMembers,
              focusingSubjects: rc.focusingSubjects,
            });
          }
        }
      } catch {
        // Offline or unauthenticated fallback uses local state
      }
    }
    void loadCircles();
  }, [api]);

  const handleJoinCircle = async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) return;
    setSubmitting(true);
    try {
      const circle = await api.circle.join.mutate({ inviteCode: code });
      addLocalCircle({
        id: circle.id,
        name: circle.name,
        description: circle.description,
        inviteCode: circle.inviteCode,
        circleFocusMinutes: circle.circleFocusMinutes,
        activeCount: 1,
        totalMembers: 1,
        focusingSubjects: [],
      });
      setJoinModalVisible(false);
      setInviteCodeInput("");
      Alert.alert("Joined Room!", `You have joined ${circle.name}.`);
    } catch {
      // Local demo fallback
      const found = circles.find((c) => c.inviteCode.toUpperCase() === code);
      if (found) {
        setJoinModalVisible(false);
        setInviteCodeInput("");
        router.push(`/circle/${found.id}`);
      } else {
        Alert.alert("Invalid Code", "No study room found matching this invite code.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCircle = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const circle = await api.circle.create.mutate({
        name,
        description: newRoomDesc.trim() || undefined,
      });
      addLocalCircle({
        id: circle.id,
        name: circle.name,
        description: circle.description,
        inviteCode: circle.inviteCode,
        circleFocusMinutes: 0,
        activeCount: 0,
        totalMembers: 1,
        focusingSubjects: [],
      });
      setCreateModalVisible(false);
      setNewRoomName("");
      setNewRoomDesc("");
      router.push(`/circle/${circle.id}`);
    } catch {
      // Offline fallback
      const localId = `circle-local-${Date.now()}`;
      const code = `TIMBER-${Math.floor(1000 + Math.random() * 9000)}`;
      addLocalCircle({
        id: localId,
        name,
        description: newRoomDesc.trim() || null,
        inviteCode: code,
        circleFocusMinutes: 0,
        activeCount: 0,
        totalMembers: 1,
        focusingSubjects: [],
      });
      setCreateModalVisible(false);
      setNewRoomName("");
      setNewRoomDesc("");
      router.push(`/circle/${localId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Silent Timber Rooms</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Banner Explainer */}
        <View style={styles.explainerCard}>
          <View style={styles.explainerIconCircle}>
            <Ionicons name="library" size={28} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.explainerTitle}>Silent Body Doubling</Text>
            <Text style={styles.explainerSub}>
              Focus alongside classmates in complete silence. No video, no toxic chat, no harassment—just shared human presence.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: t.primary }]}
            onPress={() => {
              hapticSelection();
              setCreateModalVisible(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={t.onPrimary} />
            <Text style={[styles.actionBtnText, { color: t.onPrimary }]}>Create Room</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong }]}
            onPress={() => {
              hapticSelection();
              setJoinModalVisible(true);
            }}
          >
            <Ionicons name="key-outline" size={20} color={t.text} />
            <Text style={[styles.actionBtnText, { color: t.text }]}>Join with Code</Text>
          </Pressable>
        </View>

        {/* Rooms List */}
        <Text style={styles.sectionTitle}>Active Study Rooms ({circles.length})</Text>

        <View style={styles.list}>
          {circles.map((circle) => {
            const isGlobal = circle.id === "fenced-global-library";
            return (
              <AnimatedPressable
                key={circle.id}
                onPress={() => {
                  hapticSelection();
                  router.push(`/circle/${circle.id}`);
                }}
                pressScale={0.98}
                style={styles.roomCard}
              >
                <View style={styles.roomCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowAlign}>
                      <Text style={styles.roomName}>{circle.name}</Text>
                      {isGlobal && (
                        <View style={[styles.badge, { backgroundColor: t.accentTint }]}>
                          <Text style={[styles.badgeText, { color: t.accent }]}>Official 24/7</Text>
                        </View>
                      )}
                    </View>
                    {circle.description && (
                      <Text style={styles.roomDesc} numberOfLines={2}>
                        {circle.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
                </View>

                {/* Live Activity Row */}
                <View style={styles.statsRow}>
                  <View style={[styles.presencePill, { backgroundColor: t.surfaceAlt }]}>
                    <View
                      style={[
                        styles.pulseDot,
                        { backgroundColor: circle.activeCount > 0 ? t.success : t.textMuted },
                      ]}
                    />
                    <Text style={styles.presenceText}>
                      {circle.activeCount > 0
                        ? `${circle.activeCount} studying now`
                        : "Library is quiet"}
                    </Text>
                  </View>

                  <Text style={styles.focusTotalText}>
                    {formatFocusHours(circle.circleFocusMinutes)} focused
                  </Text>
                </View>

                {/* Current Subjects Pills */}
                {circle.focusingSubjects && circle.focusingSubjects.length > 0 && (
                  <View style={styles.subjectsRow}>
                    {circle.focusingSubjects.slice(0, 3).map((subj, idx) => (
                      <View key={idx} style={[styles.subjectTag, { backgroundColor: t.surfaceAlt }]}>
                        <Ionicons name="book-outline" size={12} color={t.textMuted} />
                        <Text style={styles.subjectText}>{subj}</Text>
                      </View>
                    ))}
                    {circle.focusingSubjects.length > 3 && (
                      <Text style={styles.moreSubjects}>+{circle.focusingSubjects.length - 3} more</Text>
                    )}
                  </View>
                )}
              </AnimatedPressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Join Modal */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Join Study Room</Text>
            <Text style={styles.modalSub}>
              Enter the 6-character room invite code shared by your teacher or friend.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={inviteCodeInput}
              onChangeText={setInviteCodeInput}
              placeholder="e.g. TIMBER-842"
              placeholderTextColor={t.textMuted}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={{ color: t.textMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, (!inviteCodeInput.trim() || submitting) && { opacity: 0.5 }]}
                disabled={!inviteCodeInput.trim() || submitting}
                onPress={handleJoinCircle}
              >
                <Text style={{ color: t.onPrimary, fontWeight: "700" }}>Join</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Study Room</Text>
            <Text style={styles.modalSub}>
              Create a silent, focused room for your study group or class.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="Room Name (e.g. Biology Finals)"
              placeholderTextColor={t.textMuted}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 10 }]}
              value={newRoomDesc}
              onChangeText={setNewRoomDesc}
              placeholder="Description or subject (optional)"
              placeholderTextColor={t.textMuted}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={{ color: t.textMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmit, (!newRoomName.trim() || submitting) && { opacity: 0.5 }]}
                disabled={!newRoomName.trim() || submitting}
                onPress={handleCreateCircle}
              >
                <Text style={{ color: t.onPrimary, fontWeight: "700" }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    headerTitle: { fontSize: 18, fontWeight: "700", color: t.text, marginLeft: 12 },
    scroll: { padding: 20 },
    explainerCard: {
      backgroundColor: t.surface,
      borderRadius: radii.lg,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1,
      borderColor: t.borderSubtle,
      marginBottom: 16,
    },
    explainerIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.accentTint,
      alignItems: "center",
      justifyContent: "center",
    },
    explainerTitle: { fontSize: 16, fontWeight: "700", color: t.text },
    explainerSub: { fontSize: 13, color: t.textMuted, marginTop: 3, lineHeight: 18 },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: radii.md,
    },
    actionBtnText: {
      fontWeight: "700",
      fontSize: 14,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    list: { gap: 14 },
    roomCard: {
      backgroundColor: t.surface,
      borderRadius: radii.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: t.borderSubtle,
    },
    roomCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    rowAlign: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    roomName: {
      fontSize: 17,
      fontWeight: "700",
      color: t.text,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.pill,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    roomDesc: {
      fontSize: 13,
      color: t.textMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: t.borderSubtle,
    },
    presencePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    presenceText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.text,
    },
    focusTotalText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.textMuted,
    },
    subjectsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
    },
    subjectTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.sm,
    },
    subjectText: {
      fontSize: 11,
      fontWeight: "500",
      color: t.textMuted,
    },
    moreSubjects: {
      fontSize: 11,
      color: t.textMuted,
      alignSelf: "center",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalBox: {
      width: "100%",
      backgroundColor: t.surface,
      borderRadius: radii.lg,
      padding: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: t.text,
      marginBottom: 6,
    },
    modalSub: {
      fontSize: 13,
      color: t.textMuted,
      lineHeight: 18,
      marginBottom: 16,
    },
    modalInput: {
      backgroundColor: t.bg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: t.borderStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: t.text,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 20,
    },
    modalCancel: {
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    modalSubmit: {
      backgroundColor: t.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: radii.md,
    },
  });
