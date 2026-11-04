import { createClient } from "@supabase/supabase-js";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "./trpc/context";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

/**
 * Resolves Authorization Bearer → authId (Supabase user id).
 * Supports:
 * - `dev:<id>` local scaffold tokens (rejected in production)
 * - Supabase access tokens, verified with auth.getUser()
 */
// shortcut: getUser() is one network call per request; verify the JWT locally against the JWKS if latency matters.
export const resolveAuth: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    await next();
    return;
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (token.startsWith("dev:")) {
    if (!isProd) {
      const devId = token.slice("dev:".length) || "dev-user-local";
      c.set("authId", devId);
      console.info(`[auth] Dev token active for authId '${devId}' on ${c.req.path}`);
    } else {
      console.warn(`[auth] SECURITY WARNING: Rejected dev token in production on ${c.req.path}`);
    }
    await next();
    return;
  }

  if (!supabase) {
    console.warn("[auth] Supabase token received but SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY unset");
    await next();
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (data.user) c.set("authId", data.user.id);
  else console.warn("[auth] Supabase token verification failed", error?.message);

  await next();
};
