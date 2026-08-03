import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { useApi } from "../api";
import { syncTasksIfSignedIn } from "./tasks";
import { syncProfileIfSignedIn } from "./profile";
import { isOnboardingHydrated } from "../onboarding-state";
import { seedDefaultFencedHour, isAppStateHydrated } from "../local-store";
import { useOnboarding } from "../../hooks/use-onboarding";

/** Hydrate profile from Supabase and push local onboarding when signed in. */
export function SyncBootstrap() {
  const api = useApi();
  const auth = useAuth();
  const { onboarding } = useOnboarding();
  const syncing = useRef(false);

  useEffect(() => {
    if (!isOnboardingHydrated() || !isAppStateHydrated()) return;

    if (onboarding.completed) {
      seedDefaultFencedHour(onboarding.intent);
    }

    if (!auth.isSignedIn || syncing.current) return;

    syncing.current = true;
    void (async () => {
      try {
        await syncProfileIfSignedIn(api, true, {
          displayName: auth.user?.displayName,
          email: auth.user?.email,
        });
        await syncTasksIfSignedIn(api, true);
      } finally {
        syncing.current = false;
      }
    })();
  }, [
    api,
    auth.isSignedIn,
    auth.user?.displayName,
    auth.user?.email,
    onboarding.completed,
    onboarding.intent,
    onboarding.categories,
    onboarding.ageBand,
  ]);

  return null;
}
