export interface TaskLoadInput {
  priority: "none" | "low" | "medium" | "high" | "urgent";
  estimateMinutes?: number | null;
  checklistLength?: number;
  tags?: string[];
  blockedByCount?: number;
}

export type FenceRecommendation = "rail" | "picket" | "palisade";

export interface LoadScoreResult {
  /** 0 to 100 score indicating cognitive load and focus intensity needed. */
  score: number;
  recommendation: FenceRecommendation;
  reason: string;
  suggestedFocusMinutes: number;
  suggestedStrictDelayMinutes: number;
}

const DEEP_TAGS = new Set(["deep-work", "deepwork", "exam", "estudio", "study", "code", "audit", "writing"]);

/**
 * Feature 1 (Load-Aware Fences):
 * Computes cognitive workload to dynamically recommend the right fence height:
 * - Rail (< 35): quick sprints, low cognitive load.
 * - Picket (35–75): standard focused blocks with balanced pauses.
 * - Palisade (> 75): deep high-leverage sessions with strict friction shields.
 */
export function calculateLoadScore(task: TaskLoadInput): LoadScoreResult {
  let score = 0;

  switch (task.priority) {
    case "urgent":
      score += 55;
      break;
    case "high":
      score += 40;
      break;
    case "medium":
      score += 25;
      break;
    case "low":
      score += 15;
      break;
    case "none":
    default:
      score += 10;
      break;
  }

  const mins = task.estimateMinutes ?? 30;
  if (mins > 60) {
    score += 25;
  } else if (mins >= 40) {
    score += 15;
  } else if (mins <= 15) {
    score -= 10;
  }

  if (task.checklistLength && task.checklistLength > 0) {
    score += Math.min(15, task.checklistLength * 3);
  }

  if (task.blockedByCount && task.blockedByCount > 0) {
    score += Math.min(10, task.blockedByCount * 5);
  }

  if (task.tags && task.tags.some((t) => DEEP_TAGS.has(t.toLowerCase()))) {
    score += 15;
  }

  score = Math.max(5, Math.min(100, score));

  if (score >= 75) {
    return {
      score,
      recommendation: "palisade",
      reason: "High cognitive workload or urgent deadline requires deep distraction shielding",
      suggestedFocusMinutes: 60,
      suggestedStrictDelayMinutes: 10,
    };
  }

  if (score >= 35) {
    return {
      score,
      recommendation: "picket",
      reason: "Moderate effort task suited for structured focus blocks and standard fences",
      suggestedFocusMinutes: 45,
      suggestedStrictDelayMinutes: 5,
    };
  }

  return {
    score,
    recommendation: "rail",
    reason: "Light task with low friction; a flexible fence is sufficient",
    suggestedFocusMinutes: 25,
    suggestedStrictDelayMinutes: 0,
  };
}
