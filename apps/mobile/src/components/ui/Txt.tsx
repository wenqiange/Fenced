import { Text, type TextProps, type TextStyle } from "react-native";
import { microLabel, tabularNums, typography } from "@fenced/ui";
import { useThemeColors, type ThemeColors } from "../../lib/theme";

export type TextVariant = keyof typeof typography | "label";
export type TextTone = "default" | "muted" | "accent" | "breach" | "success" | "error" | "onPrimary" | "timber";

const TONE: Record<TextTone, (t: ThemeColors) => string> = {
  default: (t) => t.text,
  muted: (t) => t.textMuted,
  accent: (t) => t.accent,
  breach: (t) => t.breach,
  success: (t) => t.success,
  error: (t) => t.error,
  onPrimary: (t) => t.onPrimary,
  timber: (t) => t.accentAlt,
};

/** Type scale in one place, so screens never hand-roll font sizes. */
export function useTypography() {
  return { ...typography, label: microLabel, tabularNums };
}

export interface TxtProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Tabular figures: required for timers, counters, stats and clock times. */
  numeric?: boolean;
  align?: TextStyle["textAlign"];
  weight?: TextStyle["fontWeight"];
}

export function Txt({ variant = "body", tone = "default", numeric, align, weight, style, ...rest }: TxtProps) {
  const t = useThemeColors();
  const base = variant === "label" ? microLabel : typography[variant];
  return (
    <Text
      // Large accessibility sizes stay legible but can't blow layouts apart.
      maxFontSizeMultiplier={variant === "display" ? 1.4 : 2}
      style={[
        base,
        { color: TONE[tone](t) },
        numeric && tabularNums,
        align && { textAlign: align },
        weight && { fontWeight: weight },
        style,
      ]}
      {...rest}
    />
  );
}
