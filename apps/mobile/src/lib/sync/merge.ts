export interface SyncedRow {
  id: string;
  remoteId: string | null;
  updatedAt?: string;
}

export interface MergeOptions<L extends SyncedRow, R extends { id: string }> {
  local: readonly L[];
  remote: readonly R[];
  /** Local row has edits not yet acknowledged by the server. */
  hasPendingUpsert: (localId: string) => boolean;
  /** Remote ids deleted locally, delete not yet confirmed. */
  pendingDeletes: ReadonlySet<string>;
  map: (row: R, existing: L | undefined) => L;
  remoteUpdatedAt?: (row: R) => string | Date | null | undefined;
  /**
   * Maps in-flight creation remote/client IDs to local entity IDs.
   * Prevents creating duplicate entities when a pull overtakes an in-flight create.
   */
  pendingCreates?: ReadonlyMap<string, string>;
  /**
   * Whether a local synced row falls inside what this pull covered. Rows
   * outside (e.g. events beyond the pulled date range) are left untouched
   * instead of being treated as deleted on the server.
   */
  inScope?: (row: L) => boolean;
}

export interface MergeResult<L> {
  rows: L[];
  /** Local rows newer than the server copy; the caller re-enqueues them. */
  pushBack: L[];
}

const time = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : 0);

/**
 * Three-way-ish merge of a pulled collection into local state.
 *
 * - Local-only rows (never synced) are kept.
 * - In-flight creates are adopted via pendingCreates without minting duplicates.
 * - Rows with pending local edits win; so do rows whose `updatedAt` is newer
 *   than the server's (returned in `pushBack` to be re-sent).
 * - Rows deleted locally stay deleted until the server confirms.
 * - Synced rows missing from an in-scope pull were deleted elsewhere.
 */
export function mergeRemote<L extends SyncedRow, R extends { id: string }>(
  o: MergeOptions<L, R>,
): MergeResult<L> {
  const byRemote = new Map<string, L>();
  const byLocalId = new Map<string, L>();
  for (const l of o.local) {
    byLocalId.set(l.id, l);
    if (l.remoteId) byRemote.set(l.remoteId, l);
  }

  const seen = new Set<string>();
  const adoptedLocalIds = new Set<string>();
  const rows: L[] = [];
  const pushBack: L[] = [];

  for (const r of o.remote) {
    if (o.pendingDeletes.has(r.id)) continue;
    seen.add(r.id);
    let existing = byRemote.get(r.id);
    if (!existing && o.pendingCreates?.has(r.id)) {
      const localId = o.pendingCreates.get(r.id)!;
      existing = byLocalId.get(localId);
      if (existing) {
        adoptedLocalIds.add(existing.id);
      }
    }
    if (existing && o.hasPendingUpsert(existing.id)) {
      rows.push(existing);
      continue;
    }
    if (existing && o.remoteUpdatedAt && time(existing.updatedAt) > time(o.remoteUpdatedAt(r))) {
      rows.push(existing);
      pushBack.push(existing);
      continue;
    }
    rows.push(o.map(r, existing));
  }

  for (const l of o.local) {
    if (adoptedLocalIds.has(l.id)) continue;
    if (!l.remoteId) {
      rows.push(l);
      continue;
    }
    if (seen.has(l.remoteId) || o.pendingDeletes.has(l.remoteId)) continue;
    const covered = o.inScope ? o.inScope(l) : true;
    if (!covered || o.hasPendingUpsert(l.id)) rows.push(l);
  }

  return { rows, pushBack };
}

/** Drains an offset-paged endpoint so nothing is silently truncated. */
export async function fetchAllPages<T>(
  page: (offset: number, limit: number) => Promise<T[]>,
  limit = 100,
  maxPages = 50,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const rows = await page(i * limit, limit);
    out.push(...rows);
    if (rows.length < limit) break;
  }
  return out;
}
