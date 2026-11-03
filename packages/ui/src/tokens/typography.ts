export const typography = {
  display: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700" as const,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  callout: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" as const,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
  },
} as const;

/** Spread into any timer, counter, stat or clock time: digits never shift width. */
export const tabularNums = { fontVariant: ["tabular-nums"] as ["tabular-nums"] };

/** Micro labels are uppercase with tracking (brand doc § Typography). */
export const microLabel = {
  ...typography.micro,
  letterSpacing: 0.8,
  textTransform: "uppercase" as const,
};

export const radii = {
  sm: 8,
  md: 12,
  /** Cards: architectural, not pill-soft. */
  card: 14,
  lg: 20,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt / Material 48dp → 44). */
export const HIT_TARGET = 44;
