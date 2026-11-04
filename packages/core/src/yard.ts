export type YardTier = "sapling" | "timber_grove" | "iron_forge" | "stone_bastion";

export interface YardGardenState {
  totalPicketsPlanted: number;
  fencesCompleted: number;
  tier: YardTier;
  durabilityScore: number; // 0..100
  harvestedMaterials: {
    timber: number;
    iron: number;
    stone: number;
  };
}

/**
 * Feature 3 (The Fence Yard):
 * Computes tactile garden progression earned through completed focus blocks.
 * Every honest session adds pickets and materials to the user's yard.
 */
export function computeYardProgression(history: {
  status: "completed" | "left-early" | "abandoned";
  durationMinutes: number;
}[]): YardGardenState {
  let completed = 0;
  let abandoned = 0;
  let totalMinutes = 0;

  for (const s of history) {
    if (s.status === "completed") {
      completed++;
      totalMinutes += s.durationMinutes;
    } else if (s.status === "abandoned") {
      abandoned++;
    }
  }

  const pickets = Math.floor(totalMinutes / 10);
  const durability = completed + abandoned === 0
    ? 100
    : Math.round((completed / (completed + abandoned)) * 100);

  let tier: YardTier = "sapling";
  if (completed >= 50) tier = "stone_bastion";
  else if (completed >= 25) tier = "iron_forge";
  else if (completed >= 10) tier = "timber_grove";

  return {
    totalPicketsPlanted: pickets,
    fencesCompleted: completed,
    tier,
    durabilityScore: durability,
    harvestedMaterials: {
      timber: Math.floor(totalMinutes * 0.5),
      iron: Math.floor(completed * 2),
      stone: Math.floor(completed / 5),
    },
  };
}
