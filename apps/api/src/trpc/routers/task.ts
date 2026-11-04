import { z } from "zod";
import { eq, and, ne, isNull, isNotNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, existingOrConflict } from "../init";
import { tasks, taskDependencies } from "../../db/schema";

function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

const ChecklistSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      title: z.string().min(1).max(200),
      done: z.boolean(),
    }),
  )
  .max(100);

export const taskRouter = router({
  create: authedProcedure
    .input(
      z.object({
        /** Client-generated id: makes a retried offline create idempotent. */
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(500),
        notes: z.string().max(5000).optional(),
        priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
        tags: z.array(z.string().min(1).max(50)).max(20).default([]),
        dueAt: z.string().datetime().optional(),
        estimateMinutes: z.number().int().positive().optional(),
        parentTaskId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        rrule: z.string().optional(),
        checklist: ChecklistSchema.default([]),
        completedAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate subtask depth max 3 levels
      if (input.parentTaskId) {
        let currentParentId: string | null = input.parentTaskId;
        let depth = 1;
        while (currentParentId && depth <= 3) {
          const parent: { id: string; parentTaskId: string | null } | undefined =
            await ctx.db.query.tasks.findFirst({
              where: and(eq(tasks.id, currentParentId), eq(tasks.userId, ctx.userId)),
              columns: { id: true, parentTaskId: true },
            });
          if (!parent) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Parent task '${currentParentId}' not found`,
            });
          }
          currentParentId = parent.parentTaskId;
          depth++;
        }
        if (depth > 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subtask depth cannot exceed 3 levels",
          });
        }
      }

      const sanitizedTags = input.tags.map(sanitizeText);

      const [task] = await ctx.db
        .insert(tasks)
        .values({
          id: input.id,
          userId: ctx.userId,
          title: sanitizeText(input.title),
          notes: input.notes ? sanitizeText(input.notes) : undefined,
          priority: input.priority,
          tags: sanitizedTags,
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          estimateMinutes: input.estimateMinutes,
          parentTaskId: input.parentTaskId,
          projectId: input.projectId,
          rrule: input.rrule,
          checklist: input.checklist.map((c) => ({ ...c, title: sanitizeText(c.title) })),
          completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
        })
        .onConflictDoNothing({ target: tasks.id })
        .returning();
      if (task) return task;
      return existingOrConflict(
        await ctx.db.query.tasks.findFirst({
          where: and(eq(tasks.id, input.id!), eq(tasks.userId, ctx.userId)),
        }),
      );
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        notes: z.string().max(5000).nullable().optional(),
        priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
        tags: z.array(z.string().min(1).max(50)).max(20).optional(),
        dueAt: z.string().datetime().nullable().optional(),
        estimateMinutes: z.number().int().positive().nullable().optional(),
        actualMinutes: z.number().int().min(0).nullable().optional(),
        parentTaskId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        rrule: z.string().max(200).nullable().optional(),
        position: z.number().int().optional(),
        checklist: ChecklistSchema.optional(),
        /** `null` reopens the task; a timestamp completes it at that instant. */
        completedAt: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, dueAt, completedAt, ...rest } = input;
      const values: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (rest.title !== undefined) values.title = sanitizeText(rest.title);
      if (rest.notes) values.notes = sanitizeText(rest.notes);
      if (rest.tags) values.tags = rest.tags.map(sanitizeText);
      if (dueAt !== undefined) {
        values.dueAt = dueAt ? new Date(dueAt) : null;
      }
      if (completedAt !== undefined) {
        values.completedAt = completedAt ? new Date(completedAt) : null;
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
      if (input.blockedByTaskIds.includes(input.taskId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A task cannot depend on itself",
        });
      }

      const uniqueBlockers = [...new Set(input.blockedByTaskIds)];

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

      if (uniqueBlockers.length > 0) {
        const existingDeps = await ctx.db.query.taskDependencies.findMany({
          where: and(
            eq(taskDependencies.userId, ctx.userId),
            ne(taskDependencies.taskId, input.taskId),
          ),
          columns: { taskId: true, dependsOnTaskId: true },
        });

        const adj = new Map<string, string[]>();
        for (const dep of existingDeps) {
          const list = adj.get(dep.taskId) ?? [];
          list.push(dep.dependsOnTaskId);
          adj.set(dep.taskId, list);
        }

        const visited = new Set<string>();
        const queue = [...uniqueBlockers];
        let hasCycle = false;
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (current === input.taskId) {
            hasCycle = true;
            break;
          }
          if (visited.has(current)) continue;
          visited.add(current);
          const nextNodes = adj.get(current) ?? [];
          for (const next of nextNodes) {
            if (!visited.has(next)) {
              queue.push(next);
            }
          }
        }

        if (hasCycle) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Adding these dependencies would create a circular dependency cycle",
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
        // `id` breaks position ties so offset paging never skips or repeats rows.
        orderBy: (t, { asc }) => [asc(t.position), asc(t.id)],
      });

      const deps =
        rows.length === 0
          ? []
          : await ctx.db.query.taskDependencies.findMany({
              where: and(
                eq(taskDependencies.userId, ctx.userId),
                inArray(
                  taskDependencies.taskId,
                  rows.map((r) => r.id),
                ),
              ),
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
