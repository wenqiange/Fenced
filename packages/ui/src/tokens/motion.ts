/**
 * "Everything latches": short, decisive, slight overshoot then settle.
 * Durations come straight from docs/03-brand-direction.md § Motion.
 */
export const motion = {
  gateClose: 400,
  picketDrop: 180,
  panelComplete: 600,
  gateOpen: 350,
  shieldIn: 150,
  streakExtend: 500,
  tabChange: 200,
  press: 120,
} as const;

/** Spring configs (Reanimated `withSpring`). */
export const springs = {
  /** Button press-in: crisp, no wobble. */
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  /** Picket settling into the rails: one small bounce. */
  picket: { damping: 13, stiffness: 320, mass: 0.7 },
  /** Latch catching: overshoot then hard stop. */
  latch: { damping: 11, stiffness: 380, mass: 0.8 },
  /** Sheets and panels. */
  sheet: { damping: 24, stiffness: 260, mass: 0.9 },
} as const;
