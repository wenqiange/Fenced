/**
 * Pure outbox logic: coalescing, scheduling, backoff, error classification.
 *
 * Ops never carry entity payloads. An `upsert` is executed against whatever
 * the entity looks like at flush time, so ten offline edits collapse into one
 * request. Only `delete` needs to remember the remote id, because the local
 * row is already gone.
 */

export type SyncEntity =
  | "fence"
  | "project"
  | "task"
  | "calendarEvent"
  | "fencedHour"
  | "session";

export type OpKind = "upsert" | "delete";

export interface OutboxOp {
  key: string;
  entity: SyncEntity;
  localId: string;
  kind: OpKind;
  /** Known server id. For an un-acked create this is null. */
  remoteId: string | null;
  /** UUID sent as the server id on create, so retries are idempotent. */
  clientId: string;
  /** Bumped on every enqueue; a completion for an older seq is stale. */
  seq: number;
  attempts: number;
  nextAttemptAt: number;
  enqueuedAt: number;
  lastError: string | null;
}

/** Parents first, so a child's foreign key resolves in the same flush. */
const ENTITY_ORDER: Record<SyncEntity, number> = {
  fence: 0,
  project: 1,
  task: 2,
  calendarEvent: 3,
  fencedHour: 4,
  session: 5,
};

export const opKey = (entity: SyncEntity, localId: string) => `${entity}:${localId}`;

export function enqueueOp(
  ops: readonly OutboxOp[],
  input: { entity: SyncEntity; localId: string; kind: OpKind; remoteId: string | null },
  now: number,
  newClientId: () => string,
): OutboxOp[] {
  const key = opKey(input.entity, input.localId);
  const existing = ops.find((o) => o.key === key);
  const rest = ops.filter((o) => o.key !== key);

  if (!existing) {
    return [
      ...rest,
      {
        key,
        entity: input.entity,
        localId: input.localId,
        kind: input.kind,
        remoteId: input.remoteId,
        clientId: newClientId(),
        seq: 1,
        attempts: 0,
        nextAttemptAt: now,
        enqueuedAt: now,
        lastError: null,
      },
    ];
  }

  // An un-acked create may still have landed (or be in flight), so a delete
  // targets the id we asked the server to use. NOT_FOUND then means success.
  const remoteId =
    input.remoteId ??
    existing.remoteId ??
    (input.kind === "delete" ? existing.clientId : null);

  return [
    ...rest,
    {
      ...existing,
      kind: input.kind,
      remoteId,
      seq: existing.seq + 1,
      attempts: 0,
      nextAttemptAt: now,
      lastError: null,
    },
  ];
}

export function dueOps(ops: readonly OutboxOp[], now: number): OutboxOp[] {
  return ops
    .filter((o) => o.nextAttemptAt <= now)
    .sort(
      (a, b) =>
        ENTITY_ORDER[a.entity] - ENTITY_ORDER[b.entity] || a.enqueuedAt - b.enqueuedAt,
    );
}

/** 2s, 4s, 8s … capped at 15 min, with ±25% jitter to avoid thundering herds. */
export function backoffMs(attempts: number, random = Math.random): number {
  const base = Math.min(15 * 60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.75 + random() * 0.5));
}

export type OpOutcome =
  | { type: "ok"; remoteId?: string }
  | { type: "retry"; error: string }
  | { type: "drop"; error: string };

/**
 * Applies a finished attempt. `seq` guards against an edit that arrived while
 * the request was in flight: that op stays queued (due now) instead of being
 * removed with changes the server never saw.
 */
export function settleOp(
  ops: readonly OutboxOp[],
  key: string,
  seq: number,
  outcome: OpOutcome,
  now: number,
  random = Math.random,
): OutboxOp[] {
  return ops.flatMap((o) => {
    if (o.key !== key) return [o];
    if (o.seq !== seq) {
      return [{ ...o, remoteId: o.remoteId ?? (outcome.type === "ok" ? outcome.remoteId ?? null : null), nextAttemptAt: now }];
    }
    if (outcome.type === "ok" || outcome.type === "drop") return [];
    const attempts = o.attempts + 1;
    return [{ ...o, attempts, lastError: outcome.error, nextAttemptAt: now + backoffMs(attempts, random) }];
  });
}

/** Must match the message thrown by the API's `authedProcedure`. */
export const GUARDIAN_PENDING = "Guardian consent pending";

export type ErrorClass ="retry" | "drop" | "not-found" | "pause";

/** Maps a tRPC client error (or a network failure) onto what the queue should do. */
export function classifyError(err: unknown): ErrorClass {
  const e = err as { data?: { code?: string }; message?: string } | null;
  const code = e?.data?.code;
  switch (code) {
    case "NOT_FOUND":
      return "not-found";
    // Auth or consent state must change before anything can succeed; keep the
    // op and stop the flush without burning attempts.
    case "UNAUTHORIZED":
      return "pause";
    case "FORBIDDEN":
      return e?.message === GUARDIAN_PENDING ? "pause" : "drop";
    case "BAD_REQUEST":
    case "PARSE_ERROR":
    case "CONFLICT":
    case "UNPROCESSABLE_CONTENT":
    case "METHOD_NOT_SUPPORTED":
      return "drop";
    default:
      // Network errors, timeouts, 429 and 5xx.
      return "retry";
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
