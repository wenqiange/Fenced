import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitHit {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window counter store. The in-memory one is per-process; swap in a
 * Redis/Upstash implementation (INCR + PEXPIRE) to share limits across
 * instances — the middleware only depends on this interface.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, now: number): Promise<RateLimitHit>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, RateLimitHit>();
  private nextSweepAt = 0;

  constructor(private readonly sweepEveryMs = 60_000) {}

  async hit(key: string, windowMs: number, now: number): Promise<RateLimitHit> {
    // Deterministic cleanup on the request path: no timer keeps the process
    // alive, and memory is bounded by keys seen within one sweep period.
    if (now >= this.nextSweepAt) {
      for (const [k, w] of this.windows) if (now >= w.resetAt) this.windows.delete(k);
      this.nextSweepAt = now + this.sweepEveryMs;
    }
    let w = this.windows.get(key);
    if (!w || now >= w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return { ...w };
  }

  get size() {
    return this.windows.size;
  }
}

/**
 * Client address. The right-most X-Forwarded-For entry is the one appended by
 * our own proxy; anything left of it is client-supplied and spoofable.
 */
export function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  const fromXff = xff?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return fromXff || c.req.header("cf-connecting-ip") || "unknown";
}

const defaultStore = new MemoryRateLimitStore();

export function rateLimit(
  options: {
    windowMs?: number;
    max?: number;
    /** Namespaces counters so separate limits never share a bucket. */
    name?: string;
    store?: RateLimitStore;
    key?: (c: Context) => string;
    now?: () => number;
  } = {},
): MiddlewareHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 100;
  const name = options.name ?? `rl${windowMs}:${max}`;
  const store = options.store ?? defaultStore;
  const keyOf = options.key ?? clientIp;
  const now = options.now ?? Date.now;

  return async (c, next) => {
    const t = now();
    const { count, resetAt } = await store.hit(`${name}:${keyOf(c)}`, windowMs, t);
    const remaining = Math.max(0, max - count);

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((resetAt - t) / 1000))));
      return c.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please wait before retrying.",
        },
        429,
      );
    }

    await next();
  };
}
