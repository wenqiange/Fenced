import { useEffect, useState } from "react";
import {
  getOnboardingState,
  hydrateOnboarding,
  isOnboardingHydrated,
  subscribeOnboarding,
} from "../lib/onboarding-state";

export function useOnboarding() {
  const [ready, setReady] = useState(isOnboardingHydrated());
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isOnboardingHydrated()) {
      void hydrateOnboarding().then(() => setReady(true));
    }
    return subscribeOnboarding(() => tick((n) => n + 1));
  }, []);

  return { ready, onboarding: getOnboardingState() };
}
