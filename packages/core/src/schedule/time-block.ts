import type { Priority } from "../schemas/task";

export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

export interface SchedulableTask {
  id: string;
  title: string;
  estimateMinutes: number;
  dueAt: Date | null;
  priority: Priority;
  /** Task ids that must be completed before this one can be scheduled. */
  blockedBy?: string[];
  /** Minutes already on the calendar for this task (subtracted from the estimate). */
  scheduledMinutes?: number;
}

export interface ProposedBlock {
  id: string;
  taskId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  minutes: number;
  /** True when this block is only part of the task estimate. */
  split: boolean;
  partIndex: number;
  partCount: number;
}

export interface UnplacedTask {
  taskId: string;
  title: string;
  unmetMinutes: number;
  reason: "no-fit" | "too-small-gaps" | "no-window" | "blocked";
}

export interface ProposeTimeBlocksInput {
  /** Calendar day to fill (local midnight of that day is used). */
  day: Date;
  /** Tasks with a positive estimate. */
  tasks: SchedulableTask[];
  /** Existing events that cannot be overlapped. */
  busy: BusyInterval[];
  /**
   * Preferred work windows (e.g. Fenced Hours). When non-empty, blocks are
   * only placed inside these. When empty, [dayStartHour, dayEndHour] is used.
   */
  windows?: BusyInterval[];
  dayStartHour?: number;
  dayEndHour?: number;
  /** Do not schedule before this instant (usually "now" on the selected day). */
  earliest?: Date;
  bufferMinutes?: number;
  /** Skip leftover fragments shorter than this. */
  minBlockMinutes?: number;
}

export interface ProposeTimeBlocksResult {
  blocks: ProposedBlock[];
  unplaced: UnplacedTask[];
  freeMinutes: number;
  usedMinutes: number;
}

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

interface Gap {
  startMs: number;
  endMs: number;
}

/**
 * Deterministic time-block proposer. Packs task estimates into free gaps,
 * preferring Fenced Hours when present, splitting across gaps when needed,
 * and reporting anything that does not fit. No model involved.
 */
export function proposeTimeBlocks(input: ProposeTimeBlocksInput): ProposeTimeBlocksResult {
  const dayStartHour = input.dayStartHour ?? 9;
  const dayEndHour = input.dayEndHour ?? 18;
  const bufferMinutes = input.bufferMinutes ?? 5;
  const minBlockMinutes = input.minBlockMinutes ?? 15;
  const bufferMs = bufferMinutes * 60_000;
  const minBlockMs = minBlockMinutes * 60_000;

  const day = startOfLocalDay(input.day);
  const defaultWindowStart = atHour(day, dayStartHour);
  const defaultWindowEnd = atHour(day, dayEndHour);

  const windows =
    input.windows && input.windows.length > 0
      ? clampIntervals(input.windows, day)
      : [{ startAt: defaultWindowStart, endAt: defaultWindowEnd }];

  if (windows.length === 0) {
    return {
      blocks: [],
      unplaced: input.tasks.map((t) => ({
        taskId: t.id,
        title: t.title,
        unmetMinutes: t.estimateMinutes,
        reason: "no-window",
      })),
      freeMinutes: 0,
      usedMinutes: 0,
    };
  }

  const earliestMs = (input.earliest ?? day).getTime();
  const busy = clampIntervals(input.busy, day);
  let gaps = buildGaps(windows, busy, earliestMs);

  const freeMinutes = Math.floor(
    gaps.reduce((sum, g) => sum + Math.max(0, g.endMs - g.startMs), 0) / 60_000,
  );

  const ordered = [...input.tasks].sort(compareTasks);
  const blocks: ProposedBlock[] = [];
  const unplaced: UnplacedTask[] = [];
  let usedMinutes = 0;
  let blockSeq = 0;

  for (const task of ordered) {
    let remainingMs = task.estimateMinutes * 60_000;
    const placedForTask: ProposedBlock[] = [];

    while (remainingMs >= minBlockMs) {
      const gapIndex = findBestGap(gaps, remainingMs, minBlockMs);
      if (gapIndex < 0) break;

      const gap = gaps[gapIndex]!;
      const available = gap.endMs - gap.startMs;
      const take = Math.min(remainingMs, available);
      if (take < minBlockMs) break;

      const startAt = new Date(gap.startMs);
      const endAt = new Date(gap.startMs + take);
      placedForTask.push({
        id: `pb-${blockSeq++}`,
        taskId: task.id,
        title: task.title,
        startAt,
        endAt,
        minutes: Math.round(take / 60_000),
        split: false,
        partIndex: 1,
        partCount: 1,
      });

      usedMinutes += Math.round(take / 60_000);
      remainingMs -= take;

      const nextStart = endAt.getTime() + bufferMs;
      if (nextStart < gap.endMs) {
        gaps[gapIndex] = { startMs: nextStart, endMs: gap.endMs };
      } else {
        gaps.splice(gapIndex, 1);
      }
      gaps = gaps.filter((g) => g.endMs - g.startMs >= minBlockMs);
    }

    if (placedForTask.length === 0) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        unmetMinutes: task.estimateMinutes,
        reason: freeMinutes === 0 ? "no-window" : "no-fit",
      });
      continue;
    }

    const partCount = placedForTask.length;
    for (let i = 0; i < placedForTask.length; i++) {
      const block = placedForTask[i]!;
      block.split = partCount > 1;
      block.partIndex = i + 1;
      block.partCount = partCount;
      blocks.push(block);
    }

    const unmetMinutes = Math.max(0, Math.round(remainingMs / 60_000));
    if (unmetMinutes > 0) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        unmetMinutes,
        reason: unmetMinutes === task.estimateMinutes ? "no-fit" : "too-small-gaps",
      });
    }
  }

  blocks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return { blocks, unplaced, freeMinutes, usedMinutes };
}

function compareTasks(a: SchedulableTask, b: SchedulableTask): number {
  const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  const prio = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (prio !== 0) return prio;
  // Larger estimates first so big tasks claim contiguous gaps before scraps fill them.
  return b.estimateMinutes - a.estimateMinutes;
}

function buildGaps(
  windows: BusyInterval[],
  busy: BusyInterval[],
  earliestMs: number,
): Gap[] {
  const gaps: Gap[] = [];

  for (const window of windows) {
    let cursor = Math.max(window.startAt.getTime(), earliestMs);
    const end = window.endAt.getTime();
    if (cursor >= end) continue;

    const blocking = busy
      .filter((b) => b.endAt.getTime() > cursor && b.startAt.getTime() < end)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    for (const block of blocking) {
      const blockStart = Math.max(block.startAt.getTime(), cursor);
      const blockEnd = Math.min(block.endAt.getTime(), end);
      if (blockStart > cursor) {
        gaps.push({ startMs: cursor, endMs: blockStart });
      }
      cursor = Math.max(cursor, blockEnd);
      if (cursor >= end) break;
    }

    if (cursor < end) {
      gaps.push({ startMs: cursor, endMs: end });
    }
  }

  return gaps.sort((a, b) => a.startMs - b.startMs);
}

/**
 * Prefer a gap that fits the whole remaining estimate; otherwise the largest gap.
 */
function findBestGap(gaps: Gap[], remainingMs: number, minBlockMs: number): number {
  let bestFit = -1;
  let bestFitSize = Number.POSITIVE_INFINITY;
  let largest = -1;
  let largestSize = 0;

  for (let i = 0; i < gaps.length; i++) {
    const size = gaps[i]!.endMs - gaps[i]!.startMs;
    if (size < minBlockMs) continue;
    if (size >= remainingMs && size < bestFitSize) {
      bestFit = i;
      bestFitSize = size;
    }
    if (size > largestSize) {
      largest = i;
      largestSize = size;
    }
  }

  return bestFit >= 0 ? bestFit : largest;
}

function clampIntervals(intervals: BusyInterval[], day: Date): BusyInterval[] {
  const dayStart = day.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return intervals
    .map((interval) => ({
      startAt: new Date(Math.max(interval.startAt.getTime(), dayStart)),
      endAt: new Date(Math.min(interval.endAt.getTime(), dayEnd)),
    }))
    .filter((interval) => interval.endAt.getTime() > interval.startAt.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function atHour(day: Date, hour: number): Date {
  const h = Math.floor(hour);
  const minutes = Math.round((hour - h) * 60);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, minutes, 0, 0);
}
