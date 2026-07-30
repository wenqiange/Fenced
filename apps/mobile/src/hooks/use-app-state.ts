import { useEffect, useState } from "react";
import {
  getAppState,
  hydrateAppState,
  isAppStateHydrated,
  subscribeAppState,
} from "../lib/local-store";

export function useAppState() {
  const [ready, setReady] = useState(isAppStateHydrated());
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isAppStateHydrated()) {
      void hydrateAppState().then(() => setReady(true));
    }
    return subscribeAppState(() => tick((n) => n + 1));
  }, []);

  return { ready, state: getAppState() };
}
