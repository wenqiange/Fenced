import type { createFencedClient } from "@fenced/api-client";
import { getAppState, getDefaultFence, type LocalAppState } from "../local-store";
import type { OpOutcome, OutboxOp } from "./outbox-core";

export type Client = ReturnType<typeof createFencedClient>;

export type PushHandler = (client: Client, op: OutboxOp) => Promise<OpOutcome>;

/**
 * Thrown when a row references a parent that has no server id yet. The
 * outbox treats it as retryable; parents flush first, so it clears quickly.
 */
export class DependencyPending extends Error {
  constructor(what: string) {
    super(`Waiting for ${what} to sync`);
  }
}

type Collection = "tasks" | "projects" | "fences" | "calendarEvents" | "fencedHours";

export function remoteIdOf(collection: Collection, localId: string | null): string | null {
  if (!localId) return null;
  const rows = getAppState()[collection] as { id: string; remoteId: string | null }[];
  return rows.find((r) => r.id === localId)?.remoteId ?? null;
}

export function localIdOf(collection: Collection, remoteId: string | null | undefined): string | null {
  if (!remoteId) return null;
  const rows = getAppState()[collection] as { id: string; remoteId: string | null }[];
  return rows.find((r) => r.remoteId === remoteId)?.id ?? null;
}

/** Server id of the fence a session/hour uses; the default when unset. */
export function remoteFenceId(localFenceId: string | null): string {
  const fence = localFenceId
    ? getAppState().fences.find((f) => f.id === localFenceId)
    : getDefaultFence();
  if (!fence) throw new DependencyPending("default fence");
  if (!fence.remoteId) throw new DependencyPending(`fence "${fence.name}"`);
  return fence.remoteId;
}

export function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : v.toISOString();
}

export function findLocal<K extends Collection | "sessionHistory">(
  collection: K,
  id: string,
): LocalAppState[K][number] | undefined {
  return (getAppState()[collection] as LocalAppState[K][number][]).find(
    (r: { id: string }) => r.id === id,
  );
}

/** Deletes are idempotent: the row being gone already is success. */
export async function deleteRemote(op: OutboxOp, del: (id: string) => Promise<unknown>): Promise<OpOutcome> {
  if (!op.remoteId) return { type: "ok" };
  try {
    await del(op.remoteId);
  } catch (err) {
    if ((err as { data?: { code?: string } })?.data?.code !== "NOT_FOUND") throw err;
  }
  return { type: "ok" };
}
