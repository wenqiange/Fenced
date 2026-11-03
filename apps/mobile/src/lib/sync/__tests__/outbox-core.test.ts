import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backoffMs,
  classifyError,
  dueOps,
  enqueueOp,
  settleOp,
  GUARDIAN_PENDING,
  type OutboxOp,
} from "../outbox-core";

let n = 0;
const id = () => `cid-${++n}`;

test("repeated edits coalesce into one op", () => {
  let ops: OutboxOp[] = [];
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "upsert", remoteId: null }, 0, id);
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "upsert", remoteId: null }, 1, id);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].seq, 2);
});

test("delete after an un-acked create targets the client id", () => {
  let ops: OutboxOp[] = [];
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "upsert", remoteId: null }, 0, id);
  const clientId = ops[0].clientId;
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "delete", remoteId: null }, 1, id);
  assert.equal(ops[0].kind, "delete");
  assert.equal(ops[0].remoteId, clientId);
});

test("an edit during an in-flight request is not lost", () => {
  let ops: OutboxOp[] = [];
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "upsert", remoteId: null }, 0, id);
  const inflight = ops[0];
  ops = enqueueOp(ops, { entity: "task", localId: "a", kind: "upsert", remoteId: null }, 5, id);
  ops = settleOp(ops, inflight.key, inflight.seq, { type: "ok", remoteId: "r1" }, 10);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].remoteId, "r1");
  assert.equal(ops[0].nextAttemptAt, 10);
});

test("retry backs off; ok removes", () => {
  let ops = enqueueOp(
    [],
    { entity: "task", localId: "a", kind: "upsert", remoteId: null },
    0,
    id,
  );
  ops = settleOp(ops, ops[0].key, ops[0].seq, { type: "retry", error: "net" }, 100, () => 0.5);
  assert.equal(ops[0].attempts, 1);
  assert.equal(ops[0].nextAttemptAt, 2100);
  assert.equal(dueOps(ops, 2000).length, 0);
  ops = settleOp(ops, ops[0].key, ops[0].seq, { type: "ok" }, 3000);
  assert.equal(ops.length, 0);
});

test("parents flush before children", () => {
  let ops: OutboxOp[] = [];
  ops = enqueueOp(ops, { entity: "session", localId: "s", kind: "upsert", remoteId: null }, 0, id);
  ops = enqueueOp(ops, { entity: "task", localId: "t", kind: "upsert", remoteId: null }, 1, id);
  ops = enqueueOp(ops, { entity: "fence", localId: "f", kind: "upsert", remoteId: null }, 2, id);
  assert.deepEqual(
    dueOps(ops, 5).map((o) => o.entity),
    ["fence", "task", "session"],
  );
});

test("backoff is capped", () => {
  assert.equal(backoffMs(50, () => 0.5), 15 * 60_000);
});

test("error classification", () => {
  assert.equal(classifyError(new Error("Network request failed")), "retry");
  assert.equal(classifyError({ data: { code: "UNAUTHORIZED" } }), "pause");
  assert.equal(
    classifyError({ data: { code: "FORBIDDEN" }, message: GUARDIAN_PENDING }),
    "pause",
  );
  assert.equal(classifyError({ data: { code: "FORBIDDEN" }, message: "Selected fence" }), "drop");
  assert.equal(classifyError({ data: { code: "BAD_REQUEST" } }), "drop");
  assert.equal(classifyError({ data: { code: "NOT_FOUND" } }), "not-found");
  assert.equal(classifyError({ data: { code: "TOO_MANY_REQUESTS" } }), "retry");
});
