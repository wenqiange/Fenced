import { z } from "zod";

export const Priority = z.enum(["none", "low", "medium", "high", "urgent"]);
export type Priority = z.infer<typeof Priority>;

export const Task = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  parentTaskId: z.string().uuid().nullable(),
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).nullable(),
  priority: Priority,
  tags: z.array(z.string()),
  dueAt: z.date().nullable(),
  estimateMinutes: z.number().int().positive().nullable(),
  actualMinutes: z.number().int().min(0).nullable(),
  rrule: z.string().nullable(),
  completedAt: z.date().nullable(),
  position: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  /**
   * Denormalized from task_dependencies: remote task UUIDs that block this task.
   * Present on list/read API responses; not a column on the tasks table.
   */
  blockedByTaskIds: z.array(z.string().uuid()).default([]),
});
export type Task = z.infer<typeof Task>;

/** Edge: taskId is blocked until dependsOnTaskId is complete. */
export const TaskDependency = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid(),
  dependsOnTaskId: z.string().uuid(),
  createdAt: z.date(),
});
export type TaskDependency = z.infer<typeof TaskDependency>;

export const Project = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  color: z.string().nullable(),
  position: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Project = z.infer<typeof Project>;
