import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import superjson from "superjson";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    message: error.code === "INTERNAL_SERVER_ERROR" ? "Internal server error" : shape.message,
    data: {
      ...shape.data,
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
      zodError:
        error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Signed in with Supabase/dev token, profile may not exist yet. */
export const signedInProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.authId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, authId: ctx.authId } });
});

/** Signed in and has a persisted user row. */
export const authedProcedure = signedInProcedure.use(async ({ ctx, path, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Complete profile setup first",
    });
  }
  // COPPA: a child without verified guardian consent stays device-only. The
  // `user.*` routes remain open so the account can always be exported/deleted.
  if (ctx.needsGuardianConsent && !path.startsWith("user.")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Guardian consent pending",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      authId: ctx.authId,
    },
  });
});

/**
 * Resolves a client-keyed insert that hit `ON CONFLICT DO NOTHING`.
 *
 * Offline clients send their own UUID as `id` so a retried create is a no-op.
 * The row must belong to the caller, otherwise the id collided with someone
 * else's record and the client must not learn anything about it.
 */
export function existingOrConflict<T>(row: T | undefined): T {
  if (!row) throw new TRPCError({ code: "CONFLICT", message: "Id already in use" });
  return row;
}
