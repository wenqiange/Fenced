import type { SoftPreference } from "./schemas/replan";

export interface ScheduleKnobOverrides {
  /** When set, only these day-hour windows are used (local hours). */
  dayStartHour?: number;
  dayEndHour?: number;
  /** Drop low/none priority tasks from the pack. */
  deferLowPriority?: boolean;
  /** Prefer scheduling only inside Fenced Hours when present. */
  protectFencedHours?: boolean;
  /** If set, only tasks with this tag are scheduled. */
  batchTag?: string | null;
}

/**
 * Maps closed SoftPreference enums onto knobs the deterministic scheduler
 * already understands. Never invents absolute timeslots.
 */
export function softPreferencesToKnobs(
  prefs: SoftPreference[],
): ScheduleKnobOverrides {
  const knobs: ScheduleKnobOverrides = {};
  for (const pref of prefs) {
    switch (pref.kind) {
      case "prefer-mornings":
        knobs.dayStartHour = 8;
        knobs.dayEndHour = 12;
        break;
      case "prefer-afternoons":
        knobs.dayStartHour = 13;
        knobs.dayEndHour = 18;
        break;
      case "protect-fenced-hours":
        knobs.protectFencedHours = true;
        break;
      case "defer-low-priority":
        knobs.deferLowPriority = true;
        break;
      case "batch-tag":
        knobs.batchTag = pref.tag.toLowerCase();
        break;
    }
  }
  return knobs;
}
