import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getLocales } from "expo-localization";
import { HIT_TARGET, radii } from "@fenced/ui";
import { AnimatedPressable, BottomSheetModal, Button, Txt } from "../../src/components/ui";
import { applyAgeAssurance } from "../../src/lib/onboarding-state";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../../src/lib/theme";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" }));
const thisYear = new Date().getFullYear();
// Neutral age screen: every decade is offered the same way, nothing is
// preselected and nothing hints at an "expected" answer.
const DECADES = Array.from({ length: 10 }, (_, i) => Math.floor(thisYear / 10) * 10 - i * 10);

/** Countries offered first: every jurisdiction with a specific consent age, plus large markets. */
const COUNTRIES = [
  "US", "GB", "IE", "CA", "AU", "NZ", "DE", "FR", "ES", "IT", "PT", "NL", "BE", "AT", "CH", "SE", "DK", "FI", "NO",
  "PL", "CZ", "SK", "HU", "RO", "BG", "GR", "HR", "SI", "EE", "LV", "LT", "LU", "MT", "CY", "MX", "BR", "AR", "CL",
  "CO", "IN", "JP", "KR", "SG", "ZA",
];

function countryName(code: string): string {
  try {
    const Names = (Intl as unknown as { DisplayNames?: new (l: string[], o: { type: string }) => { of(c: string): string } }).DisplayNames;
    if (Names) return new Names([getLocales()[0]?.languageTag ?? "en"], { type: "region" }).of(code) ?? code;
  } catch {
    /* Hermes without DisplayNames: show the code */
  }
  return code;
}

function detectCountry(): string {
  try {
    const region = getLocales()[0]?.regionCode;
    if (region && /^[A-Z]{2}$/.test(region)) return region;
  } catch {
    /* ignore */
  }
  return "US";
}

export default function AgeScreen() {
  const t = useThemeColors();
  const s = useThemedStyles(createStyles);
  const [month, setMonth] = useState<number | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [country, setCountry] = useState(detectCountry);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");

  const years = useMemo(
    () => (decade == null ? [] : Array.from({ length: 10 }, (_, i) => decade + i).filter((y) => y <= thisYear)),
    [decade],
  );
  const countries = useMemo(() => {
    const list = COUNTRIES.includes(country) ? COUNTRIES : [country, ...COUNTRIES];
    const q = query.trim().toLowerCase();
    return list.map((c) => ({ code: c, name: countryName(c) })).filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [country, query]);

  function next() {
    if (month == null || year == null) return;
    // Month/year are used here once and dropped; only the derived band is kept.
    const { ageBand } = applyAgeAssurance(month, year, country);
    router.push(ageBand === "child" ? "/(onboarding)/guardian" : "/(onboarding)/auth");
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Txt variant="label" tone="accent">
          Almost ready
        </Txt>
        <Txt variant="title1" style={{ marginTop: 8 }} accessibilityRole="header">
          So we can set Fenced up correctly for you
        </Txt>
        <Txt variant="body" tone="muted" style={{ marginTop: 8 }}>
          The month and year you were born. We use it once to choose the right defaults, then forget it — it's never stored or sent.
        </Txt>

        <Txt variant="label" tone="muted" style={s.label}>
          Month
        </Txt>
        <View style={s.grid} accessibilityRole="radiogroup" accessibilityLabel="Birth month">
          {MONTHS.map((m, i) => (
            <Cell key={m} label={m} selected={month === i + 1} onPress={() => setMonth(i + 1)} cols={4} />
          ))}
        </View>

        <Txt variant="label" tone="muted" style={s.label}>
          Year
        </Txt>
        <View style={s.grid} accessibilityRole="radiogroup" accessibilityLabel="Birth decade">
          {DECADES.map((d) => (
            <Cell
              key={d}
              label={`${d}s`}
              selected={decade === d}
              onPress={() => {
                setDecade(d);
                setYear(null);
              }}
              cols={5}
            />
          ))}
        </View>
        {decade != null && (
          <View style={[s.grid, { marginTop: 10 }]} accessibilityRole="radiogroup" accessibilityLabel="Birth year">
            {years.map((y) => (
              <Cell key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} cols={5} />
            ))}
          </View>
        )}

        <Txt variant="label" tone="muted" style={s.label}>
          Where you live
        </Txt>
        <AnimatedPressable onPress={() => setPicker(true)} style={s.country} accessibilityLabel={`Country: ${countryName(country)}. Change`} haptic="selection">
          <Txt variant="body" style={{ flex: 1 }}>
            {countryName(country)}
          </Txt>
          <Txt variant="caption" tone="accent">
            Change
          </Txt>
        </AnimatedPressable>
        <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
          Privacy rules for younger people differ by country.
        </Txt>
      </ScrollView>

      <View style={s.footer}>
        <Button label="Continue" onPress={next} disabled={month == null || year == null} />
      </View>

      <BottomSheetModal visible={picker} onClose={() => setPicker(false)} title="Country or region">
        <View style={{ paddingHorizontal: 20 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={t.textMuted}
            accessibilityLabel="Search countries"
            style={s.search}
          />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
          {countries.map((c) => (
            <AnimatedPressable
              key={c.code}
              onPress={() => {
                setCountry(c.code);
                setPicker(false);
                setQuery("");
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: c.code === country }}
              style={s.countryRow}
            >
              <Txt variant="body" style={{ flex: 1 }}>
                {c.name}
              </Txt>
              {c.code === country && <Txt variant="caption" tone="accent">Selected</Txt>}
            </AnimatedPressable>
          ))}
        </ScrollView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

function Cell({ label, selected, onPress, cols }: { label: string; selected: boolean; onPress: () => void; cols: number }) {
  const t = useThemeColors();
  return (
    <View style={{ width: `${100 / cols}%`, padding: 4 }}>
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        minHeight: HIT_TARGET,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: selected ? t.primary : t.borderStrong,
        backgroundColor: selected ? t.primary : t.surface,
      }}
    >
      <Txt variant="callout" numeric style={{ color: selected ? t.onPrimary : t.text }}>
        {label}
      </Txt>
    </AnimatedPressable>
    </View>
  );
}

const createStyles = (t: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { padding: 24, paddingBottom: 32 },
    label: { marginTop: 24, marginBottom: 10 },
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    country: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surface,
    },
    footer: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
    search: { minHeight: HIT_TARGET, borderRadius: radii.md, borderWidth: 1, borderColor: t.borderStrong, paddingHorizontal: 12, color: t.text, marginBottom: 8 },
    countryRow: { flexDirection: "row", alignItems: "center", minHeight: 48, borderBottomWidth: 1, borderColor: t.borderSubtle },
  });
