import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/routers";
import { createContext, type AppVariables } from "./trpc/context";
import { resolveAuth } from "./auth";

const app = new Hono<{ Variables: AppVariables }>();

app.get("/health", (c) => c.json({ status: "ok" }));

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
