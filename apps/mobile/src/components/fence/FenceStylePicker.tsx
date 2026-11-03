import { useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FENCE_STYLE_ORDER, FENCE_STYLES, type FenceStyleId } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import { hapticLatchClose } from "../../lib/haptics";
import { updateUserSettings } from "../../lib/local-store";
import { useThemeColors } from "../../lib/theme";
import { Badge, Button, FenceCard, Txt } from "../ui";
import { FenceAssemblyView } from "./FenceAssemblyView";

/**
 * Fence materials, earned by completed sessions. Locked styles can always be
 * previewed. Progress is stated plainly ("8 sessions to go"), never as a
 * countdown or loss — no pressure mechanics (UK Children's Code).
 */
export function FenceStylePicker() {
  const t = useThemeColors();
  const current = useAppSelector((s) => s.settings.fenceStyle);
  const completed = useAppSelector((s) => s.sessionHistory.filter((h) => h.status === "completed").length);
  const [preview, setPreview] = useState<FenceStyleId | null>(null);

  return (
    <View style={{ gap: 12 }}>
      {FENCE_STYLE_ORDER.map((id) => {
        const m = FENCE_STYLES[id];
        const unlocked = completed >= m.unlockAtSessions;
        const inUse = current === id;
        const showing = preview === id || inUse;
        return (
          <FenceCard key={id} style={inUse ? { borderColor: t.accent, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Txt variant="headline" style={{ flex: 1 }}>
                {m.name}
              </Txt>
              {inUse ? (
                <Badge label="In use" tone="success" />
              ) : unlocked ? null : (
                <Badge label={`${m.unlockAtSessions - completed} sessions to go`} tone="neutral" />
              )}
            </View>
            <FenceAssemblyView progress={showing ? 0.7 : 0.4} pickets={10} styleId={id} state="building" aspect={0.42} accessibilityLabel={`${m.name} fence preview`} />
            <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>
              {m.blurb}
            </Txt>
            {!inUse && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {unlocked ? (
                  <Button
                    label="Use this fence"
                    style={{ flex: 1, minHeight: 44 }}
                    onPress={() => {
                      updateUserSettings({ fenceStyle: id });
                      void hapticLatchClose();
                    }}
                  />
                ) : (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="lock-closed-outline" size={14} color={t.textMuted} />
                    <Txt variant="caption" tone="muted">
                      Unlocks after {m.unlockAtSessions} completed sessions
                    </Txt>
                  </View>
                )}
                <Button label={preview === id ? "Previewing" : "Preview"} kind="secondary" style={{ minHeight: 44 }} onPress={() => setPreview(preview === id ? null : id)} />
              </View>
            )}
          </FenceCard>
        );
      })}
    </View>
  );
}
