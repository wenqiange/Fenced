import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentStreak,
  fenceLine,
  hourlyBreaches,
  timeReclaimedMinutes,
  vulnerableHour,
  weekStats,
  type HistorySession,
} from "../stats";

function s(
  day: number,
  hour: number,
  minutes: number,
  hits = 0,
  status: "completed" | "abandoned" = "completed",
): HistorySession {
  const start = new Date(2026, 2, day, hour);
  return {
    startedAt: start.toISOString(),
    completedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    durationMinutes: minutes,
    shieldHits: hits,
    status,
    practice: false,
  };
}

const NOW = new Date(2026, 2, 11, 20); // Wed 11 Mar

test("week stats only count this ISO week and skip abandoned focus", () => {
  const h = [s(8, 10, 50, 1), s(9, 10, 25, 2), s(10, 10, 30, 4, "abandoned")];
  assert.deepEqual(weekStats(h, NOW), { focusMinutes: 25, shieldHits: 6, sessions: 1 });
});

test("streak counts back from today, or yesterday if today is still open", () => {
  assert.equal(currentStreak([s(9, 10, 25), s(10, 10, 25), s(11, 10, 25)], NOW), 3);
  assert.equal(currentStreak([s(9, 10, 25), s(10, 10, 25)], NOW), 2);
  assert.equal(currentStreak([s(8, 10, 25), s(10, 10, 25)], NOW), 1);
  assert.equal(currentStreak([s(8, 10, 25)], NOW), 0);
});

test("fence line is oldest-first and marks repaired days", () => {
  const repaired = { ...s(10, 9, 25), emergencyPassesUsed: 1 };
  const line = fenceLine([repaired, s(11, 9, 30), s(11, 14, 30)], 3, NOW);
  assert.deepEqual(
    line.map((d) => [d.minutes, d.repaired]),
    [
      [0, false],
      [25, true],
      [60, false],
    ],
  );
});

test("vulnerable hour needs evidence", () => {
  const b = hourlyBreaches([s(9, 15, 25, 2), s(10, 15, 25, 3), s(10, 9, 50, 0)]);
  assert.equal(vulnerableHour(b)?.hour, 15);
  assert.equal(vulnerableHour(hourlyBreaches([s(9, 15, 25, 2)])), null);
});

test("time reclaimed estimate", () => {
  assert.equal(timeReclaimedMinutes([s(9, 15, 25, 2), s(10, 15, 25, 3)]), 30);
});
