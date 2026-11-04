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
  /** Picket settling into the rails: ~3% overshoot, ~185ms settle. */
  picket: { damping: 26, stiffness: 520, mass: 0.6 },
  /** Latch catching: clamped travel, decisive seat, zero wobble. */
  latch: { damping: 25, stiffness: 700, mass: 0.6, overshootClamping: true },
  /** Sheets and panels. */
  sheet: { damping: 24, stiffness: 260, mass: 0.9 },
  /** Gate swinging open. */
  gateSwing: { damping: 18, stiffness: 240, mass: 1 },
} as const;
