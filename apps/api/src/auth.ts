import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "./trpc/context";

function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Resolves Authorization Bearer → clerkId.
 * Supports:
 * - `dev:<id>` local scaffold tokens (no Clerk secret required)
 * - Clerk session JWTs when CLERK_SECRET_KEY or CLERK_JWT_KEY is set
 * - Local development unverified JWT claim extraction when CLERK_SECRET_KEY is unset
 */
export const resolveAuth: MiddlewareHandler<{
  Variables: AppVariables;
}> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    await next();
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    await next();
    return;
  }

  if (token.startsWith("dev:")) {
    const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    if (!isProd) {
      const devId = token.slice("dev:".length) || "dev-user-local";
      c.set("clerkId", devId);
      console.info(`[auth] Dev authentication active for clerkId: ${devId}`);
    } else {
      console.warn(
        "[auth] SECURITY WARNING: Rejected dev token in production environment."
      );
    }
    await next();
    return;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
    const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    if (!isProd) {
      const sub = decodeJwtSub(token);
      if (sub) {
        c.set("clerkId", sub);
        console.info(`[auth] Dev mode: extracted clerkId '${sub}' from Clerk JWT (CLERK_SECRET_KEY unset)`);
        await next();
        return;
      }
    }
    console.warn(
      "[auth] Clerk JWT received but CLERK_SECRET_KEY / CLERK_JWT_KEY unset"
    );
    await next();
    return;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey,
      jwtKey,
    });
    if (payload.sub) {
      c.set("clerkId", payload.sub);
    }
  } catch (err) {
    console.warn("[auth] Clerk token verification failed", err);
  }

  await next();
};
