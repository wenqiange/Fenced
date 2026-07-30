import { verifyToken } from "@clerk/backend";
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "./trpc/context";

/**
 * Resolves Authorization Bearer → clerkId.
 * Supports:
 * - `dev:<id>` local scaffold tokens (no Clerk secret required)
 * - Clerk session JWTs when CLERK_SECRET_KEY or CLERK_JWT_KEY is set
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
    c.set("clerkId", token.slice("dev:".length) || "dev-user-local");
    await next();
    return;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!secretKey && !jwtKey) {
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
