import type { createFencedClient } from "@fenced/api-client";
import type { Priority } from "@fenced/core";
import {
  addTask,
  getAppState,
  replaceTasksFromSync,
  setTaskRemoteId,
  type LocalTask,
} from "../local-store";

type Client = ReturnType<typeof createFencedClient>;

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  return d.toISOString();
}

function localIdForRemote(remoteId: string): string {
  return `remote-${remoteId}`;
}

function mapRemoteTask(row: {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  tags: string[];
  dueAt: Date | string | null;
  estimateMinutes: number | null;
  rrule: string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  blockedByTaskIds?: string[];
}): LocalTask {
  return {
    id: localIdForRemote(row.id),
    remoteId: row.id,
    title: row.title,
    notes: row.notes ?? "",
    completed: row.completedAt != null,
    priority: row.priority,
    tags: row.tags ?? [],
    dueAt: toIso(row.dueAt),
    estimateMinutes: row.estimateMinutes,
    rrule: row.rrule ?? null,
    blockedByTaskIds: (row.blockedByTaskIds ?? []).map(localIdForRemote),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function remoteIdsForLocalBlockers(localIds: string[]): string[] {
  const tasks = getAppState().tasks;
  const remotes: string[] = [];
  for (const localId of localIds) {
    const blocker = tasks.find((t) => t.id === localId);
    if (blocker?.remoteId) remotes.push(blocker.remoteId);
  }
  return remotes;
}

export async function pullTasksFromApi(client: Client): Promise<boolean> {
  try {
    const remote = await client.task.list.query({
      limit: 100,
    });
    const localOnly = getAppState().tasks.filter((t) => !t.remoteId);
    const merged = [
      ...localOnly,
      ...remote.map((r) =>
        mapRemoteTask({
          ...r,
          dueAt: r.dueAt ?? null,
          rrule: r.rrule ?? null,
          completedAt: r.completedAt ?? null,
          blockedByTaskIds: r.blockedByTaskIds ?? [],
        })
      ),
    ];
    replaceTasksFromSync(merged);
    return true;
  } catch {
    return false;
  }
}

export async function pushTaskDependencies(
  client: Client,
  localTask: LocalTask
): Promise<void> {
  if (!localTask.remoteId) return;
  try {
    await client.task.setBlockedBy.mutate({
      taskId: localTask.remoteId,
      blockedByTaskIds: remoteIdsForLocalBlockers(localTask.blockedByTaskIds ?? []),
    });
  } catch {
    /* best-effort */
  }
}

export async function pushTaskCreate(
  client: Client,
  localTask: LocalTask
): Promise<void> {
  if (localTask.remoteId) return;
  try {
    const created = await client.task.create.mutate({
      title: localTask.title,
      notes: localTask.notes || undefined,
      priority: localTask.priority,
      tags: localTask.tags,
      dueAt: localTask.dueAt ?? undefined,
      estimateMinutes: localTask.estimateMinutes ?? undefined,
      rrule: localTask.rrule ?? undefined,
    });
    setTaskRemoteId(localTask.id, created.id);
    const updated = getAppState().tasks.find((t) => t.id === localTask.id);
    if (updated) await pushTaskDependencies(client, updated);
  } catch {
    /* offline or no profile */
  }
}

export async function pushTaskUpdate(
  client: Client,
  localTask: LocalTask
): Promise<void> {
  if (!localTask.remoteId) {
    await pushTaskCreate(client, localTask);
    return;
  }
  try {
    await client.task.update.mutate({
      id: localTask.remoteId,
      title: localTask.title,
      notes: localTask.notes,
      priority: localTask.priority,
      tags: localTask.tags,
      dueAt: localTask.dueAt,
      estimateMinutes: localTask.estimateMinutes,
      rrule: localTask.rrule,
    });
    if (localTask.completed) {
      await client.task.complete.mutate({ id: localTask.remoteId });
    } else {
      await client.task.uncomplete.mutate({ id: localTask.remoteId });
    }
    await pushTaskDependencies(client, localTask);
  } catch {
    /* best-effort */
  }
}

export async function syncTasksIfSignedIn(
  client: Client,
  signedIn: boolean
): Promise<void> {
  if (!signedIn) return;
  await pullTasksFromApi(client);
  const { tasks } = getAppState();
  for (const task of tasks.filter((t) => !t.remoteId && !t.completed)) {
    await pushTaskCreate(client, task);
  }
  // Second pass: local-only blockers may have just received remote ids.
  for (const task of getAppState().tasks.filter(
    (t) => t.remoteId && (t.blockedByTaskIds?.length ?? 0) > 0
  )) {
    await pushTaskDependencies(client, task);
  }
}

export function createLocalTaskWithSync(
  client: Client | null,
  signedIn: boolean,
  input: Parameters<typeof addTask>[0]
) {
  const task = addTask(input);
  if (client && signedIn) {
    void pushTaskCreate(client, task);
  }
  return task;
}
