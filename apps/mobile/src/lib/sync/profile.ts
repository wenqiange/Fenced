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
  if (!o.ageBand || !o.assuranceMethod) return false;

  try {
    await client.user.ensureProfile.mutate({
      displayName: displayName ?? o.displayName ?? "You",
      email: email ?? undefined,
      ageBand: o.ageBand,
      jurisdiction: o.jurisdiction,
      assuranceMethod: o.assuranceMethod,
      childrensCodeApplies: o.childrensCodeApplies,
      guardianEmail: o.guardianEmail,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      intent: o.intent,
      distractionCategories: o.categories,
      practiceMode: o.practiceMode,
      onboardingCompleted: o.completed,
    });
    return true;
  } catch {
    return false;
  }
}

/** Restore onboarding from DB when this device has no (or incomplete) answers. */
export async function pullOnboardingProfile(client: Client): Promise<boolean> {
  try {
    const remote = await client.user.getProfile.query();
    if (!remote) return false;

    const local = getOnboardingState();
    const shouldRestore =
      !local.completed ||
      !local.ageBand ||
      (remote.onboardingCompleted && !local.intent);

    if (!shouldRestore && local.ageBand) {
      // The server owns consent state (a guardian may have just granted it).
      updateOnboardingState({
        needsGuardianConsent: remote.needsGuardianConsent,
        ...(!local.displayName && remote.displayName
          ? { displayName: remote.displayName, signedIn: true }
          : {}),
      });
      return true;
    }

    updateOnboardingState({
      signedIn: true,
      displayName: remote.displayName ?? local.displayName,
      ageBand: remote.ageBand,
      jurisdiction: remote.jurisdiction,
      assuranceMethod: remote.assuranceMethod,
      childrensCodeApplies: remote.childrensCodeApplies,
      intent: asIntent(remote.intent) ?? local.intent,
      categories:
        asCategories(remote.distractionCategories).length > 0
          ? asCategories(remote.distractionCategories)
          : local.categories,
      practiceMode: remote.practiceMode ?? local.practiceMode,
      completed: remote.onboardingCompleted || local.completed,
      needsGuardianConsent: remote.needsGuardianConsent,
    });
    return true;
  } catch {
    return false;
  }
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
