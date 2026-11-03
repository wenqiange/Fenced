import { applySyncedState, getAppState, setRemoteId, type SessionHistoryEntry } from "../local-store";
import { findLocal, localIdOf, remoteFenceId, remoteIdOf, toIso, type Client, type PushHandler } from "./common";
import { fetchAllPages } from "./merge";

interface RemoteSession {
  id: string;
  status: "armed" | "active" | "completed" | "abandoned";
  presetName: string | null;
  durationMinutes: number;
  strictDelayMinutes: number;
  shieldHits: number;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  abandonedAt: Date | string | null;
  linkedTaskId: string | null;
  fenceId: string;
}

/**
 * Sessions are recorded once finished. Each step is idempotent server-side,
 * so a retry after a dropped response simply replays the remaining steps.
 */
export const pushSession: PushHandler = async (client, op) => {
  // History is append-only; nothing deletes sessions individually.
  if (op.kind === "delete") return { type: "ok" };
  const entry = findLocal("sessionHistory", op.localId);
  if (!entry) return { type: "ok" };

  let remoteId = entry.remoteId;
  if (!remoteId) {
    const created = await client.session.create.mutate({
      id: op.clientId,
      fenceId: remoteFenceId(entry.fenceId),
      durationMinutes: Math.max(1, entry.plannedMinutes),
      strictDelayMinutes: entry.strictDelayMinutes,
      presetName: entry.presetLabel,
      linkedTaskId: remoteIdOf("tasks", entry.linkedTaskId) ?? undefined,
    });
    remoteId = created.id;
    setRemoteId("sessionHistory", entry.id, remoteId);
  }

  await client.session.start.mutate({ sessionId: remoteId, startedAt: entry.startedAt });
  if (entry.status === "completed") {
    await client.session.complete.mutate({
      sessionId: remoteId,
      completedAt: entry.completedAt,
      shieldHits: entry.shieldHits,
    });
  } else {
    await client.session.abandon.mutate({
      sessionId: remoteId,
      abandonedAt: entry.completedAt,
      shieldHits: entry.shieldHits,
    });
  }
  return { type: "ok", remoteId };
};

/** Adds sessions finished on other devices. Local history is never pruned. */
export async function pullSessions(client: Client): Promise<void> {
  const remote = (await fetchAllPages(
    (offset, limit) => client.session.list.query({ offset, limit }),
    100,
    10,
  )) as RemoteSession[];

  const history = getAppState().sessionHistory;
  const known = new Set(history.map((h) => h.remoteId).filter(Boolean));
  const added: SessionHistoryEntry[] = [];

  for (const r of remote) {
    if (known.has(r.id)) continue;
    if (r.status !== "completed" && r.status !== "abandoned") continue;
    const end = toIso(r.completedAt ?? r.abandonedAt);
    const start = toIso(r.startedAt) ?? end;
    if (!end || !start) continue;
    const actual =
      r.status === "completed"
        ? r.durationMinutes
        : Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
    added.push({
      id: `sess-remote-${r.id}`,
      remoteId: r.id,
      startedAt: start,
      completedAt: end,
      durationMinutes: Math.max(0, actual),
      plannedMinutes: r.durationMinutes,
      strictDelayMinutes: r.strictDelayMinutes,
      shieldHits: r.shieldHits,
      presetLabel: r.presetName ?? "Focus",
      practice: false,
      linkedTaskId: localIdOf("tasks", r.linkedTaskId),
      fenceId: localIdOf("fences", r.fenceId),
      status: r.status,
      emergencyPassesUsed: 0,
    });
  }
  if (added.length === 0) return;
  applySyncedState({
    sessionHistory: [...history, ...added].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  });
}
