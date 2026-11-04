export interface TimetablePeriod {
  id: string;
  name: string; // e.g. "Matemàtiques", "Physics"
  startTime: string; // "08:30"
  endTime: string; // "09:25"
  daysOfWeek: number[]; // 1=Mon .. 5=Fri
  isBreak?: boolean;
}

export interface ClassModeSchedule {
  schoolName: string;
  enabled: boolean;
  periods: TimetablePeriod[];
  strictDelayMinutes: number;
}

export interface ClassModeStatus {
  inClass: boolean;
  activePeriod: TimetablePeriod | null;
  nextPeriod: TimetablePeriod | null;
  shieldShouldArm: boolean;
}

/**
 * Feature 6 (Class Mode):
 * Evaluates whether device should automatically enforce a classroom fence
 * according to the student's timetable, lowering shields only during designated breaks.
 */
export function evaluateClassMode(
  schedule: ClassModeSchedule,
  now: Date = new Date(),
): ClassModeStatus {
  if (!schedule.enabled) {
    return {
      inClass: false,
      activePeriod: null,
      nextPeriod: null,
      shieldShouldArm: false,
    };
  }

  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activePeriod: TimetablePeriod | null = null;
  let nextPeriod: TimetablePeriod | null = null;
  let minDiffToNext = Infinity;

  for (const period of schedule.periods) {
    if (!period.daysOfWeek.includes(currentDay)) continue;

    const [startH, startM] = period.startTime.split(":").map(Number);
    const [endH, endM] = period.endTime.split(":").map(Number);
    const periodStart = startH * 60 + startM;
    const periodEnd = endH * 60 + endM;

    if (currentMinutes >= periodStart && currentMinutes < periodEnd) {
      activePeriod = period;
    } else if (periodStart > currentMinutes) {
      const diff = periodStart - currentMinutes;
      if (diff < minDiffToNext) {
        minDiffToNext = diff;
        nextPeriod = period;
      }
    }
  }

  const inClass = activePeriod !== null && !activePeriod.isBreak;

  return {
    inClass,
    activePeriod,
    nextPeriod,
    shieldShouldArm: inClass,
  };
}
