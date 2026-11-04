import { applySyncedState, getAppState, setRemoteId, type LocalFence, type LocalProject } from "../local-store";
import { deleteRemote, findLocal, toIso, type Client, type PushHandler } from "./common";
import { mergeRemote } from "./merge";
import { enqueue, hasPendingUpsert, pendingCreateMap, pendingDeleteRemoteIds } from "./outbox";

interface RemoteFence {
  id: string;
  name: string;
  appTokens: string[];
  categoryTokens: string[];
  isDefault: boolean;
  updatedAt: Date | string;
}

interface RemoteProject {
  id: string;
  name: string;
  color: string | null;
  updatedAt: Date | string;
}

export const pushFence: PushHandler = async (client, op) => {
  if (op.kind === "delete") return deleteRemote(op, (id) => client.fence.delete.mutate({ id }));
  const fence = findLocal("fences", op.localId);
  if (!fence) return { type: "ok" };
  const body = {
    name: fence.name,
    appTokens: fence.appTokens,
    categoryTokens: fence.categoryTokens,
    isDefault: fence.isDefault,
  };
  if (!fence.remoteId) {
    const created = await client.fence.create.mutate({ ...body, id: op.clientId });
    setRemoteId("fences", fence.id, created.id);
    return { type: "ok", remoteId: created.id };
  }
  await client.fence.update.mutate({ id: fence.remoteId, ...body });
  return { type: "ok", remoteId: fence.remoteId };
};

export async function pullFences(client: Client): Promise<void> {
  const remote = (await client.fence.list.query()) as RemoteFence[];
  const { rows, pushBack } = mergeRemote<LocalFence, RemoteFence>({
    local: getAppState().fences,
    remote,
    hasPendingUpsert: (id) => hasPendingUpsert("fence", id),
    pendingDeletes: pendingDeleteRemoteIds("fence"),
    pendingCreates: pendingCreateMap("fence"),
    remoteUpdatedAt: (r) => r.updatedAt,
    map: (r, existing) => ({
      id: existing?.id ?? `fence-remote-${r.id}`,
      remoteId: r.id,
      name: r.name,
      appTokens: r.appTokens,
      categoryTokens: r.categoryTokens,
      isDefault: r.isDefault,
      updatedAt: toIso(r.updatedAt)!,
    }),
  });
  // A second device would otherwise mint its own default on first launch:
  // keep exactly one, preferring the server's.
  const serverDefault = rows.find((f) => f.remoteId && f.isDefault);
  const deduped = serverDefault
    ? rows.filter((f) => !(f.isDefault && !f.remoteId && f !== serverDefault))
    : rows;
  applySyncedState({ fences: deduped });
  for (const f of pushBack) enqueue("fence", f.id, "upsert", f.remoteId);
}

export const pushProject: PushHandler = async (client, op) => {
  if (op.kind === "delete") return deleteRemote(op, (id) => client.project.delete.mutate({ id }));
  const project = findLocal("projects", op.localId);
  if (!project) return { type: "ok" };
  if (!project.remoteId) {
    const created = await client.project.create.mutate({
      id: op.clientId,
      name: project.name,
      color: project.color,
    });
    setRemoteId("projects", project.id, created.id);
    return { type: "ok", remoteId: created.id };
  }
  await client.project.update.mutate({ id: project.remoteId, name: project.name, color: project.color });
  return { type: "ok", remoteId: project.remoteId };
};

export async function pullProjects(client: Client): Promise<void> {
  const remote = (await client.project.list.query()) as RemoteProject[];
  const { rows, pushBack } = mergeRemote<LocalProject, RemoteProject>({
    local: getAppState().projects,
    remote,
    hasPendingUpsert: (id) => hasPendingUpsert("project", id),
    pendingDeletes: pendingDeleteRemoteIds("project"),
    pendingCreates: pendingCreateMap("project"),
    remoteUpdatedAt: (r) => r.updatedAt,
    map: (r, existing) => ({
      id: existing?.id ?? `proj-remote-${r.id}`,
      remoteId: r.id,
      name: r.name,
      color: r.color,
      updatedAt: toIso(r.updatedAt)!,
    }),
  });
  applySyncedState({ projects: rows });
  for (const p of pushBack) enqueue("project", p.id, "upsert", p.remoteId);
}
