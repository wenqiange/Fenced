import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllPages, mergeRemote } from "../merge";

interface L {
  id: string;
  remoteId: string | null;
  updatedAt: string;
  title: string;
  day?: number;
}
interface R {
  id: string;
  title: string;
  updatedAt: string;
}

const map = (r: R, e: L | undefined): L => ({
  id: e?.id ?? `remote-${r.id}`,
  remoteId: r.id,
  updatedAt: r.updatedAt,
  title: r.title,
});

const base = {
  hasPendingUpsert: () => false,
  pendingDeletes: new Set<string>(),
  map,
  remoteUpdatedAt: (r: R) => r.updatedAt,
};

test("remote changes apply and keep the local id", () => {
  const { rows } = mergeRemote<L, R>({
    ...base,
    local: [{ id: "a", remoteId: "1", updatedAt: "2026-01-01T00:00:00Z", title: "old" }],
    remote: [{ id: "1", title: "new", updatedAt: "2026-01-02T00:00:00Z" }],
  });
  assert.deepEqual(rows.map((r) => [r.id, r.title]), [["a", "new"]]);
});

test("pending local edits win over the pull", () => {
  const { rows } = mergeRemote<L, R>({
    ...base,
    hasPendingUpsert: (id) => id === "a",
    local: [{ id: "a", remoteId: "1", updatedAt: "2026-01-01T00:00:00Z", title: "mine" }],
    remote: [{ id: "1", title: "theirs", updatedAt: "2026-01-05T00:00:00Z" }],
  });
  assert.equal(rows[0].title, "mine");
});

test("newer local copy wins and is pushed back", () => {
  const local = { id: "a", remoteId: "1", updatedAt: "2026-01-09T00:00:00Z", title: "mine" };
  const r = mergeRemote<L, R>({
    ...base,
    local: [local],
    remote: [{ id: "1", title: "theirs", updatedAt: "2026-01-05T00:00:00Z" }],
  });
  assert.equal(r.rows[0].title, "mine");
  assert.deepEqual(r.pushBack, [local]);
});

test("locally deleted rows do not resurrect", () => {
  const { rows } = mergeRemote<L, R>({
    ...base,
    pendingDeletes: new Set(["1"]),
    local: [],
    remote: [{ id: "1", title: "zombie", updatedAt: "2026-01-05T00:00:00Z" }],
  });
  assert.equal(rows.length, 0);
});

test("unsynced rows are kept; rows deleted elsewhere are dropped unless out of scope", () => {
  const { rows } = mergeRemote<L, R>({
    ...base,
    inScope: (l) => (l.day ?? 0) < 10,
    local: [
      { id: "new", remoteId: null, updatedAt: "", title: "offline" },
      { id: "gone", remoteId: "2", updatedAt: "", title: "deleted on web", day: 1 },
      { id: "far", remoteId: "3", updatedAt: "", title: "outside range", day: 40 },
    ],
    remote: [],
  });
  assert.deepEqual(rows.map((r) => r.id).sort(), ["far", "new"]);
});

test("fetchAllPages drains past 100 rows", async () => {
  const data = Array.from({ length: 230 }, (_, i) => i);
  const all = await fetchAllPages(async (offset, limit) => data.slice(offset, offset + limit));
  assert.equal(all.length, 230);
});
