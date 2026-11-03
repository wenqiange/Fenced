import type { Priority } from "@fenced/core";
import { applySyncedState, getAppState, setRemoteId, type LocalTask } from "../local-store";
import {
  deleteRemote,
  DependencyPending,
  findLocal,
  localIdOf,
  remoteIdOf,
  toIso,
  type Client,
  type PushHandler,
} from "./common";
import { fetchAllPages, mergeRemote } from "./merge";
import { enqueue, hasPendingUpsert, pendingDeleteRemoteIds } from "./outbox";

interface RemoteTask {
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
  updatedAt: Date | string;
  projectId: string | null;
  checklist?: { id: string; title: string; done: boolean }[] | null;
  blockedByTaskIds?: string[];
}

function payload(task: LocalTask) {
  const projectId = remoteIdOf("projects", task.projectId);
  if (task.projectId && !projectId) throw new DependencyPending("project");
  return {
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    tags: task.tags,
    dueAt: task.dueAt,
    estimateMinutes: task.estimateMinutes,
    rrule: task.rrule,
    projectId,
    checklist: task.checklist,
    completedAt: task.completed ? (task.completedAt ?? new Date().toISOString()) : null,
  };
}

/** Blockers that already exist server-side; the rest follow once synced. */
function remoteBlockers(task: LocalTask): string[] {
  return task.blockedByTaskIds
    .map((id) => remoteIdOf("tasks", id))
    .filter((id): id is string => !!id);
}

export const pushTask: PushHandler = async (client, op) => {
  if (op.kind === "delete") return deleteRemote(op, (id) => client.task.delete.mutate({ id }));

  const task = findLocal("tasks", op.localId);
  if (!task) return { type: "ok" }; // deleted meanwhile; its delete op follows

  const body = payload(task);
  let remoteId = task.remoteId;
  if (!remoteId) {
    const created = await client.task.create.mutate({
      ...body,
      id: op.clientId,
      notes: body.notes || undefined,
      dueAt: body.dueAt ?? undefined,
      estimateMinutes: body.estimateMinutes ?? undefined,
      rrule: body.rrule ?? undefined,
      projectId: body.projectId ?? undefined,
      completedAt: body.completedAt ?? undefined,
    });
    remoteId = created.id;
    setRemoteId("tasks", task.id, remoteId);
    // Tasks that were waiting on this one as a blocker can now link it.
    for (const t of getAppState().tasks) {
      if (t.remoteId && t.blockedByTaskIds.includes(task.id)) enqueue("task", t.id, "upsert", t.remoteId);
    }
  } else {
    await client.task.update.mutate({ id: remoteId, ...body });
  }

  if (task.blockedByTaskIds.length > 0 || op.remoteId) {
    await client.task.setBlockedBy.mutate({ taskId: remoteId, blockedByTaskIds: remoteBlockers(task) });
  }
  return { type: "ok", remoteId };
};

export async function pullTasks(client: Client): Promise<void> {
  const remote = (await fetchAllPages((offset, limit) =>
    client.task.list.query({ offset, limit }),
  )) as RemoteTask[];

  const local = getAppState().tasks;
  // Remote → local ids, including rows this pull is about to create.
  const localFor = new Map<string, string>();
  for (const t of local) if (t.remoteId) localFor.set(t.remoteId, t.id);
  for (const r of remote) if (!localFor.has(r.id)) localFor.set(r.id, `task-remote-${r.id}`);

  const { rows, pushBack } = mergeRemote<LocalTask, RemoteTask>({
    local,
    remote,
    hasPendingUpsert: (id) => hasPendingUpsert("task", id),
    pendingDeletes: pendingDeleteRemoteIds("task"),
    remoteUpdatedAt: (r) => r.updatedAt,
    map: (r, existing) => ({
      id: localFor.get(r.id)!,
      remoteId: r.id,
      title: r.title,
      notes: r.notes ?? "",
      completed: r.completedAt != null,
      completedAt: toIso(r.completedAt),
      priority: r.priority,
      tags: r.tags ?? [],
      dueAt: toIso(r.dueAt),
      estimateMinutes: r.estimateMinutes,
      rrule: r.rrule ?? null,
      blockedByTaskIds: (r.blockedByTaskIds ?? [])
        .map((b) => localFor.get(b))
        .filter((b): b is string => !!b),
      projectId: localIdOf("projects", r.projectId) ?? existing?.projectId ?? null,
      checklist: r.checklist ?? [],
      createdAt: toIso(r.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(r.updatedAt) ?? new Date().toISOString(),
    }),
  });

  applySyncedState({ tasks: rows });
  for (const t of pushBack) enqueue("task", t.id, "upsert", t.remoteId);
}
