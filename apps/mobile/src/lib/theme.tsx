import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  darkTheme,
  lightTheme,
  resolveTheme,
  type ThemeColors,
  type ThemePreference,
} from "@fenced/ui";
import { useAppSelector } from "../hooks/use-app-state";
import { updateUserSettings } from "./local-store";

export { colors } from "@fenced/ui";
export type { ThemeColors, ThemePreference };

interface ThemeContextValue {
  /** Resolved palette for the active scheme. */
  t: ThemeColors;
  /** Raw stored preference — `system` before it is resolved against the OS. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves `settings.theme` (paper / slate / system) against the OS scheme and
 * publishes the palette. Reads the local store directly so a theme change from
 * the Appearance screen repaints without any prop threading.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppSelector((s) => s.settings.theme);
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(
    () => ({
      t: resolveTheme(preference, systemScheme),
      preference,
      setPreference: (next) => updateUserSettings({ theme: next }),
    }),
    [preference, systemScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Focus surfaces (session, shield, strict gate) are dark regardless of the
 * system setting: a bright screen during deep work is hostile, and the dark
 * surface marks the felt boundary of "in a session" (brand doc § Color).
 */
export function FocusThemeProvider({ children }: { children: ReactNode }) {
  const parent = useContext(ThemeContext);
  const value = useMemo<ThemeContextValue>(
    () => ({
      t: darkTheme,
      preference: parent?.preference ?? "system",
      setPreference: parent?.setPreference ?? ((next) => updateUserSettings({ theme: next })),
    }),
    [parent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  if (__DEV__) {
    console.warn(
      "[theme] Rendered outside ThemeProvider — falling back to the light palette."
    );
  }
  return {
    t: lightTheme,
    preference: "system",
    setPreference: (next) => updateUserSettings({ theme: next }),
  };
}

/** Active palette. Use for inline props (icon `color`, animated values). */
export function useThemeColors(): ThemeColors {
  return useThemeContext().t;
}

/** Stored preference plus its setter — for the Appearance screen. */
export function useThemePreference(): Pick<
  ThemeContextValue,
  "preference" | "setPreference"
> {
  const { preference, setPreference } = useThemeContext();
  return { preference, setPreference };
}

/**
 * Cache of `StyleSheet.create` results keyed by factory then scheme, so
 * switching themes reuses sheets instead of allocating one per render.
 */
const sheetCache = new WeakMap<object, Map<string, unknown>>();

/**
 * Builds a themed stylesheet once per (factory, scheme).
 *
 * Declare the factory at module scope — a factory recreated each render would
 * miss the cache and defeat the memo.
 */
export function useThemedStyles<T>(factory: (t: ThemeColors) => T): T {
  const t = useThemeColors();
  return useMemo(() => {
    let byScheme = sheetCache.get(factory);
    if (!byScheme) {
      byScheme = new Map();
      sheetCache.set(factory, byScheme);
    }
    const cached = byScheme.get(t.scheme);
    if (cached) return cached as T;
    const created = factory(t);
    byScheme.set(t.scheme, created);
    return created;
  }, [factory, t]);
}
