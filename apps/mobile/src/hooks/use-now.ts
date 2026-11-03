import { useEffect, useState } from "react";

/** Re-renders on an interval; `active=false` stops the timer entirely. */
export function useNow(intervalMs = 1000, active = true): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
