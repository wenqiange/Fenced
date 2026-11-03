import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  applyEmergencyPass,
  cancelStrictUnlock,
  emergencyPassesLeft,
  focusedMinutes,
  formatClock,
  isShieldPaused,
  remainingMs,
  requestStrictUnlock,
  startSession,
  strictUnlockRemainingMs,
} from "../session-engine";

const T0 = new Date("2026-03-10T09:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

test("remaining time is wall-clock based", () => {
  const s = startSession({ presetLabel: "Deep", durationMinutes: 25 }, "s1", T0);
  assert.equal(remainingMs(s, at(10)), 15 * 60_000);
  assert.equal(remainingMs(s, at(40)), 0);
});

test("single block finishes at its end", () => {
  const s = startSession({ presetLabel: "x", durationMinutes: 25 }, "s1", T0);
  assert.equal(advance(s, at(24)).done, false);
  assert.equal(advance(s, at(25)).done, true);
});

test("pomodoro walks focus → break → focus, even across a long suspend", () => {
  const s = startSession(
    { presetLabel: "x", durationMinutes: 25, breakMinutes: 5, cycles: 3 },
    "s1",
    T0,
  );
  const r1 = advance(s, at(26));
  assert.equal(r1.session.phase, "break");
  assert.equal(r1.session.cycleIndex, 0);
  // App was killed for 40 minutes: lands in the third focus block.
  const r2 = advance(s, at(66));
  assert.equal(r2.session.phase, "focus");
  assert.equal(r2.session.cycleIndex, 2);
  assert.equal(r2.session.endsAt, at(85).toISOString());
  assert.equal(advance(s, at(85)).done, true);
  assert.equal(focusedMinutes(r2.session, at(70)), 60);
});

test("strict unlock countdown cannot be restarted or shortened", () => {
  let s = startSession(
    { presetLabel: "x", durationMinutes: 60, strictDelayMinutes: 10 },
    "s1",
    T0,
  );
  assert.equal(strictUnlockRemainingMs(s, at(1)), null);
  s = requestStrictUnlock(s, at(1));
  s = requestStrictUnlock(s, at(5));
  assert.equal(strictUnlockRemainingMs(s, at(5)), 6 * 60_000);
  assert.equal(strictUnlockRemainingMs(s, at(11)), 0);
  assert.equal(strictUnlockRemainingMs(cancelStrictUnlock(s), at(11)), null);
});

test("non-strict sessions unlock immediately", () => {
  const s = startSession({ presetLabel: "x", durationMinutes: 60 }, "s1", T0);
  assert.equal(strictUnlockRemainingMs(s, T0), 0);
});

test("emergency pass lowers the shield for exactly 180s", () => {
  const s = applyEmergencyPass(
    startSession({ presetLabel: "x", durationMinutes: 60 }, "s1", T0),
    at(1),
  );
  assert.equal(isShieldPaused(s, new Date(at(1).getTime() + 179_000)), true);
  assert.equal(isShieldPaused(s, new Date(at(1).getTime() + 180_000)), false);
});

test("emergency pass budget resets each ISO week", () => {
  const now = new Date(2026, 2, 11, 12); // Wednesday
  const lastWeek = new Date(2026, 2, 8, 12).toISOString(); // Sunday before
  const thisWeek = new Date(2026, 2, 9, 8).toISOString(); // Monday
  assert.equal(emergencyPassesLeft([lastWeek, thisWeek], 2, now), 1);
});

test("clock formatting", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(61_000), "01:01");
  assert.equal(formatClock(3_600_000), "1:00:00");
});
