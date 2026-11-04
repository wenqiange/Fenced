import AsyncStorage from "@react-native-async-storage/async-storage";
import { uuidv4 } from "../ids";
import {
  dueOps,
  enqueueOp,
  opKey,
  settleOp,
  type OpKind,
  type OpOutcome,
  type OutboxOp,
  type SyncEntity,
} from "./outbox-core";

export type { OutboxOp, SyncEntity } from "./outbox-core";

const STORAGE_KEY = "fenced.outbox.v1";

let ops: OutboxOp[] = [];
let hydrated = false;
let writeChain: Promise<void> = Promise.resolve();
const kickListeners = new Set<() => void>();

function persist() {
  const snapshot = JSON.stringify(ops);
  // Serialized so an older snapshot can never land after a newer one.
  writeChain = writeChain
    .then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot))
    .catch(() => {
      /* next write retries with the full queue */
    });
}

export async function hydrateOutbox(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const stored: OutboxOp[] = raw ? JSON.parse(raw) : [];
    // Ops enqueued before hydration finished (rare) win over stored ones.
    const fresh = new Set(ops.map((o) => o.key));
    ops = [...stored.filter((o) => !fresh.has(o.key)), ...ops];
  } catch {
    /* a corrupt queue is dropped; the next full sync re-enqueues local rows */
  }
  hydrated = true;
}

/** Called by the store on every mutation of a synced entity. */
export function enqueue(
  entity: SyncEntity,
  localId: string,
  kind: OpKind,
  remoteId: string | null,
) {
  ops = enqueueOp(ops, { entity, localId, kind, remoteId }, Date.now(), uuidv4);
  persist();
  for (const l of kickListeners) l();
}

export function onOutboxKick(listener: () => void) {
  kickListeners.add(listener);
  return () => {
    kickListeners.delete(listener);
  };
}

export function getDueOps(now = Date.now()) {
  return dueOps(ops, now);
}

export function settle(op: OutboxOp, outcome: OpOutcome) {
  ops = settleOp(ops, op.key, op.seq, outcome, Date.now());
  persist();
}

export function getOp(entity: SyncEntity, localId: string): OutboxOp | undefined {
  const key = opKey(entity, localId);
  return ops.find((o) => o.key === key);
}

/** Pulls must not overwrite rows with unsent local changes. */
export function hasPendingUpsert(entity: SyncEntity, localId: string): boolean {
  return getOp(entity, localId)?.kind === "upsert";
}

/** Remote ids deleted locally but not yet confirmed — hidden from pulls. */
export function pendingDeleteRemoteIds(entity: SyncEntity): Set<string> {
  return new Set(
    ops
      .filter((o) => o.entity === entity && o.kind === "delete" && o.remoteId)
      .map((o) => o.remoteId as string),
  );
}

/**
 * Maps in-flight clientIds (which the server uses as remote IDs) to their localIds.
 * When a pull runs while a create is in flight, this prevents mergeRemote from creating duplicate rows.
 */
export function pendingCreateMap(entity: SyncEntity): Map<string, string> {
  const map = new Map<string, string>();
  for (const o of ops) {
    if (o.entity === entity && o.kind === "upsert" && !o.remoteId) {
      map.set(o.clientId, o.localId);
    }
  }
  return map;
}

export function pendingCount(): number {
  return ops.length;
}

export async function clearOutbox() {
  ops = [];
  persist();
  await writeChain;
}
