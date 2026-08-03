import {
  autoSchedule,
  type AutoScheduleResult,
  type BusyInterval,
  type PlacementReason,
  type ProposedBlock,
  type ProposeTimeBlocksResult,
  type SchedulableTask,
  type ScheduledBlock,
} from "@fenced/core";
import type { ScheduleKnobOverrides, SoftPreference } from "@fenced/ai/client";
import { softPreferencesToKnobs } from "@fenced/ai/client";
import {
  getAppState,
  getFencedHoursForToday,
  parseHour,
  type LocalTask,
} from "./local-store";

const DEFAULT_ESTIMATE_MINUTES = 30;

export type ScheduleHorizon = "today" | "week";

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fencedHoursAsWindows(day: Date): BusyInterval[] {
  return getFencedHoursForToday(day).map((h) => {
    const startMin = parseHour(h.startTime);
    const endMin = parseHour(h.endTime);
    return {
      startAt: atMinutes(day, startMin),
      endAt: atMinutes(day, endMin),
    };
  });
}

export function busyEventsForDay(day: Date): BusyInterval[] {
  const key = localDateKey(day);
  return getAppState()
    .calendarEvents.filter((e) => localDateKey(new Date(e.startAt)) === key)
    .map((e) => ({
      startAt: new Date(e.startAt),
      endAt: new Date(e.endAt),
    }));
}

function scheduledMinutesForTask(taskId: string): number {
  return getAppState().calendarEvents
    .filter((e) => e.linkedTaskId === taskId)
    .reduce((sum, e) => {
      const ms = new Date(e.endAt).getTime() - new Date(e.startAt).getTime();
      return sum + Math.max(0, Math.round(ms / 60_000));
    }, 0);
}

export function tasksEligibleForTimeBlock(tasks: LocalTask[]): SchedulableTask[] {
  return tasks
    .filter((t) => !t.completed)
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimateMinutes: t.estimateMinutes && t.estimateMinutes > 0
        ? t.estimateMinutes
        : DEFAULT_ESTIMATE_MINUTES,
      dueAt: t.dueAt ? new Date(t.dueAt) : null,
      priority: t.priority,
      blockedBy: t.blockedByTaskIds ?? [],
      scheduledMinutes: scheduledMinutesForTask(t.id),
    }));
}

export function horizonDays(horizon: ScheduleHorizon, now = new Date()): Date[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const count = horizon === "today" ? 1 : 7;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function proposeBlocksForDay(
  day: Date,
  options?: { taskIds?: string[]; now?: Date },
): ProposeTimeBlocksResult {
  const result = proposeSchedule("today", {
    ...options,
    anchor: day,
  });
  return {
    blocks: result.blocks,
    unplaced: result.unplaced,
    freeMinutes: result.days[0]?.freeMinutes ?? 0,
    usedMinutes: result.days[0]?.usedMinutes ?? 0,
  };
}

export function proposeSchedule(
  horizon: ScheduleHorizon,
  options?: {
    taskIds?: string[];
    now?: Date;
    anchor?: Date;
    knobs?: ScheduleKnobOverrides;
  },
): AutoScheduleResult {
  const now = options?.now ?? new Date();
  const anchor = options?.anchor ?? now;
  const knobs = options?.knobs ?? {};

  const days = horizonDays(horizon, anchor).map((day) => {
    const sameDay =
      day.getFullYear() === now.getFullYear() &&
      day.getMonth() === now.getMonth() &&
      day.getDate() === now.getDate();

    let windows = fencedHoursAsWindows(day);
    if (knobs.protectFencedHours && windows.length === 0) {
      // No fenced hours — fall through to day window; packer still runs.
      windows = [];
    }

    return {
      day,
      windows: windows.length > 0 ? windows : undefined,
      busy: busyEventsForDay(day),
      earliest: sameDay ? now : undefined,
    };
  });

  let tasks = tasksEligibleForTimeBlock(getAppState().tasks);
  if (options?.taskIds) {
    tasks = tasks.filter((t) => options.taskIds!.includes(t.id));
  }
  if (knobs.deferLowPriority) {
    tasks = tasks.filter((t) => t.priority !== "low" && t.priority !== "none");
  }
  if (knobs.batchTag) {
    const tag = knobs.batchTag;
    const local = getAppState().tasks;
    tasks = tasks.filter((t) => {
      const row = local.find((x) => x.id === t.id);
      return row?.tags.some((x) => x.toLowerCase() === tag);
    });
  }

  const completedTaskIds = getAppState()
    .tasks.filter((t) => t.completed)
    .map((t) => t.id);

  return autoSchedule({
    days,
    tasks,
    completedTaskIds,
    bufferMinutes: 5,
    minBlockMinutes: 15,
    dayStartHour: knobs.dayStartHour ?? 9,
    dayEndHour: knobs.dayEndHour ?? 18,
  });
}

/** Apply AI soft preferences by re-running the deterministic packer. */
export function proposeScheduleWithAdvice(
  horizon: ScheduleHorizon,
  softPreferences: SoftPreference[],
): AutoScheduleResult {
  return proposeSchedule(horizon, {
    knobs: softPreferencesToKnobs(softPreferences),
  });
}

export function summarizeForReplanAdvice(
  result: AutoScheduleResult,
  horizon: ScheduleHorizon,
): {
  horizon: ScheduleHorizon;
  freeMinutes: number;
  usedMinutes: number;
  reasonCounts: Record<string, number>;
  unplaced: Array<{ title: string; unmetMinutes: number; reason: string }>;
  tags: string[];
} {
  const reasonCounts: Record<string, number> = {};
  for (const block of result.blocks) {
    reasonCounts[block.reason] = (reasonCounts[block.reason] ?? 0) + 1;
  }
  const tags = new Set<string>();
  for (const t of getAppState().tasks) {
    for (const tag of t.tags) tags.add(tag);
  }
  return {
    horizon,
    freeMinutes: result.days.reduce((s, d) => s + d.freeMinutes, 0),
    usedMinutes: result.days.reduce((s, d) => s + d.usedMinutes, 0),
    reasonCounts,
    unplaced: result.unplaced.map((u) => ({
      title: u.title,
      unmetMinutes: u.unmetMinutes,
      reason: u.reason,
    })),
    tags: [...tags].slice(0, 20),
  };
}

export function formatBlockRange(block: Pick<ProposedBlock, "startAt" | "endAt">): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${block.startAt.toLocaleTimeString(undefined, opts)} – ${block.endAt.toLocaleTimeString(undefined, opts)}`;
}

export function describePlacementReason(reason: PlacementReason): string | null {
  switch (reason) {
    case "spillover":
      return "Moved later — earlier days were full";
    case "after-due":
      return "After the due date — earlier gaps were full";
    case "blocked":
      return "Waiting on another task";
    default:
      return null;
  }
}

export function groupBlocksByDay(blocks: ScheduledBlock[]): Array<{
  dayKey: string;
  label: string;
  blocks: ScheduledBlock[];
}> {
  const map = new Map<string, ScheduledBlock[]>();
  for (const block of blocks) {
    const list = map.get(block.dayKey) ?? [];
    list.push(block);
    map.set(block.dayKey, list);
  }
  return [...map.entries()].map(([dayKey, dayBlocks]) => {
    const [y, m, d] = dayKey.split("-").map(Number);
    const date = new Date(y!, m! - 1, d!);
    return {
      dayKey,
      label: date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      blocks: dayBlocks,
    };
  });
}

function atMinutes(day: Date, minutes: number): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}
