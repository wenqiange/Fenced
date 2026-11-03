import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FencedBlocking, SANDBOX_CATALOG, sandboxAppsFor } from "@fenced/blocking";
import { HIT_TARGET, radii } from "@fenced/ui";
import { useAppSelector } from "../../hooks/use-app-state";
import { addFence, updateFence, type LocalFence } from "../../lib/local-store";
import { useThemeColors } from "../../lib/theme";
import { AnimatedPressable, Badge, BottomSheetModal, Button, Chip, SectionHeader, Txt } from "../ui";
import { ShieldOverlay } from "./ShieldOverlay";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Human summary of what a fence keeps out. */
export function describeFence(f: LocalFence | undefined): string {
  if (!f) return "Choose what to fence";
  const cats = SANDBOX_CATALOG.filter((c) => f.categoryTokens.includes(c.id)).map((c) => c.label);
  const apps = f.appTokens.length;
  if (cats.length === 0 && apps === 0) return `${f.name} · nothing selected yet`;
  const parts = [...cats.slice(0, 2), cats.length > 2 ? `+${cats.length - 2}` : null, apps ? `${apps} app${apps === 1 ? "" : "s"}` : null];
  return `${f.name} · ${parts.filter(Boolean).join(", ")}`;
}

export function FencePickerSheet({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useThemeColors();
  const fences = useAppSelector((s) => s.fences);
  const fenceStyle = useAppSelector((s) => s.settings.fenceStyle);
  const sandbox = FencedBlocking.isSandbox();
  const current = fences.find((f) => f.id === selectedId) ?? fences.find((f) => f.isDefault) ?? fences[0];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [preview, setPreview] = useState(false);
  const previewApp = useMemo(() => (current ? sandboxAppsFor(current)[0] ?? null : null), [current]);

  const toggleCategory = (id: string) => {
    if (!current) return;
    const has = current.categoryTokens.includes(id);
    updateFence(current.id, {
      categoryTokens: has ? current.categoryTokens.filter((c) => c !== id) : [...current.categoryTokens, id],
    });
  };

  const toggleApp = (id: string) => {
    if (!current) return;
    const has = current.appTokens.includes(id);
    updateFence(current.id, { appTokens: has ? current.appTokens.filter((a) => a !== id) : [...current.appTokens, id] });
  };

  const chooseNative = async () => {
    if (!current) return;
    await FencedBlocking.requestAuthorization();
    const sel = await FencedBlocking.presentAppPicker(current.categoryTokens);
    updateFence(current.id, { appTokens: sel.appTokens, categoryTokens: sel.categoryTokens });
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title="Fenced apps">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        {sandbox && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: t.infoSoft, padding: 12, borderRadius: radii.md, marginTop: 8 }}>
            <Ionicons name="flask-outline" size={18} color={t.info} />
            <Txt variant="caption" style={{ color: t.info, flex: 1 }}>
              Shield sandbox: this build can't block apps at the system level. Pick what you'd fence and preview exactly
              what you'll see when you reach for one.
            </Txt>
          </View>
        )}

        <SectionHeader title="Your fences" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {fences.map((f) => (
            <Chip key={f.id} label={f.name} selected={f.id === current?.id} onPress={() => onSelect(f.id)} icon="shield-outline" />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="New fence (e.g. Exam week)"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="New fence name"
            style={{ flex: 1, minHeight: HIT_TARGET, borderRadius: radii.md, borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 12, color: t.text, backgroundColor: t.surface }}
          />
          <Button
            label="Add"
            kind="secondary"
            disabled={!newName.trim()}
            onPress={() => {
              const f = addFence({ name: newName.trim(), categoryTokens: current?.categoryTokens ?? [] , isDefault: false });
              setNewName("");
              onSelect(f.id);
            }}
            style={{ minHeight: HIT_TARGET }}
          />
        </View>

        {current && (
          <>
            <SectionHeader title={`What "${current.name}" keeps out`} />
            {!sandbox && (
              <Button label="Choose apps & categories" kind="secondary" icon="apps-outline" onPress={() => void chooseNative()} style={{ marginBottom: 10 }} />
            )}
            {SANDBOX_CATALOG.map((cat) => {
              const on = current.categoryTokens.includes(cat.id);
              const appsOn = cat.apps.filter((a) => current.appTokens.includes(a.id)).length;
              const open = expanded === cat.id;
              return (
                <View key={cat.id} style={{ borderBottomWidth: 1, borderColor: t.borderSubtle }}>
                  <View style={{ flexDirection: "row", alignItems: "center", minHeight: 56 }}>
                    <AnimatedPressable
                      onPress={() => toggleCategory(cat.id)}
                      haptic="selection"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${cat.label}, whole category`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minHeight: 56 }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: on ? t.primary : t.track,
                        }}
                      >
                        <Ionicons name={cat.icon as IconName} size={18} color={on ? t.onPrimary : t.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt variant="headline">{cat.label}</Txt>
                        <Txt variant="caption" tone="muted" numberOfLines={1}>
                          {on ? "Whole category" : appsOn ? `${appsOn} selected` : cat.apps.map((a) => a.name).join(", ")}
                        </Txt>
                      </View>
                      <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? t.success : t.borderStrong} />
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => setExpanded(open ? null : cat.id)}
                      accessibilityLabel={`${open ? "Hide" : "Show"} individual ${cat.label} apps`}
                      style={{ width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={t.textMuted} />
                    </AnimatedPressable>
                  </View>
                  {open && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12, paddingLeft: 48 }}>
                      {cat.apps.map((a) => (
                        <Chip
                          key={a.id}
                          label={a.name}
                          icon={a.icon as IconName}
                          selected={on || current.appTokens.includes(a.id)}
                          onPress={on ? undefined : () => toggleApp(a.id)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {sandbox && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Badge label="Sandbox" tone="info" />
                <Button label="Preview the shield" kind="secondary" icon="eye-outline" onPress={() => setPreview(true)} />
              </View>
            )}
          </>
        )}
        <Button label="Done" onPress={onClose} style={{ marginTop: 20 }} />
      </ScrollView>

      <ShieldOverlay
        visible={preview}
        appName={previewApp?.name ?? null}
        endsAt={new Date(Date.now() + 25 * 60_000)}
        sandbox
        styleId={fenceStyle}
        onReturn={() => setPreview(false)}
      />
    </BottomSheetModal>
  );
}
