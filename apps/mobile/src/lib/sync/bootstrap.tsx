import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth";
import { useApi } from "../api";
import { getOnboardingState, isOnboardingHydrated } from "../onboarding-state";
import { seedDefaultFencedHour } from "../local-store";
import { useOnboarding } from "../../hooks/use-onboarding";
import { useStoreReady } from "../../hooks/use-app-state";
import { configureSync, flushOutbox, fullSync } from "./engine";
import { syncProfileIfSignedIn } from "./profile";

/**
 * COPPA / GDPR-K gate. A child account without verified guardian consent
 * runs fully on-device: nothing — not even the profile — leaves the phone.
 * Read live (not from a render snapshot) so a flush already in progress stops
 * the moment the flag flips.
 */
export function syncAllowed(signedIn: boolean): boolean {
  const o = getOnboardingState();
  return signedIn && !!o.ageBand && !o.needsGuardianConsent;
}

export function SyncBootstrap() {
  const api = useApi();
  const auth = useAuth();
  const { onboarding } = useOnboarding();
  const storeReady = useStoreReady();
  const signedInRef = useRef(auth.isSignedIn);
  signedInRef.current = auth.isSignedIn;

  // Local seeding happens regardless of account state.
  useEffect(() => {
    if (!isOnboardingHydrated() || !storeReady || !onboarding.completed) return;
    seedDefaultFencedHour(onboarding.intent, onboarding.categories);
  }, [storeReady, onboarding.completed, onboarding.intent, onboarding.categories]);

  const allowed = storeReady && isOnboardingHydrated() && syncAllowed(auth.isSignedIn);

  useEffect(() => {
    if (!allowed) {
      configureSync(null);
      return;
    }
    configureSync({ client: api, canSync: () => syncAllowed(signedInRef.current) });
    void (async () => {
      await syncProfileIfSignedIn(api, true, {
        // A name the user chose in the app beats the auth provider's.
        displayName: getOnboardingState().displayName ?? auth.user?.displayName,
        email: auth.user?.email,
      });
      // The server is the authority on consent; it may have just flipped.
      if (syncAllowed(signedInRef.current)) await fullSync();
    })();

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void fullSync();
      else void flushOutbox();
    });
    return () => sub.remove();
  }, [allowed, api, auth.user?.displayName, auth.user?.email]);

  return null;
}
