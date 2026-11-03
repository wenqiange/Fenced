import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutDay, monthMatrix } from "../calendar-grid";

test("month grid grows to 6 weeks when needed and never cuts the 31st", () => {
  // March 2025: starts Saturday, 31 days → needs 42 cells.
  const mar = monthMatrix(new Date(2025, 2, 15));
  assert.equal(mar.length, 42);
  assert.ok(mar.some((c) => c.inMonth && c.date.getDate() === 31));
  // February 2021: starts Monday, 28 days → exactly 4 weeks.
  assert.equal(monthMatrix(new Date(2021, 1, 10)).length, 28);
  // June 2026: starts Monday, 30 days → 35.
  const jun = monthMatrix(new Date(2026, 5, 1));
  assert.equal(jun.length, 35);
  assert.equal(jun[0].date.getDate(), 1);
});

test("overlapping events split into columns; separate ones don't", () => {
  const day = new Date(2026, 2, 10);
  const at = (h: number, m = 0) => new Date(2026, 2, 10, h, m);
  const placed = layoutDay(
    [
      { id: "a", start: at(9), end: at(10) },
      { id: "b", start: at(9, 30), end: at(11) },
      { id: "c", start: at(12), end: at(12, 5) },
    ],
    day,
  );
  const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
  assert.equal(byId.a.columns, 2);
  assert.notEqual(byId.a.column, byId.b.column);
  assert.equal(byId.c.columns, 1);
  assert.equal(byId.c.height, 20); // min height keeps it tappable
  assert.equal(byId.a.top, 540);
});
