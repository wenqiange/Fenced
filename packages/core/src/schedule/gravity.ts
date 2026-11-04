export interface FreeGap {
  startAt: Date;
  endAt: Date;
}

export interface GravityPlacement {
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  gravitationalPull: number;
}

export interface PlanGravityOptions {
  taskDueAt: Date;
  estimateMinutes: number;
  now?: Date;
  freeGaps: FreeGap[];
  maxBlockMinutes?: number;
  minBlockMinutes?: number;
}

/**
 * Feature 2 (Deadline Gravity):
 * Back-schedules focus blocks leading up to major deadlines. Instead of cramming
 * on the due date, this applies an inverse-time gravitational curve pulling
 * focus blocks earlier into available gaps, reserving preparation milestones.
 */
export function planDeadlineGravity(options: PlanGravityOptions): GravityPlacement[] {
  const {
    taskDueAt,
    estimateMinutes,
    now = new Date(),
    freeGaps,
    maxBlockMinutes = 60,
    minBlockMinutes = 25,
  } = options;

  const dueTime = taskDueAt.getTime();
  const nowTime = now.getTime();
  const totalHorizonMs = dueTime - nowTime;

  if (totalHorizonMs <= 0 || estimateMinutes <= 0) {
    return [];
  }

  // Filter to gaps strictly before due date and after now
  const validGaps = freeGaps
    .filter((g) => g.endAt.getTime() > nowTime && g.startAt.getTime() < dueTime)
    .map((g) => ({
      startAt: new Date(Math.max(g.startAt.getTime(), nowTime)),
      endAt: new Date(Math.min(g.endAt.getTime(), dueTime)),
    }))
    .filter((g) => (g.endAt.getTime() - g.startAt.getTime()) >= minBlockMinutes * 60_000);

  if (validGaps.length === 0) return [];

  // Sort gaps chronologically
  validGaps.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  let remainingMinutes = estimateMinutes;
  const placements: GravityPlacement[] = [];

  // Plan backward from the deadline or distribute across the gravity curve
  // Placements closer to the deadline have higher gravitational pull
  for (let i = validGaps.length - 1; i >= 0 && remainingMinutes > 0; i--) {
    const gap = validGaps[i];
    const gapDurationMinutes = Math.floor((gap.endAt.getTime() - gap.startAt.getTime()) / 60_000);
    const allocMinutes = Math.min(remainingMinutes, Math.min(gapDurationMinutes, maxBlockMinutes));

    if (allocMinutes >= minBlockMinutes || remainingMinutes <= minBlockMinutes) {
      // Place block towards the end of the gap to keep it anchored closer to its timeline
      const blockEnd = gap.endAt;
      const blockStart = new Date(blockEnd.getTime() - allocMinutes * 60_000);

      // Gravitational pull: 0 (at now) to 1.0 (at deadline)
      const distanceToDeadline = Math.max(0, dueTime - blockStart.getTime());
      const pull = Math.max(0.1, Math.min(1.0, 1.0 - (distanceToDeadline / totalHorizonMs)));

      placements.push({
        startAt: blockStart,
        endAt: blockEnd,
        durationMinutes: allocMinutes,
        gravitationalPull: Math.round(pull * 100) / 100,
      });

      remainingMinutes -= allocMinutes;
    }
  }

  // Return in chronological order
  return placements.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
