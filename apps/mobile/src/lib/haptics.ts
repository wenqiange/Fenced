import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Platform } from "react-native";
import { getAppState } from "./local-store";

/**
 * Semantic haptics. Each maps to one moment in the brand's sound/haptic
 * table so the same event always feels the same.
 *
 * With Reduce Motion on, multi-pulse patterns collapse to their single
 * strongest pulse: still confirmed by touch, never "busy".
 */

let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v));
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => (reduceMotion = v));

export const isReduceMotionOn = () => reduceMotion;

const enabled = () => Platform.OS !== "web" && getAppState().settings.haptics;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const safe = (p: Promise<unknown>) => p.catch(() => undefined);

/** Bolt slides, then catches: medium, then heavy 80ms later. */
export async function hapticLatchClose() {
  if (!enabled()) return;
  if (reduceMotion) return safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  await wait(80);
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

/** A picket seats in the rails: light and dry. */
export function hapticPicketDrop() {
  if (!enabled()) return;
  void safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Panel finished: success, then a double light pulse. */
export async function hapticPanelComplete() {
  if (!enabled()) return;
  await safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  if (reduceMotion) return;
  await wait(220);
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  await wait(90);
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticTaskCheck() {
  if (!enabled()) return;
  void safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

/** "You bumped into something" — a double knock, not an error buzz. */
export async function hapticShieldKnock() {
  if (!enabled()) return;
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  if (reduceMotion) return;
  await wait(140);
  await safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Leaving early: one soft tap, deliberately unrewarding. */
export function hapticRelease() {
  if (!enabled()) return;
  void safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

export function hapticSelection() {
  if (!enabled()) return;
  void safe(Haptics.selectionAsync());
}
