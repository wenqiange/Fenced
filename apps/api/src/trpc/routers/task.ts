import { z } from "zod";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { tasks } from "../../db/schema";

export const taskRouter = router({
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        notes: z.string().optional(),
        priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
        tags: z.array(z.string()).default([]),
        dueAt: z.string().datetime().optional(),
        estimateMinutes: z.number().int().positive().optional(),
        parentTaskId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        rrule: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .insert(tasks)
        .values({
          userId: ctx.userId,
          title: input.title,
          notes: input.notes,
          priority: input.priority,
          tags: input.tags,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          estimateMinutes: input.estimateMinutes,
          parentTaskId: input.parentTaskId,
          projectId: input.projectId,
          rrule: input.rrule,
        })
        .returning();
      return task;
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        notes: z.string().nullable().optional(),
        priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
        tags: z.array(z.string()).optional(),
        dueAt: z.string().datetime().nullable().optional(),
        estimateMinutes: z.number().int().positive().nullable().optional(),
        actualMinutes: z.number().int().min(0).nullable().optional(),
        parentTaskId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        rrule: z.string().nullable().optional(),
        position: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, dueAt, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (dueAt !== undefined) {
        values.dueAt = dueAt ? new Date(dueAt) : null;
      }
      const [task] = await ctx.db
        .update(tasks)
        .set(values)
        .where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)))
        .returning();
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  complete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(tasks)
        .set({ completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.userId)))
        .returning();
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  uncomplete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .update(tasks)
        .set({ completedAt: null, updatedAt: new Date() })
        .where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.userId)))
        .returning();
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [task] = await ctx.db
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.userId)))
        .returning();
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  list: authedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        completed: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(tasks.userId, ctx.userId)];
      if (input.projectId) conditions.push(eq(tasks.projectId, input.projectId));
      if (input.completed === true) conditions.push(isNotNull(tasks.completedAt));
      if (input.completed === false) conditions.push(isNull(tasks.completedAt));

      return ctx.db.query.tasks.findMany({
        where: and(...conditions),
        limit: input.limit,
        offset: input.offset,
        orderBy: (t, { asc }) => [asc(t.position)],
      });
    }),
});
