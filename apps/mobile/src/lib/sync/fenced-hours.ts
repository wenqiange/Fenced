import { applySyncedState, getAppState, setRemoteId, type FencedHourSchedule } from "../local-store";
import {
  deleteRemote,
  findLocal,
  localIdOf,
  remoteFenceId,
  toIso,
  type Client,
  type PushHandler,
} from "./common";
import { mergeRemote } from "./merge";
import { enqueue, hasPendingUpsert, pendingDeleteRemoteIds } from "./outbox";

interface RemoteFencedHour {
  id: string;
  fenceId: string;
  label: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  strictDelayMinutes: number;
  enabled: boolean;
  skippedDates: string[];
  updatedAt: Date | string;
}

export const pushFencedHour: PushHandler = async (client, op) => {
  if (op.kind === "delete") return deleteRemote(op, (id) => client.fencedHours.delete.mutate({ id }));
  const hour = findLocal("fencedHours", op.localId);
  if (!hour) return { type: "ok" };

  const body = {
    label: hour.label,
    daysOfWeek: hour.daysOfWeek,
    startTime: hour.startTime,
    endTime: hour.endTime,
    strictDelayMinutes: hour.strictDelayMinutes,
    enabled: hour.enabled,
  };
  if (!hour.remoteId) {
    const created = await client.fencedHours.create.mutate({
      ...body,
      id: op.clientId,
      fenceId: remoteFenceId(hour.fenceId),
    });
    setRemoteId("fencedHours", hour.id, created.id);
    // Skips made before the first sync ride along on the next update.
    if (hour.skippedDates.length > 0) enqueue("fencedHour", hour.id, "upsert", created.id);
    return { type: "ok", remoteId: created.id };
  }
  // Full replacement of skippedDates is idempotent and covers "skip today"
  // as well as un-skipping; the API's skipToday is for single-shot clients.
  await client.fencedHours.update.mutate({
    id: hour.remoteId,
    ...body,
    skippedDates: hour.skippedDates,
  });
  return { type: "ok", remoteId: hour.remoteId };
};

export async function pullFencedHours(client: Client): Promise<void> {
  const remote = (await client.fencedHours.list.query()) as RemoteFencedHour[];
  const { rows, pushBack } = mergeRemote<FencedHourSchedule, RemoteFencedHour>({
    local: getAppState().fencedHours,
    remote,
    hasPendingUpsert: (id) => hasPendingUpsert("fencedHour", id),
    pendingDeletes: pendingDeleteRemoteIds("fencedHour"),
    remoteUpdatedAt: (r) => r.updatedAt,
    map: (r, existing) => ({
      id: existing?.id ?? `fh-remote-${r.id}`,
      remoteId: r.id,
      label: r.label,
      fenceId: localIdOf("fences", r.fenceId),
      daysOfWeek: r.daysOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      strictDelayMinutes: r.strictDelayMinutes,
      enabled: r.enabled,
      skippedDates: r.skippedDates ?? [],
      updatedAt: toIso(r.updatedAt)!,
    }),
  });
  applySyncedState({ fencedHours: rows });
  for (const h of pushBack) enqueue("fencedHour", h.id, "upsert", h.remoteId);
}
