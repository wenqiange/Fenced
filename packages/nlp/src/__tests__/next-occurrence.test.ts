import { test } from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence } from "../next-occurrence";

const d = (y: number, m: number, day: number, h = 9) => new Date(y, m - 1, day, h, 0, 0);
const key = (x: Date | null) =>
  x ? `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()} ${x.getHours()}h` : null;

test("daily advances one day and keeps time", () => {
  assert.equal(key(nextOccurrence("FREQ=DAILY", d(2026, 3, 10))), "2026-3-11 9h");
});

test("every 2 days skips forward past notBefore on the cadence", () => {
  assert.equal(key(nextOccurrence("FREQ=DAILY;INTERVAL=2", d(2026, 3, 1), d(2026, 3, 6))), "2026-3-7 9h");
});

test("weekly BYDAY picks the next listed weekday", () => {
  // 2026-03-10 is a Tuesday
  assert.equal(key(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TH", d(2026, 3, 10))), "2026-3-12 9h");
  assert.equal(key(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TH", d(2026, 3, 12))), "2026-3-16 9h");
});

test("biweekly respects week parity", () => {
  assert.equal(key(nextOccurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", d(2026, 3, 10))), "2026-3-24 9h");
});

test("monthly last day clamps to month length", () => {
  assert.equal(key(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=-1", d(2026, 1, 31))), "2026-2-28 9h");
});

test("monthly on the 31st skips short months", () => {
  assert.equal(key(nextOccurrence("FREQ=MONTHLY", d(2026, 1, 31))), "2026-3-31 9h");
});

test("yearly", () => {
  assert.equal(key(nextOccurrence("FREQ=YEARLY", d(2026, 6, 1))), "2027-6-1 9h");
});

test("UNTIL ends the series", () => {
  assert.equal(nextOccurrence("FREQ=DAILY;UNTIL=20260310", d(2026, 3, 10)), null);
  assert.equal(key(nextOccurrence("FREQ=DAILY;UNTIL=20260311", d(2026, 3, 10))), "2026-3-11 9h");
});

test("garbage rule returns null", () => {
  assert.equal(nextOccurrence("nope", d(2026, 3, 10)), null);
});
