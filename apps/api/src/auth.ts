import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "./trpc/context";

let cachedSupabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (url && key) {
    cachedSupabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return cachedSupabase;
}

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

  const supabase = getSupabaseClient();
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
