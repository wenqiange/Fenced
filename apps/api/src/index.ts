import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { sql } from "drizzle-orm";
import { appRouter } from "./trpc/routers";
import { createContext, type AppVariables } from "./trpc/context";
import { resolveAuth } from "./auth";
import { db } from "./db";

import { rateLimit } from "./rate-limit";
import { processStreakRollover } from "./jobs/streak-rollover";
import { processRetentionEnforcement } from "./jobs/retention-enforcement";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", cors());
app.use("/trpc/*", rateLimit({ windowMs: 60 * 1000, max: 100 }));

app.get("/health", async (c) => {
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    console.warn("[health] DB check failed:", err);
  }
  return c.json({
    status: dbOk ? "ok" : "degraded",
    database: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Cron Jobs Endpoint (Secured by Bearer CRON_SECRET or dev header)
app.post("/api/cron/streak-rollover", async (c) => {
  const secret = process.env.CRON_SECRET;
  const auth = c.req.header("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await processStreakRollover();
  return c.json({ success: true, ...result });
});

app.post("/api/cron/retention-enforcement", async (c) => {
  const secret = process.env.CRON_SECRET;
  const auth = c.req.header("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await processRetentionEnforcement();
  return c.json({ success: true, ...result });
});

app.use("*", resolveAuth);

app.use("/trpc/*", async (c) => {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c),
  });
  return response;
});

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});

export type { AppRouter } from "./trpc/routers";
