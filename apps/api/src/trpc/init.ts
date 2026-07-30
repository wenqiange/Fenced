import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Signed in with Clerk/dev token, profile may not exist yet. */
export const clerkProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.clerkId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, clerkId: ctx.clerkId } });
});

/** Signed in and has a persisted user row. */
export const authedProcedure = clerkProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Complete profile setup first",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      clerkId: ctx.clerkId,
    },
  });
});
