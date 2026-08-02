import type { AgeBand, AssuranceMethod } from "@fenced/core";
import {
  childrensCodeApplies,
  getConsentAge,
  resolveAgeBand,
  requiresParentalConsent,
} from "@fenced/policy";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Intent = "study" | "deep-work" | "phone-less";

export type DistractionCategory =
  | "social"
  | "video"
  | "games"
  | "messaging"
  | "news"
  | "shopping";

export const INTENT_DEFAULTS: Record<
  Intent,
  { sessionMinutes: number; label: string; description: string }
> = {
  study: {
    sessionMinutes: 50,
    label: "Study for exams",
    description: "Longer blocks with social, video, and games fenced",
  },
  "deep-work": {
    sessionMinutes: 90,
    label: "Deep work",
    description: "Extended focus with social, news, and messaging fenced",
  },
  "phone-less": {
    sessionMinutes: 25,
    label: "Use my phone less",
    description: "Shorter sessions targeting social and video",
  },
};

export const DISTRACTION_CATEGORIES: {
  id: DistractionCategory;
  label: string;
}[] = [
  { id: "social", label: "Social" },
  { id: "video", label: "Video" },
  { id: "games", label: "Games" },
  { id: "messaging", label: "Messaging" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
];

export interface OnboardingState {
  birthMonth: number | null;
  birthYear: number | null;
  ageBand: AgeBand | null;
  jurisdiction: string;
  assuranceMethod: AssuranceMethod | null;
  childrensCodeApplies: boolean;
  needsGuardianConsent: boolean;
  guardianEmail: string | null;
  intent: Intent | null;
  categories: DistractionCategory[];
  practiceMode: boolean;
  completed: boolean;
  signedIn: boolean;
  displayName: string | null;
}

const STORAGE_KEY = "fenced.onboarding.v1";

const defaults: OnboardingState = {
  birthMonth: null,
  birthYear: null,
  ageBand: null,
  jurisdiction: "US",
  assuranceMethod: null,
  childrensCodeApplies: false,
  needsGuardianConsent: false,
  guardianEmail: null,
  intent: null,
  categories: [],
  practiceMode: false,
  completed: false,
  signedIn: false,
  displayName: null,
};

let state: OnboardingState = { ...defaults };
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local persistence is best-effort in MVP scaffold.
  }
}

export function subscribeOnboarding(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOnboardingState(): OnboardingState {
  return state;
}

export function isOnboardingHydrated() {
  return hydrated;
}

export async function hydrateOnboarding(): Promise<OnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    state = { ...defaults };
  }
  hydrated = true;
  notify();
  return state;
}

export function ageFromMonthYear(month: number, year: number, now = new Date()): number {
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return age;
}

export function applyAgeAssurance(month: number, year: number, jurisdiction = "US") {
  const age = ageFromMonthYear(month, year);
  const ageBand = resolveAgeBand(age, jurisdiction);
  state = {
    ...state,
    birthMonth: month,
    birthYear: year,
    jurisdiction,
    ageBand,
    assuranceMethod: "neutral-screen",
    childrensCodeApplies: childrensCodeApplies(age, jurisdiction),
    needsGuardianConsent: requiresParentalConsent(ageBand, jurisdiction),
  };
  void persist();
  notify();
  return { age, ageBand, consentAge: getConsentAge(jurisdiction) };
}

export function setGuardianEmail(email: string) {
  state = { ...state, guardianEmail: email };
  void persist();
  notify();
}

export function setIntent(intent: Intent) {
  state = { ...state, intent };
  void persist();
  notify();
}

export function setCategories(categories: DistractionCategory[]) {
  state = { ...state, categories };
  void persist();
  notify();
}

export function setPracticeMode(value: boolean) {
  state = { ...state, practiceMode: value };
  void persist();
  notify();
}

export function markSignedIn(displayName?: string) {
  state = {
    ...state,
    signedIn: true,
    displayName: displayName ?? state.displayName ?? "You",
  };
  void persist();
  notify();
}

export function markSignedOut() {
  state = { ...state, signedIn: false };
  void persist();
  notify();
}

export function completeOnboarding() {
  state = { ...state, completed: true };
  void persist();
  notify();
}

export function getDefaultSessionMinutes(): number {
  if (!state.intent) return 25;
  return INTENT_DEFAULTS[state.intent].sessionMinutes;
}

export function updateOnboardingState(patch: Partial<OnboardingState>) {
  state = { ...state, ...patch };
  void persist();
  notify();
}

export async function resetOnboarding() {
  state = { ...defaults };
  await AsyncStorage.removeItem(STORAGE_KEY);
  notify();
}
