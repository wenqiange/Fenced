import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  getAppState,
  hydrateAppState,
  isAppStateHydrated,
  subscribeAppState,
  type LocalAppState,
} from "../lib/local-store";

export function useStoreReady(): boolean {
  const ready = useSyncExternalStore(subscribeAppState, isAppStateHydrated, isAppStateHydrated);
  useEffect(() => {
    if (!ready) void hydrateAppState();
  }, [ready]);
  return ready;
}

/** Shallow equality for objects/arrays returned by selectors. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Subscribes to one slice of the store. The component re-renders only when
 * `isEqual(previous, next)` is false — select primitives or the store's own
 * arrays (which keep identity until changed), or pass `shallowEqual`.
 */
export function useAppSelector<T>(
  selector: (s: LocalAppState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  useStoreReady();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ state: LocalAppState; value: T } | null>(null);

  const getSnapshot = useCallback(() => {
    const s = getAppState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const next = selectorRef.current(s);
    if (c && isEqual(c.value, next)) {
      cache.current = { state: s, value: c.value };
      return c.value;
    }
    cache.current = { state: s, value: next };
    return next;
    // isEqual is expected to be stable (module-level function).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useSyncExternalStore(subscribeAppState, getSnapshot, getSnapshot);
}

/** Whole-state hook. Prefer `useAppSelector` in anything rendered often. */
export function useAppState() {
  const ready = useStoreReady();
  const state = useSyncExternalStore(subscribeAppState, getAppState, getAppState);
  return { ready, state };
}
