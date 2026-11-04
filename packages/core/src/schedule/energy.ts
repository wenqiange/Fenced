export type Chronotype = "morning_lark" | "balanced" | "night_owl";

export interface SessionRecord {
  startedAt: string;
  durationMinutes: number;
  status: "completed" | "left-early" | "abandoned";
  shieldHits: number;
}

export interface EnergyProfile {
  chronotype: Chronotype;
  /** Hourly focus efficiency scores from 0.0 to 1.0 for hours 0..23. */
  hourlyCurve: number[];
  peakHour: number;
}

export interface EnergyTaskInput {
  id: string;
  title: string;
  estimateMinutes: number;
  priority: "none" | "low" | "medium" | "high" | "urgent";
}

export interface RebuiltDaySlot {
  taskId: string;
  title: string;
  startHour: number;
  durationMinutes: number;
  energyScore: number;
}

/**
 * Feature 5 (Rebuild the Day):
 * Generates an on-device personal energy curve based on session history
 * and reschedules slipped tasks into optimal biological focus windows.
 */
export function computeEnergyCurve(history: SessionRecord[]): EnergyProfile {
  const hourCompletions = new Array(24).fill(0);
  const hourAttempts = new Array(24).fill(0);

  for (const s of history) {
    const hour = new Date(s.startedAt).getHours();
    hourAttempts[hour] += 1;
    if (s.status === "completed") {
      hourCompletions[hour] += 1;
    }
  }

  // Base diurnal pattern (typical circadian rhythm)
  const defaultCurve = [
    0.1, 0.1, 0.1, 0.1, 0.2, 0.3, // 00:00 - 05:00 (rest)
    0.5, 0.7, 0.9, 0.95, 0.85, 0.75, // 06:00 - 11:00 (morning peak)
    0.6, 0.55, 0.65, 0.8, 0.85, 0.75, // 12:00 - 17:00 (post-lunch dip -> afternoon surge)
    0.6, 0.5, 0.4, 0.3, 0.2, 0.1, // 18:00 - 23:00 (evening wind-down)
  ];

  const hourlyCurve = new Array(24).fill(0);
  let bestHour = 9;
  let bestScore = -1;

  for (let h = 0; h < 24; h++) {
    const defaultVal = defaultCurve[h];
    if (hourAttempts[h] >= 2) {
      const empiricalSuccessRate = hourCompletions[h] / hourAttempts[h];
      hourlyCurve[h] = Math.round((defaultVal * 0.4 + empiricalSuccessRate * 0.6) * 100) / 100;
    } else {
      hourlyCurve[h] = defaultVal;
    }

    if (hourlyCurve[h] > bestScore) {
      bestScore = hourlyCurve[h];
      bestHour = h;
    }
  }

  let chronotype: Chronotype = "balanced";
  if (bestHour < 10) chronotype = "morning_lark";
  else if (bestHour >= 18) chronotype = "night_owl";

  return {
    chronotype,
    hourlyCurve,
    peakHour: bestHour,
  };
}

/**
 * Re-orders slipped tasks into remaining open hours, placing high-priority / high-effort
 * tasks into the highest-energy slots.
 */
export function rebuildDay(
  tasks: EnergyTaskInput[],
  startHour: number,
  endHour: number,
  energyProfile: EnergyProfile,
): RebuiltDaySlot[] {
  // Sort tasks by priority (urgent -> high -> medium -> low -> none)
  const rank: Record<string, number> = { urgent: 5, high: 4, medium: 3, low: 2, none: 1 };
  const sortedTasks = [...tasks].sort(
    (a, b) => (rank[b.priority] ?? 1) - (rank[a.priority] ?? 1) || b.estimateMinutes - a.estimateMinutes,
  );

  const availableHours: { hour: number; energy: number }[] = [];
  for (let h = Math.max(0, startHour); h <= Math.min(23, endHour); h++) {
    availableHours.push({ hour: h, energy: energyProfile.hourlyCurve[h] ?? 0.5 });
  }

  // Sort available hours by energy descending to match highest-value tasks to peak hours
  availableHours.sort((a, b) => b.energy - a.energy);

  const schedule: RebuiltDaySlot[] = [];
  const assignedHours = new Set<number>();

  for (const task of sortedTasks) {
    const slot = availableHours.find((h) => !assignedHours.has(h.hour));
    if (!slot) break;
    assignedHours.add(slot.hour);

    schedule.push({
      taskId: task.id,
      title: task.title,
      startHour: slot.hour,
      durationMinutes: Math.min(60, task.estimateMinutes || 30),
      energyScore: slot.energy,
    });
  }

  // Return in chronological order
  return schedule.sort((a, b) => a.startHour - b.startHour);
}
