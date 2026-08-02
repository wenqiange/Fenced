import type { MiddlewareHandler } from "hono";

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimit(options: { windowMs?: number; max?: number } = {}): MiddlewareHandler {
  const windowMs = options.windowMs ?? 60 * 1000; // 1 minute window
  const max = options.max ?? 100; // 100 requests per minute default

  return async (c, next) => {
    // In production with Upstash Redis, UPSTASH_REDIS_REST_URL can be used.
    // Fall back to in-memory sliding window store.
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    let record = store.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - record.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));

    if (record.count > max) {
      return c.json(
        {
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please wait before retrying.",
        },
        429
      );
    }

    await next();
  };
}
