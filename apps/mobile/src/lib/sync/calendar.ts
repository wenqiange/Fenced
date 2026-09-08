import type { createFencedClient } from "@fenced/api-client";
import {
  getAppState,
  replaceCalendarEventsFromSync,
  setCalendarEventRemoteId,
  type LocalCalendarEvent,
} from "../local-store";

type Client = ReturnType<typeof createFencedClient>;

/** Days of history and future pulled into the local store. */
const PULL_PAST_DAYS = 30;
const PULL_FUTURE_DAYS = 120;

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function localIdForRemote(remoteId: string): string {
  return `remote-evt-${remoteId}`;
}

/**
 * Collapses the API's provider enum onto the local one.
 *
 * The local store only distinguishes "something Fenced owns" from "something a
 * provider owns", because that is the only difference the UI acts on.
 */
function toLocalSource(
  source: "local" | "google" | "outlook" | "apple"
): LocalCalendarEvent["source"] {
  return source === "local" ? "local" : "google";
}

export async function pullCalendarEventsFromApi(
  client: Client
): Promise<boolean> {
  try {
    const now = Date.now();
    const remote = await client.calendar.list.query({
      startAt: new Date(now - PULL_PAST_DAYS * 86_400_000).toISOString(),
      endAt: new Date(now + PULL_FUTURE_DAYS * 86_400_000).toISOString(),
    });

    const existingByRemoteId = new Map(
      getAppState()
        .calendarEvents.filter((e) => e.remoteId)
        .map((e) => [e.remoteId as string, e])
    );

    const merged: LocalCalendarEvent[] = [
      // Events that have never reached the server (created offline) would be
      // lost by a straight replace, so carry them over untouched.
      ...getAppState().calendarEvents.filter((e) => !e.remoteId),
      ...remote.map((row) => {
        const previous = existingByRemoteId.get(row.id);
        return {
          id: previous?.id ?? localIdForRemote(row.id),
          remoteId: row.id,
          title: row.title,
          notes: row.notes ?? "",
          startAt: toIso(row.startAt) ?? new Date().toISOString(),
          endAt: toIso(row.endAt) ?? new Date().toISOString(),
          allDay: row.allDay,
          linkedTaskId: previous?.linkedTaskId ?? null,
          // The API has no `time-block` source, so a locally-planned block
          // would come back as a plain event and lose its styling. Keep the
          // local classification when we already had one.
          source:
            previous?.source === "time-block"
              ? "time-block"
              : toLocalSource(row.source),
          createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
        } satisfies LocalCalendarEvent;
      }),
    ];

    replaceCalendarEventsFromSync(merged);
    return true;
  } catch {
    return false;
  }
}

/** Pushes one locally-created event; no-op once it has a remote id. */
export async function pushCalendarEventCreate(
  client: Client,
  event: LocalCalendarEvent
): Promise<void> {
  if (event.remoteId) return;
  // Provider-owned rows are mirrors, not ours to create.
  if (event.source === "google") return;

  try {
    const created = await client.calendar.create.mutate({
      title: event.title,
      notes: event.notes || undefined,
      startAt: new Date(event.startAt).toISOString(),
      endAt: new Date(event.endAt).toISOString(),
      allDay: event.allDay,
      source: "local",
    });
    setCalendarEventRemoteId(event.id, created.id);
  } catch {
    /* offline, or no profile yet — retried on the next bootstrap */
  }
}

export async function syncCalendarIfSignedIn(
  client: Client,
  signedIn: boolean
): Promise<void> {
  if (!signedIn) return;

  // Push first: a local-only event created offline should exist on the server
  // before the pull rewrites the list, or it would be pushed a cycle late.
  for (const event of getAppState().calendarEvents.filter((e) => !e.remoteId)) {
    await pushCalendarEventCreate(client, event);
  }
  await pullCalendarEventsFromApi(client);
}
