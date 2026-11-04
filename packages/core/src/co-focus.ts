export interface CoFocusMember {
  id: string;
  displayName: string;
  avatarSeed: string;
  isFocusing: boolean;
  currentSubject?: string;
  joinedAt: string;
}

export interface CoFocusCircle {
  id: string;
  name: string;
  inviteCode: string;
  members: CoFocusMember[];
  circleFocusMinutes: number;
  activeSessionEndsAt: string | null;
}

/**
 * Feature 4 (Co-Focus Circles):
 * Minor-safe presence protocol for mutual study accountability.
 * Guarantees zero unmoderated DM vectors while sharing focus presence.
 */
export function summarizeCirclePresence(circle: CoFocusCircle): {
  activeCount: number;
  totalMembers: number;
  focusingSubjects: string[];
} {
  const activeMembers = circle.members.filter((m) => m.isFocusing);
  const subjects = [
    ...new Set(
      activeMembers
        .map((m) => m.currentSubject)
        .filter((s): s is string => typeof s === "string" && s.length > 0)
    ),
  ];

  return {
    activeCount: activeMembers.length,
    totalMembers: circle.members.length,
    focusingSubjects: subjects,
  };
}
