import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { fences } from "../../db/schema";

export const fenceRouter = router({
  create: authedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        appTokens: z.array(z.string()),
        categoryTokens: z.array(z.string()),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [fence] = await ctx.db
        .insert(fences)
        .values({
          userId: ctx.userId,
          name: input.name,
          appTokens: input.appTokens,
          categoryTokens: input.categoryTokens,
          isDefault: input.isDefault,
        })
        .returning();
      return fence;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        appTokens: z.array(z.string()).optional(),
        categoryTokens: z.array(z.string()).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [fence] = await ctx.db
        .update(fences)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(fences.id, id), eq(fences.userId, ctx.userId)))
        .returning();
      if (!fence) throw new TRPCError({ code: "NOT_FOUND" });
      return fence;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [fence] = await ctx.db
        .delete(fences)
        .where(and(eq(fences.id, input.id), eq(fences.userId, ctx.userId)))
        .returning();
      if (!fence) throw new TRPCError({ code: "NOT_FOUND" });
      return fence;
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.fences.findMany({
      where: eq(fences.userId, ctx.userId),
      orderBy: (f, { asc }) => [asc(f.name)],
    });
  }),
});
