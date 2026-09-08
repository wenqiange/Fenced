import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppState } from "../../src/hooks/use-app-state";
import { updateUserSettings } from "../../src/lib/local-store";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

interface SoundOption {
  id: "white-noise" | "rain" | "hearth" | "waves" | "silence";
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const SOUNDS: SoundOption[] = [
  {
    id: "white-noise",
    title: "Deep White Noise",
    desc: "Consistent broadband sound mask to block background noise",
    icon: "water-outline",
  },
  {
    id: "rain",
    title: "Forest Rain",
    desc: "Calming natural rain drops on forest leaves",
    icon: "rainy-outline",
  },
  {
    id: "hearth",
    title: "Lo-Fi Hearth",
    desc: "Warm crackling fireplace ambiance",
    icon: "flame-outline",
  },
  {
    id: "waves",
    title: "Binaural Focus Waves",
    desc: "Alpha wave frequencies designed for sustained deep study",
    icon: "pulse-outline",
  },
  {
    id: "silence",
    title: "Pure Silence",
    desc: "No audio played during focus sessions",
    icon: "volume-mute-outline",
  },
];

export default function FocusSoundsScreen() {
  const t = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const { state } = useAppState();
  const currentSound = state.settings.focusSound;
  const [playingId, setPlayingId] = useState<string | null>(null);

  const selectSound = (id: SoundOption["id"]) => {
    updateUserSettings({ focusSound: id });
  };

  const togglePreview = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Focus Sounds</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="musical-notes" size={32} color={t.accent} />
          </View>
          <Text style={styles.title}>First-Party Audio</Text>
          <Text style={styles.subTitle}>
            High-quality ambient soundscapes built into Fenced to keep you in the flow state.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Soundscape</Text>
          <View style={styles.list}>
            {SOUNDS.map((snd, idx) => {
              const selected = currentSound === snd.id;
              const isPlaying = playingId === snd.id;
              return (
                <View
                  key={snd.id}
                  style={[
                    styles.row,
                    idx < SOUNDS.length - 1 && styles.rowBorder,
                  ]}
                >
                  <Pressable
                    style={styles.soundInfoCol}
                    onPress={() => selectSound(snd.id)}
                  >
                    <Ionicons name={snd.icon} size={22} color={t.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{snd.title}</Text>
                      <Text style={styles.rowSub}>{snd.desc}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.actions}>
                    {snd.id !== "silence" && (
                      <Pressable
                        style={[
                          styles.previewBtn,
                          isPlaying && styles.previewBtnActive,
                        ]}
                        onPress={() => togglePreview(snd.id)}
                      >
                        <Ionicons
                          name={isPlaying ? "pause" : "play"}
                          size={16}
                          color={isPlaying ? t.onPrimary : t.accent}
                        />
                      </Pressable>
                    )}

                    <Pressable onPress={() => selectSound(snd.id)}>
                      <Ionicons
                        name={
                          selected
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={22}
                        color={selected ? t.accent : t.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
      borderBottomColor: t.border,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: t.text, marginLeft: 12 },
    scroll: { padding: 20 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: t.accentSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "700", color: t.text },
    subTitle: { fontSize: 13, color: t.textMuted, marginTop: 4, textAlign: "center" },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.textMuted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    list: {
      backgroundColor: t.surface,
      borderRadius: 12,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    soundInfoCol: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    rowTitle: { fontSize: 16, fontWeight: "600", color: t.text },
    rowSub: { fontSize: 13, color: t.textMuted, marginTop: 2 },
    actions: { flexDirection: "row", alignItems: "center", gap: 10 },
    previewBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    previewBtnActive: { backgroundColor: t.primary },
  });
