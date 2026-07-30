import { z } from "zod";
import { eq } from "drizzle-orm";
import { AgeBand, AssuranceMethod } from "@fenced/core";
import { router, authedProcedure, clerkProcedure, publicProcedure } from "../init";
import { users, consentEvents } from "../../db/schema";

export const userRouter = router({
  me: authedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    return user ?? null;
  }),

  ensureProfile: clerkProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100),
        email: z.string().email().nullable().optional(),
        ageBand: AgeBand,
        jurisdiction: z.string().min(2).max(5),
        assuranceMethod: AssuranceMethod,
        childrensCodeApplies: z.boolean(),
        guardianEmail: z.string().email().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(users)
        .where(eq(users.clerkId, ctx.clerkId))
        .limit(1);

      if (existing[0]) {
        const [updated] = await ctx.db
          .update(users)
          .set({
            displayName: input.displayName,
            email: input.email ?? existing[0].email,
            ageBand: input.ageBand,
            jurisdiction: input.jurisdiction,
            assuranceMethod: input.assuranceMethod,
            childrensCodeApplies: input.childrensCodeApplies,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing[0].id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(users)
        .values({
          clerkId: ctx.clerkId,
          displayName: input.displayName,
          email: input.email ?? null,
          ageBand: input.ageBand,
          jurisdiction: input.jurisdiction,
          assuranceMethod: input.assuranceMethod,
          assuranceAt: new Date(),
          childrensCodeApplies: input.childrensCodeApplies,
        })
        .returning();

      if (input.guardianEmail) {
        await ctx.db.insert(consentEvents).values({
          userId: created.id,
          guardianEmail: input.guardianEmail,
          method: "email-notice",
          scope: "coppa-account",
          noticeVersion: "mvp-1",
          grantedAt: null,
        });
      }

      return created;
    }),

  healthAuth: publicProcedure.query(({ ctx }) => ({
    authenticated: Boolean(ctx.clerkId),
    hasProfile: Boolean(ctx.userId),
    clerkId: ctx.clerkId ?? null,
    userId: ctx.userId ?? null,
  })),
});
