import { z } from "zod";
import { eq, and, isNull, isNotNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "../init";
import { tasks, taskDependencies } from "../../db/schema";

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

  /**
   * Replace the full blocker set for a task. `blockedByTaskIds` are remote UUIDs
   * of tasks that must complete before this one can be scheduled.
   */
  setBlockedBy: authedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        blockedByTaskIds: z.array(z.string().uuid()).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const uniqueBlockers = [...new Set(input.blockedByTaskIds)].filter(
        (id) => id !== input.taskId,
      );

      const owned = await ctx.db.query.tasks.findMany({
        where: and(
          eq(tasks.userId, ctx.userId),
          inArray(tasks.id, [input.taskId, ...uniqueBlockers]),
        ),
        columns: { id: true },
      });
      const ownedIds = new Set(owned.map((t) => t.id));
      if (!ownedIds.has(input.taskId)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      for (const id of uniqueBlockers) {
        if (!ownedIds.has(id)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown blocker task: ${id}`,
          });
        }
      }

      await ctx.db
        .delete(taskDependencies)
        .where(
          and(
            eq(taskDependencies.userId, ctx.userId),
            eq(taskDependencies.taskId, input.taskId),
          ),
        );

      if (uniqueBlockers.length > 0) {
        await ctx.db.insert(taskDependencies).values(
          uniqueBlockers.map((dependsOnTaskId) => ({
            userId: ctx.userId,
            taskId: input.taskId,
            dependsOnTaskId,
          })),
        );
      }

      return { taskId: input.taskId, blockedByTaskIds: uniqueBlockers };
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
      z
        .object({
          projectId: z.string().uuid().optional(),
          completed: z.boolean().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(tasks.userId, ctx.userId)];
      if (input.projectId) conditions.push(eq(tasks.projectId, input.projectId));
      if (input.completed === true) conditions.push(isNotNull(tasks.completedAt));
      if (input.completed === false) conditions.push(isNull(tasks.completedAt));

      const rows = await ctx.db.query.tasks.findMany({
        where: and(...conditions),
        limit: input.limit,
        offset: input.offset,
        orderBy: (t, { asc }) => [asc(t.position)],
      });

      const deps = await ctx.db.query.taskDependencies.findMany({
        where: eq(taskDependencies.userId, ctx.userId),
      });

      const blockersByTask = new Map<string, string[]>();
      for (const dep of deps) {
        const list = blockersByTask.get(dep.taskId) ?? [];
        list.push(dep.dependsOnTaskId);
        blockersByTask.set(dep.taskId, list);
      }

      return rows.map((row) => ({
        ...row,
        blockedByTaskIds: blockersByTask.get(row.id) ?? [],
      }));
    }),
});
