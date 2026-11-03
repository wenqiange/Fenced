import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, existingOrConflict } from "../init";
import { projects, tasks } from "../../db/schema";

const Name = z
  .string()
  .min(1)
  .max(100)
  .transform((v) => v.replace(/<[^>]*>/g, "").trim());
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const projectRouter = router({
  create: authedProcedure
    .input(
      z.object({
        /** Client-generated id: makes a retried offline create idempotent. */
        id: z.string().uuid().optional(),
        name: Name,
        color: Color.nullable().optional(),
        position: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .insert(projects)
        .values({
          id: input.id,
          userId: ctx.userId,
          name: input.name,
          color: input.color ?? null,
          position: input.position,
        })
        .onConflictDoNothing({ target: projects.id })
        .returning();
      if (project) return project;
      return existingOrConflict(
        await ctx.db.query.projects.findFirst({
          where: and(eq(projects.id, input.id!), eq(projects.userId, ctx.userId)),
        }),
      );
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: Name.optional(),
        color: Color.nullable().optional(),
        position: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [project] = await ctx.db
        .update(projects)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(projects.id, id), eq(projects.userId, ctx.userId)))
        .returning();
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      return project;
    }),

  /** Tasks survive their project: they are detached, not deleted. */
  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        await tx
          .update(tasks)
          .set({ projectId: null, updatedAt: new Date() })
          .where(and(eq(tasks.projectId, input.id), eq(tasks.userId, ctx.userId)));
        const [project] = await tx
          .delete(projects)
          .where(and(eq(projects.id, input.id), eq(projects.userId, ctx.userId)))
          .returning();
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        return project;
      });
    }),

  list: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.projects.findMany({
      where: eq(projects.userId, ctx.userId),
      orderBy: (p, { asc }) => [asc(p.position), asc(p.name)],
    });
  }),
});
