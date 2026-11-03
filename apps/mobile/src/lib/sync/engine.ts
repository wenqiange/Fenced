import { captureException } from "../sentry";
import { pushCalendarEvent, pullCalendarEvents } from "./calendar";
import type { Client, PushHandler } from "./common";
import { pushFencedHour, pullFencedHours } from "./fenced-hours";
import { pushFence, pushProject, pullFences, pullProjects } from "./fences";
import { classifyError, errorMessage, type SyncEntity } from "./outbox-core";
import { getDueOps, hydrateOutbox, onOutboxKick, settle } from "./outbox";
import { pushSession, pullSessions } from "./sessions";
import { pushTask, pullTasks } from "./tasks";

const HANDLERS: Record<SyncEntity, PushHandler> = {
  fence: pushFence,
  project: pushProject,
  task: pushTask,
  calendarEvent: pushCalendarEvent,
  fencedHour: pushFencedHour,
  session: pushSession,
};

interface SyncConfig {
  client: Client;
  /** False while signed out or while a child awaits guardian consent. */
  canSync: () => boolean;
}

let config: SyncConfig | null = null;
let flushing: Promise<void> | null = null;
let again = false;
let kickTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function configureSync(next: SyncConfig | null) {
  config = next;
  if (next) scheduleFlush(0);
}

function scheduleFlush(delayMs: number) {
  if (kickTimer) clearTimeout(kickTimer);
  kickTimer = setTimeout(() => {
    kickTimer = null;
    void flushOutbox();
  }, delayMs);
}

// Local edits push shortly after they happen, batched across a burst.
onOutboxKick(() => scheduleFlush(400));

/**
 * Drains due ops in dependency order. Single-flight: a call during a flush
 * just asks the running flush to go round once more.
 */
export function flushOutbox(): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      await hydrateOutbox();
      do {
        again = false;
        if (!(await drainOnce())) break;
      } while (again);
    } finally {
      flushing = null;
      armRetryTimer();
    }
  })();
  return flushing;
}

/** Returns false when the queue must pause (auth/consent). */
async function drainOnce(): Promise<boolean> {
  const cfg = config;
  if (!cfg || !cfg.canSync()) return false;
  for (const op of getDueOps()) {
    if (!cfg.canSync()) return false;
    try {
      settle(op, await HANDLERS[op.entity](cfg.client, op));
    } catch (err) {
      const kind = classifyError(err);
      if (kind === "pause") return false;
      if (kind === "not-found") {
        // Update of a row deleted on another device: nothing left to update.
        settle(op, { type: "ok" });
      } else if (kind === "drop") {
        captureException(err, { where: "outbox", entity: op.entity, kind: op.kind });
        settle(op, { type: "drop", error: errorMessage(err) });
      } else {
        settle(op, { type: "retry", error: errorMessage(err) });
      }
    }
  }
  // Ops re-queued during this pass (stale seq) are due immediately.
  if (getDueOps().length > 0) again = true;
  return true;
}

function armRetryTimer() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const upcoming = getDueOps(Number.MAX_SAFE_INTEGER);
  if (upcoming.length === 0) return;
  const soonest = Math.min(...upcoming.map((o) => o.nextAttemptAt));
  retryTimer = setTimeout(() => void flushOutbox(), Math.max(1_000, soonest - Date.now()));
}

/**
 * Full sync: parents are pulled first so a fresh device adopts the server's
 * default fence instead of minting a duplicate, then local changes go up,
 * then everything else comes down.
 */
export async function fullSync(): Promise<void> {
  const cfg = config;
  if (!cfg || !cfg.canSync()) return;
  const step = async (name: string, fn: (c: Client) => Promise<void>) => {
    try {
      await fn(cfg.client);
    } catch (err) {
      // One failing collection must not block the others.
      if (classifyError(err) !== "retry") captureException(err, { where: `pull:${name}` });
    }
  };
  await step("fences", pullFences);
  await step("projects", pullProjects);
  await flushOutbox();
  await step("tasks", pullTasks);
  await step("calendar", pullCalendarEvents);
  await step("fencedHours", pullFencedHours);
  await step("sessions", pullSessions);
  // Pulls may have queued newer-local rows to push back.
  await flushOutbox();
}
