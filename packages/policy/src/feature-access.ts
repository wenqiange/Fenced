import type { AgeBand } from "@fenced/core";

export type Feature =
  | "focus-sessions"
  | "fenced-hours"
  | "strict-mode"
  | "tasks"
  | "calendar"
  | "streaks"
  | "insights"
  | "sync"
  | "focus-audio"
  | "data-export"
  | "llm-parsing"
  | "llm-replan-advice"
  | "llm-weekly-coach"
  | "llm-planning-chat"
  | "product-analytics"
  | "leaderboards"
  | "location-zones"
  | "marketing-email";

const ALWAYS_AVAILABLE: Feature[] = [
  "focus-sessions",
  "fenced-hours",
  "strict-mode",
  "tasks",
  "calendar",
  "streaks",
  "insights",
  "focus-audio",
  "data-export",
];

const ADULT_ONLY: Feature[] = [
  "llm-parsing",
  "llm-replan-advice",
  "llm-weekly-coach",
  "llm-planning-chat",
  "product-analytics",
  "marketing-email",
];

const ADULT_AND_TEEN_OPT_IN: Feature[] = [
  "leaderboards",
];

const NEVER_FOR_CHILD: Feature[] = [
  ...ADULT_ONLY,
  ...ADULT_AND_TEEN_OPT_IN,
  "location-zones",
];

export function canAccess(feature: Feature, ageBand: AgeBand): boolean {
  if (ALWAYS_AVAILABLE.includes(feature)) return true;
  if (ageBand === "child") return !NEVER_FOR_CHILD.includes(feature);
  if (ageBand === "teen") {
    if (ADULT_ONLY.includes(feature)) return false;
    return true;
  }
  return true;
}

export function requiresParentalConsent(ageBand: AgeBand, jurisdiction: string): boolean {
  if (ageBand === "child" && jurisdiction.toUpperCase() === "US") return true;
  return false;
}

export const MAX_STRICT_DELAY_CHILD = 30;
