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
  /** Linking a provider account (Google Calendar) and syncing through it. */
  | "external-calendar-sync"
  /** Publishing a subscribable ICS URL that anyone holding it can read. */
  | "calendar-feed-publish"
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
  // A feed URL is a capability anyone can hold, and it discloses where a
  // person is expected to be all week. Under the UK Children's Code that
  // applies to every under-18, so publishing one is adults only. The one-off
  // .ics export stays available to everyone under "data-export" — portability
  // is a right, and it hands the file to the user rather than to the internet.
  "calendar-feed-publish",
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
  // Linking a third-party account moves a child's schedule off-device to a
  // provider, which is exactly the processing COPPA puts behind verifiable
  // parental consent. Teens keep it: the data goes to their own account.
  "external-calendar-sync",
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

/**
 * Whether the account must stay device-only until a guardian consents.
 *
 * Product invariant (stricter than docs/06, which scopes VPC to US only):
 * every `child` account, in every jurisdiction, runs local-only until consent
 * is verified. COPPA requires it in the US; elsewhere it is the conservative
 * reading of GDPR-K / the UK Children's Code best-interests standard.
 * `jurisdiction` stays in the signature so a legal owner can narrow it.
 */
export function requiresParentalConsent(ageBand: AgeBand, _jurisdiction: string): boolean {
  return ageBand === "child";
}

export const MAX_STRICT_DELAY_CHILD = 30;
