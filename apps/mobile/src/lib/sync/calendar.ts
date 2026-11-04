import { applySyncedState, getAppState, setRemoteId, type LocalCalendarEvent } from "../local-store";
import {
  deleteRemote,
  findLocal,
  localIdOf,
  remoteIdOf,
  toIso,
  type Client,
  type PushHandler,
} from "./common";
import { mergeRemote } from "./merge";
import { enqueue, hasPendingUpsert, pendingCreateMap, pendingDeleteRemoteIds } from "./outbox";

/** Days of history and future pulled into the local store. */
const PULL_PAST_DAYS = 30;
const PULL_FUTURE_DAYS = 120;

interface RemoteEvent {
  id: string;
  title: string;
  notes: string | null;
  startAt: Date | string;
  endAt: Date | string;
  allDay: boolean;
  linkedTaskId: string | null;
  source: "local" | "google" | "outlook" | "apple";
  createdAt: Date | string;
  updatedAt: Date | string;
}

export const pushCalendarEvent: PushHandler = async (client, op) => {
  if (op.kind === "delete") {
    // Deleting through the API is what records the provider tombstone.
    return deleteRemote(op, (id) => client.calendar.delete.mutate({ id }));
  }
  const event = findLocal("calendarEvents", op.localId);
  if (!event) return { type: "ok" };

  const body = {
    title: event.title,
    notes: event.notes || null,
    startAt: new Date(event.startAt).toISOString(),
    endAt: new Date(event.endAt).toISOString(),
    allDay: event.allDay,
    linkedTaskId: remoteIdOf("tasks", event.linkedTaskId),
  };

  if (!event.remoteId) {
    // Provider mirrors are created by the provider sync, never by us.
    if (event.source === "google") return { type: "ok" };
    const created = await client.calendar.create.mutate({
      ...body,
      id: op.clientId,
      notes: body.notes ?? undefined,
      linkedTaskId: body.linkedTaskId ?? undefined,
      source: "local",
    });
    setRemoteId("calendarEvents", event.id, created.id);
    return { type: "ok", remoteId: created.id };
  }
  await client.calendar.update.mutate({ id: event.remoteId, ...body });
  return { type: "ok", remoteId: event.remoteId };
};

export async function pullCalendarEvents(client: Client): Promise<void> {
  const now = Date.now();
  const from = now - PULL_PAST_DAYS * 86_400_000;
  const to = now + PULL_FUTURE_DAYS * 86_400_000;
  const remote = (await client.calendar.list.query({
    startAt: new Date(from).toISOString(),
    endAt: new Date(to).toISOString(),
  })) as RemoteEvent[];

  const { rows, pushBack } = mergeRemote<LocalCalendarEvent, RemoteEvent>({
    local: getAppState().calendarEvents,
    remote,
    hasPendingUpsert: (id) => hasPendingUpsert("calendarEvent", id),
    pendingDeletes: pendingDeleteRemoteIds("calendarEvent"),
    pendingCreates: pendingCreateMap("calendarEvent"),
    remoteUpdatedAt: (r) => r.updatedAt,
    // The list endpoint only returns events fully inside the window.
    inScope: (e) => new Date(e.startAt).getTime() >= from && new Date(e.endAt).getTime() <= to,
    map: (r, existing) => ({
      id: existing?.id ?? `evt-remote-${r.id}`,
      remoteId: r.id,
      title: r.title,
      notes: r.notes ?? "",
      startAt: toIso(r.startAt)!,
      endAt: toIso(r.endAt)!,
      allDay: r.allDay,
      linkedTaskId: localIdOf("tasks", r.linkedTaskId) ?? existing?.linkedTaskId ?? null,
      // The API has no `time-block` source; keep the local classification.
      source:
        existing?.source === "time-block" ? "time-block" : r.source === "local" ? "local" : "google",
      createdAt: toIso(r.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(r.updatedAt) ?? new Date().toISOString(),
    }),
  });

  applySyncedState({ calendarEvents: rows });
  for (const e of pushBack) enqueue("calendarEvent", e.id, "upsert", e.remoteId);
}
