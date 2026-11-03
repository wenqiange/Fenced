import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { MemoryRateLimitStore, rateLimit } from "../rate-limit";

function appWith(store: MemoryRateLimitStore, clock: { t: number }) {
  const app = new Hono();
  app.use("/a/*", rateLimit({ name: "a", max: 2, windowMs: 1000, store, now: () => clock.t }));
  app.use("/b/*", rateLimit({ name: "b", max: 2, windowMs: 1000, store, now: () => clock.t }));
  app.get("/a/x", (c) => c.text("ok"));
  app.get("/b/x", (c) => c.text("ok"));
  return app;
}

test("blocks over the limit with standard headers", async () => {
  const clock = { t: 0 };
  const app = appWith(new MemoryRateLimitStore(), clock);
  const h = { "x-forwarded-for": "1.1.1.1" };
  assert.equal((await app.request("/a/x", { headers: h })).status, 200);
  const second = await app.request("/a/x", { headers: h });
  assert.equal(second.headers.get("X-RateLimit-Remaining"), "0");
  const third = await app.request("/a/x", { headers: h });
  assert.equal(third.status, 429);
  assert.equal(third.headers.get("Retry-After"), "1");
});

test("separate limiters do not share a bucket", async () => {
  const clock = { t: 0 };
  const app = appWith(new MemoryRateLimitStore(), clock);
  const h = { "x-forwarded-for": "1.1.1.1" };
  await app.request("/a/x", { headers: h });
  await app.request("/a/x", { headers: h });
  assert.equal((await app.request("/b/x", { headers: h })).status, 200);
});

test("window resets and expired keys are swept", async () => {
  const clock = { t: 0 };
  const store = new MemoryRateLimitStore(500);
  const app = appWith(store, clock);
  for (let i = 0; i < 3; i++) await app.request("/a/x", { headers: { "x-forwarded-for": "2.2.2.2" } });
  clock.t = 1500;
  assert.equal(
    (await app.request("/a/x", { headers: { "x-forwarded-for": "3.3.3.3" } })).status,
    200,
  );
  assert.equal(store.size, 1);
});

test("spoofed left-most X-Forwarded-For does not dodge the limit", async () => {
  const clock = { t: 0 };
  const app = appWith(new MemoryRateLimitStore(), clock);
  for (let i = 0; i < 2; i++) {
    await app.request("/a/x", { headers: { "x-forwarded-for": `9.9.9.${i}, 5.5.5.5` } });
  }
  const r = await app.request("/a/x", { headers: { "x-forwarded-for": "9.9.9.99, 5.5.5.5" } });
  assert.equal(r.status, 429);
});
