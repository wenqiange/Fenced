import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { radii } from "@fenced/ui";
import { AnimatedPressable, Chip, FenceCard, IconButton, SectionHeader, Txt } from "../../src/components/ui";
import { useAppSelector } from "../../src/hooks/use-app-state";
import { hapticLatchClose } from "../../src/lib/haptics";
import { updateUserSettings, type FocusSoundId } from "../../src/lib/local-store";
import { AMBIENT_SOUNDS, playAmbient, playSfx, setAmbientVolume, stopAmbient, type AmbientId } from "../../src/lib/sound-engine";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const ICONS: Record<AmbientId, React.ComponentProps<typeof Ionicons>["name"]> = {
  rain: "rainy-outline",
  hearth: "flame-outline",
  "white-noise": "water-outline",
  waves: "pulse-outline",
};
const VOLUMES = [0.2, 0.4, 0.6, 0.8, 1];

export default function FocusSoundsScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const settings = useAppSelector((st) => st.settings);
  const [previewing, setPreviewing] = useState<AmbientId | null>(null);

  // Leaving the screen ends any preview (a running session restarts its own).
  useEffect(() => () => void stopAmbient(200), []);

  const select = (id: FocusSoundId) => updateUserSettings({ focusSound: id });

  const togglePreview = (id: AmbientId) => {
    if (previewing === id) {
      void stopAmbient();
      setPreviewing(null);
    } else {
      void playAmbient(id, settings.soundVolume);
      setPreviewing(id);
    }
  };

  const setVolume = (v: number) => {
    updateUserSettings({ soundVolume: v });
    setAmbientVolume(v);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Txt variant="title2" accessibilityRole="header">
          Sound & feel
        </Txt>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="callout" tone="muted">
          Generated on your phone. Works offline, nothing to download.
        </Txt>

        <SectionHeader title="Focus sound" />
        {AMBIENT_SOUNDS.map((snd) => {
          const selected = settings.focusSound === snd.id;
          const playing = previewing === snd.id;
          return (
            <FenceCard key={snd.id} style={[s.row, selected && { borderColor: t.accent }]}>
              <AnimatedPressable
                onPress={() => select(snd.id)}
                haptic="selection"
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${snd.label}. ${snd.description}`}
                style={s.rowMain}
                pressScale={0.99}
              >
                <View style={[s.icon, selected && { backgroundColor: t.primary }]}>
                  <Ionicons name={ICONS[snd.id]} size={20} color={selected ? t.onPrimary : t.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="headline">{snd.label}</Txt>
                  <Txt variant="caption" tone="muted">
                    {snd.description}
                  </Txt>
                </View>
              </AnimatedPressable>
              <IconButton
                icon={playing ? "stop-circle" : "play-circle-outline"}
                label={playing ? `Stop ${snd.label} preview` : `Preview ${snd.label}`}
                onPress={() => togglePreview(snd.id)}
                color={t.accent}
                size={30}
              />
            </FenceCard>
          );
        })}
        <FenceCard style={[s.row, settings.focusSound === "silence" && { borderColor: t.accent }]}>
          <AnimatedPressable
            onPress={() => select("silence")}
            accessibilityRole="radio"
            accessibilityState={{ selected: settings.focusSound === "silence" }}
            style={s.rowMain}
            pressScale={0.99}
          >
            <View style={s.icon}>
              <Ionicons name="volume-mute-outline" size={20} color={t.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="headline">Silence</Txt>
              <Txt variant="caption" tone="muted">
                No audio during sessions
              </Txt>
            </View>
          </AnimatedPressable>
        </FenceCard>

        <SectionHeader title="Volume" />
        <View style={s.chips}>
          {VOLUMES.map((v) => (
            <Chip key={v} label={`${Math.round(v * 100)}%`} selected={Math.abs(settings.soundVolume - v) < 0.01} onPress={() => setVolume(v)} />
          ))}
        </View>

        <SectionHeader title="Feedback" />
        <FenceCard>
          <ToggleRow
            label="Sound effects"
            hint="Latch click, picket taps, the shield's knock"
            value={settings.soundEffects}
            onChange={(v) => {
              updateUserSettings({ soundEffects: v });
              if (v) void playSfx("latch");
            }}
          />
          <View style={s.divider} />
          <ToggleRow
            label="Haptics"
            hint="Feel the gate latch and pickets settle"
            value={settings.haptics}
            onChange={(v) => {
              updateUserSettings({ haptics: v });
              if (v) void hapticLatchClose();
            }}
          />
        </FenceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="body">{label}</Txt>
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: t.primary, false: t.track }} thumbColor={t.surface} />
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 },
    scroll: { padding: 20, paddingBottom: 48 },
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 4, marginBottom: 8 },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
    icon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    divider: { height: 1, backgroundColor: t.borderSubtle, marginVertical: 4 },
  });
