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

function mapRemoteTask(row: {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  tags: string[];
  dueAt: Date | string | null;
  estimateMinutes: number | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
}): LocalTask {
  return {
    id: `remote-${row.id}`,
    remoteId: row.id,
    title: row.title,
    notes: row.notes ?? "",
    completed: row.completedAt != null,
    priority: row.priority,
    tags: row.tags ?? [],
    dueAt: toIso(row.dueAt),
    estimateMinutes: row.estimateMinutes,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
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
          completedAt: r.completedAt ?? null,
        })
      ),
    ];
    replaceTasksFromSync(merged);
    return true;
  } catch {
    return false;
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
    });
    setTaskRemoteId(localTask.id, created.id);
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
    });
    if (localTask.completed) {
      await client.task.complete.mutate({ id: localTask.remoteId });
    } else {
      await client.task.uncomplete.mutate({ id: localTask.remoteId });
    }
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
