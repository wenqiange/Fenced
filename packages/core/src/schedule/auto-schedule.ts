import {
  proposeTimeBlocks,
  type BusyInterval,
  type ProposedBlock,
  type SchedulableTask,
  type UnplacedTask,
} from "./time-block";

export type PlacementReason =
  | "on-time"
  /** Landed on a later day because earlier ones were full. */
  | "spillover"
  /** Could only place on or after the due date's calendar day. */
  | "after-due"
  /** Waiting on another incomplete task. */
  | "blocked";

export interface ScheduledBlock extends ProposedBlock {
  dayKey: string;
  reason: PlacementReason;
}

export interface AutoScheduleDayWindows {
  day: Date;
  windows?: BusyInterval[];
  busy?: BusyInterval[];
  earliest?: Date;
}

export interface AutoScheduleInput {
  /** Ordered days to fill, earliest first. */
  days: AutoScheduleDayWindows[];
  tasks: SchedulableTask[];
  /** Ids of tasks that are already complete (for dependency checks). */
  completedTaskIds?: Iterable<string>;
  dayStartHour?: number;
  dayEndHour?: number;
  bufferMinutes?: number;
  minBlockMinutes?: number;
  /**
   * Wellbeing cap: maximum scheduled minutes per day, applied identically to
   * every day in the horizon. Undefined = no cap. See `DAILY_FOCUS_CAP_MINUTES`
   * for suggested age-band defaults (child/teen/adult).
   */
  maxDailyMinutes?: number;
}

/**
 * Suggested wellbeing ceilings for `AutoScheduleInput.maxDailyMinutes`, so a
 * minor's day cannot be packed with an unrealistic number of back-to-back
 * focus blocks. Callers remain free to pass their own value or omit the cap
 * entirely; these are defaults, not an enforced policy inside this module.
 */
export const DAILY_FOCUS_CAP_MINUTES: Record<"child" | "teen" | "adult", number> = {
  child: 120,
  teen: 180,
  adult: 300,
};

export interface AutoScheduleResult {
  blocks: ScheduledBlock[];
  unplaced: UnplacedTask[];
  /** Per-day free/used for the UI summary. */
  days: Array<{ dayKey: string; freeMinutes: number; usedMinutes: number }>;
}

/**
 * Multi-day deterministic scheduler. Walks the horizon day by day, packing
 * remaining estimates with `proposeTimeBlocks`, honouring `blockedBy` edges
 * and never inventing time. Structured `reason` codes replace any LLM copy.
 */
export function autoSchedule(input: AutoScheduleInput): AutoScheduleResult {
  const completed = new Set(input.completedTaskIds ?? []);
  const remaining = new Map<string, number>();
  const titles = new Map<string, string>();
  const meta = new Map<string, SchedulableTask>();
  const blocked: UnplacedTask[] = [];

  for (const task of input.tasks) {
    titles.set(task.id, task.title);
    meta.set(task.id, task);
    const blockers = task.blockedBy ?? [];
    const waiting = blockers.filter((id) => !completed.has(id));
    if (waiting.length > 0) {
      blocked.push({
        taskId: task.id,
        title: task.title,
        unmetMinutes: Math.max(0, task.estimateMinutes - (task.scheduledMinutes ?? 0)),
        reason: "blocked",
      });
      continue;
    }
    const left = Math.max(0, task.estimateMinutes - (task.scheduledMinutes ?? 0));
    if (left > 0) remaining.set(task.id, left);
  }

  const allBlocks: ScheduledBlock[] = [];
  const daySummaries: AutoScheduleResult["days"] = [];
  const placedDays = new Map<string, string[]>(); // taskId -> dayKeys
  const cappedTaskIds = new Set<string>();
  const horizonFirstKey = input.days[0] ? localDayKey(input.days[0].day) : "";

  for (const daySpec of input.days) {
    const dayKey = localDayKey(daySpec.day);
    const tasksForDay: SchedulableTask[] = [];

    for (const [taskId, minutes] of remaining) {
      if (minutes <= 0) continue;
      const task = meta.get(taskId)!;
      tasksForDay.push({
        ...task,
        estimateMinutes: minutes,
        scheduledMinutes: 0,
      });
    }

    if (tasksForDay.length === 0) {
      daySummaries.push({ dayKey, freeMinutes: 0, usedMinutes: 0 });
      continue;
    }

    const result = proposeTimeBlocks({
      day: daySpec.day,
      tasks: tasksForDay,
      busy: daySpec.busy ?? [],
      windows: daySpec.windows,
      earliest: daySpec.earliest,
      dayStartHour: input.dayStartHour,
      dayEndHour: input.dayEndHour,
      bufferMinutes: input.bufferMinutes,
      minBlockMinutes: input.minBlockMinutes,
      maxDailyMinutes: input.maxDailyMinutes,
    });

    for (const block of result.blocks) {
      const prev = remaining.get(block.taskId) ?? 0;
      remaining.set(block.taskId, Math.max(0, prev - block.minutes));

      const days = placedDays.get(block.taskId) ?? [];
      days.push(dayKey);
      placedDays.set(block.taskId, days);

      allBlocks.push({
        ...block,
        id: `${dayKey}-${block.id}`,
        dayKey,
        reason: placementReason(meta.get(block.taskId)!, dayKey, days, horizonFirstKey),
      });
    }

    // Remember which tasks were capped on this day so the final leftover
    // report (below) can say "daily-cap" instead of a generic "no fit".
    for (const u of result.unplaced) {
      if (u.reason === "daily-cap") cappedTaskIds.add(u.taskId);
    }

    daySummaries.push({
      dayKey,
      freeMinutes: result.freeMinutes,
      usedMinutes: result.usedMinutes,
    });
  }

  const unplaced: UnplacedTask[] = [...blocked];
  for (const [taskId, minutes] of remaining) {
    if (minutes <= 0) continue;
    const task = meta.get(taskId)!;
    const hadAny = (placedDays.get(taskId) ?? []).length > 0;
    unplaced.push({
      taskId,
      title: task.title,
      unmetMinutes: minutes,
      reason: cappedTaskIds.has(taskId) ? "daily-cap" : hadAny ? "too-small-gaps" : "no-fit",
    });
  }

  allBlocks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return { blocks: allBlocks, unplaced, days: daySummaries };
}

function placementReason(
  task: SchedulableTask,
  dayKey: string,
  daysSoFar: string[],
  horizonFirstKey: string,
): PlacementReason {
  if (task.dueAt && dayKey > localDayKey(task.dueAt)) return "after-due";
  if (daysSoFar.length > 1) return "spillover";
  if (dayKey > horizonFirstKey) {
    const dueKey = task.dueAt ? localDayKey(task.dueAt) : null;
    if (dueKey !== dayKey) return "spillover";
  }
  return "on-time";
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
