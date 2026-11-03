import { colors } from "./colors";

/**
 * Semantic colour roles. Screens must consume these instead of the raw brand
 * ramp in `colors` so a single palette swap flips the whole app light↔dark.
 *
 * Role split that matters when reading the palettes below:
 * - `accent` is for ink on a neutral surface (icons, links, emphasis text).
 * - `primary` is for a filled surface, and `onPrimary` is the ink on top of it.
 *   In light mode both accent and primary are pine; in dark mode they diverge
 *   because pine on near-black fails contrast, so accent lifts to a pale sage
 *   while primary stays a deep pine that white text can still sit on.
 */
export interface ThemeColors {
  scheme: "light" | "dark";
  /** Screen background. */
  bg: string;
  /** Cards and list containers sitting on `bg`. */
  surface: string;
  /** Inset panels sitting on `surface` (code blocks, planned-event fills). */
  surfaceAlt: string;
  /** Hairlines between rows and around cards. */
  border: string;
  /** Heavier dividers (timeline rules, section separators). */
  borderStrong: string;
  text: string;
  textMuted: string;
  /** Ink on a saturated fill — pairs with `primary`/`accentAlt`. */
  onPrimary: string;
  /** Secondary ink on a saturated fill (labels above a headline figure). */
  onPrimaryMuted: string;
  /** Icons, links and emphasis text on `bg`/`surface`. */
  accent: string;
  /** Tinted chip/avatar fill; `onAccentSoft` is the ink on top. */
  accentSoft: string;
  onAccentSoft: string;
  /** Timber — secondary brand accent for calendar/streak marks. */
  accentAlt: string;
  /** Filled CTA background. */
  primary: string;
  /** Pressed/hover state of a filled CTA. */
  primaryPressed: string;
  /** Segmented-control and progress-bar troughs. */
  track: string;
  success: string;
  error: string;
  /** Breach / caution. */
  warning: string;
  info: string;
  /** Pale accent wash for selected chips and planned blocks. */
  accentTint: string;
  /** Tinted status fills; the matching solid role is the ink on top. */
  errorSoft: string;
  warningSoft: string;
  infoSoft: string;
  /** Scrim behind modals. */
  overlay: string;
  /** Raised surface (sheets, popovers) — one step above `surface`. */
  surfaceRaised: string;
  /** Lowest-contrast hairline, for dense lists. */
  borderSubtle: string;
  /** Card outline: paper edge in light mode, faint lit edge in dark. */
  cardBorder: string;
  /** Warm wood tone for grain marks and empty pickets. */
  timberGrain: string;
  /** Soft pine halo behind active/armed elements. */
  pineGlow: string;
  /** Boundary events ONLY (shield hits, leaving early). See brand doc. */
  breach: string;
  breachSoft: string;
  /** Card shadow colour (light mode only; dark mode uses `cardBorder`). */
  shadow: string;
  /** Status bar content style that stays legible on `bg`. */
  statusBar: "light" | "dark";
}

export const lightTheme: ThemeColors = {
  scheme: "light",
  bg: colors.paper,
  surface: colors.white,
  surfaceAlt: "#F3F7F2",
  border: "#F0ECE6",
  borderStrong: "#E0DCD6",
  text: colors.ink,
  textMuted: colors.slate,
  // Paper, not pure white: AAA (12.4:1) on pine and warmer than #FFF.
  onPrimary: colors.paper,
  onPrimaryMuted: "#B9C4BD",
  accent: colors.pine,
  accentSoft: colors.sand,
  onAccentSoft: colors.pine,
  accentAlt: colors.timber,
  primary: colors.pine,
  primaryPressed: colors.pine600,
  track: "#E8E4DE",
  success: colors.success,
  error: colors.error,
  // Brand palette: breach amber doubles as the only "warning" and info is the
  // muted lake blue — never the generic SaaS violet.
  warning: colors.breach,
  info: colors.info,
  accentTint: "#EDF3F0",
  errorSoft: "#F8E4DF",
  warningSoft: "#FBEBDB",
  infoSoft: "#E3EDF3",
  overlay: "rgba(23, 26, 24, 0.45)",
  surfaceRaised: colors.white,
  borderSubtle: "#F3EFE9",
  cardBorder: "#EAE4DA",
  timberGrain: colors.sand,
  pineGlow: "rgba(46, 90, 70, 0.14)",
  breach: colors.breach,
  breachSoft: "#FBEBDB",
  shadow: "#5B4630",
  statusBar: "dark",
};

/**
 * Slate — derived from the existing immersive session palette (`colors.focus`)
 * so a dark-mode app and an in-session screen feel like the same product.
 */
export const darkTheme: ThemeColors = {
  scheme: "dark",
  bg: "#0F1412",
  surface: colors.focus.surface,
  surfaceAlt: "#232E26",
  border: colors.focus.picketEmpty,
  borderStrong: "#3A463D",
  text: colors.focus.text,
  textMuted: colors.focus.textMuted,
  onPrimary: colors.paper,
  onPrimaryMuted: "#B9C4BD",
  accent: "#8FCBAE",
  accentSoft: "#26362D",
  onAccentSoft: "#C9E6D6",
  accentAlt: "#D9A566",
  primary: colors.pine600,
  primaryPressed: "#3A6E56",
  track: "#232C26",
  success: "#5FB98D",
  error: "#E07A66",
  warning: "#E39A4E",
  info: "#7FA9C4",
  accentTint: "#1E2A23",
  errorSoft: "#38231F",
  warningSoft: "#332A1B",
  infoSoft: "#1D2A33",
  overlay: "rgba(0, 0, 0, 0.6)",
  surfaceRaised: "#222C25",
  borderSubtle: "#1F2822",
  cardBorder: "rgba(201, 230, 214, 0.08)",
  timberGrain: "#3A3026",
  pineGlow: "rgba(143, 203, 174, 0.16)",
  breach: "#E39A4E",
  breachSoft: "#332A1B",
  shadow: "#000000",
  statusBar: "light",
};

/** User-facing preference stored in settings; `system` follows the OS. */
export type ThemePreference = "paper" | "slate" | "system";

export const themes: Record<"paper" | "slate", ThemeColors> = {
  paper: lightTheme,
  slate: darkTheme,
};

export function resolveTheme(
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeColors {
  if (preference === "paper") return lightTheme;
  if (preference === "slate") return darkTheme;
  return systemScheme === "dark" ? darkTheme : lightTheme;
}
