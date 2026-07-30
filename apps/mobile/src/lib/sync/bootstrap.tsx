import { useEffect } from "react";
import { useAuth } from "../auth";
import { useApi } from "../api";
import { syncTasksIfSignedIn } from "../sync/tasks";
import {
  getOnboardingState,
  isOnboardingHydrated,
} from "../onboarding-state";
import { seedDefaultFencedHour, isAppStateHydrated } from "../local-store";
import { useOnboarding } from "../../hooks/use-onboarding";

/** Runs once after local + onboarding hydrate when user is signed in. */
export function SyncBootstrap() {
  const api = useApi();
  const auth = useAuth();
  const { onboarding } = useOnboarding();

  useEffect(() => {
    if (!isOnboardingHydrated() || !isAppStateHydrated()) return;

    if (onboarding.completed) {
      seedDefaultFencedHour(onboarding.intent);
    }

    if (auth.isSignedIn) {
      void syncTasksIfSignedIn(api, auth.isSignedIn);
    }
  }, [api, auth.isSignedIn, onboarding.completed, onboarding.intent]);

  return null;
}
