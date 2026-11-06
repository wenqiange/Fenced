import type { createFencedClient } from "@fenced/api-client";
import {
  getOnboardingState,
  updateOnboardingState,
  type DistractionCategory,
  type Intent,
} from "../onboarding-state";

type Client = ReturnType<typeof createFencedClient>;

const INTENTS = new Set(["study", "deep-work", "phone-less"]);
const CATEGORIES = new Set([
  "social",
  "video",
  "games",
  "messaging",
  "news",
  "shopping",
]);

function asIntent(value: string | null | undefined): Intent | null {
  if (value && INTENTS.has(value)) return value as Intent;
  return null;
}

function asCategories(value: unknown): DistractionCategory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is DistractionCategory =>
    typeof c === "string" && CATEGORIES.has(c)
  );
}

/**
 * Push the *derived* onboarding result. Birth month/year never leave the
 * device; the server derives consent requirements itself.
 */
export async function pushOnboardingProfile(
  client: Client,
  displayName?: string,
  email?: string | null
): Promise<boolean> {
  const o = getOnboardingState();
  const ageBand = o.ageBand ?? "adult";
  const assuranceMethod = o.assuranceMethod ?? "neutral-screen";
  const jurisdiction = o.jurisdiction || "US";

  try {
    await client.user.ensureProfile.mutate({
      displayName: displayName ?? o.displayName ?? "You",
      email: email ?? undefined,
      ageBand,
      jurisdiction,
      assuranceMethod,
      childrensCodeApplies: o.childrensCodeApplies ?? false,
      guardianEmail: o.guardianEmail,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      intent: o.intent,
      distractionCategories: o.categories,
      practiceMode: o.practiceMode,
      onboardingCompleted: o.completed,
    });
    return true;
  } catch (e) {
    console.warn("[pushOnboardingProfile] failed:", e);
    return false;
  }
}

/** Restore onboarding from DB when this device has no (or incomplete) answers. */
export async function pullOnboardingProfile(client: Client): Promise<boolean> {
  try {
    const remote = await client.user.getProfile.query();
    if (!remote) return false;

    const local = getOnboardingState();
    const categories =
      asCategories(remote.distractionCategories).length > 0
        ? asCategories(remote.distractionCategories)
        : local.categories;
    const intent = asIntent(remote.intent) ?? local.intent;
    const completed = Boolean(
      remote.onboardingCompleted ||
      (remote.intent && categories.length > 0) ||
      local.completed
    );

    updateOnboardingState({
      signedIn: true,
      displayName: remote.displayName ?? local.displayName,
      ageBand: remote.ageBand ?? local.ageBand ?? "adult",
      jurisdiction: remote.jurisdiction ?? local.jurisdiction ?? "US",
      assuranceMethod: remote.assuranceMethod ?? local.assuranceMethod ?? "neutral-screen",
      childrensCodeApplies: remote.childrensCodeApplies ?? local.childrensCodeApplies ?? false,
      intent,
      categories,
      practiceMode: remote.practiceMode ?? local.practiceMode,
      completed,
      needsGuardianConsent: remote.needsGuardianConsent,
    });
    return true;
  } catch (e) {
    console.warn("[pullOnboardingProfile] failed:", e);
    return false;
  }
}

/**
 * Handles profile reconciliation immediately after authentication.
 * Pulls from remote DB first to restore existing completed onboarding state
 * and prevent re-prompting users with the onboarding flow.
 */
export async function ensureProfileAfterAuth(
  client: Client,
  displayName: string,
  email: string | null
): Promise<void> {
  // 1. Pull existing profile from DB first to see if user has already completed onboarding
  const pulled = await pullOnboardingProfile(client);
  const local = getOnboardingState();

  if (pulled && (local.completed || local.intent)) {
    if (!local.completed && local.intent) {
      updateOnboardingState({ completed: true });
    }
    return;
  }

  // 2. If new user or ageBand is missing, ensure safe defaults for authenticated Google account
  if (!local.ageBand || !local.assuranceMethod) {
    updateOnboardingState({
      ageBand: local.ageBand ?? "adult",
      assuranceMethod: local.assuranceMethod ?? "neutral-screen",
      jurisdiction: local.jurisdiction || "US",
    });
  }

  // 3. Push initial profile to establish user record on the server, then pull
  await pushOnboardingProfile(client, displayName, email);
  await pullOnboardingProfile(client);
}

export async function syncProfileIfSignedIn(
  client: Client,
  signedIn: boolean,
  opts?: { displayName?: string; email?: string | null }
): Promise<void> {
  if (!signedIn) return;

  const local = getOnboardingState();
  if (local.ageBand && local.assuranceMethod) {
    await pushOnboardingProfile(client, opts?.displayName, opts?.email);
  }
  await pullOnboardingProfile(client);
}

/**
 * Explicit, user-initiated guardian consent request — the one call allowed
 * while `needsGuardianConsent` is true. COPPA permits collecting a parent's
 * contact address to start consent; the child's display name is never sent
 * (a neutral placeholder is used). Returns false when it could not be sent.
 */
export async function requestGuardianConsent(client: Client, guardianEmail: string): Promise<boolean> {
  const o = getOnboardingState();
  updateOnboardingState({ guardianEmail });
  if (!o.ageBand || !o.assuranceMethod) return false;
  try {
    await client.user.ensureProfile.mutate({
      displayName: "Fenced user",
      ageBand: o.ageBand,
      jurisdiction: o.jurisdiction,
      assuranceMethod: o.assuranceMethod,
      childrensCodeApplies: o.childrensCodeApplies,
      guardianEmail,
    });
    return true;
  } catch {
    return false;
  }
}
