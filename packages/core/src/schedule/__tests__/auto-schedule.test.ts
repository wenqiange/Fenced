import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoSchedule } from "../auto-schedule";
import type { SchedulableTask } from "../time-block";

function task(
  partial: Partial<SchedulableTask> & Pick<SchedulableTask, "id" | "title" | "estimateMinutes">,
): SchedulableTask {
  return { dueAt: null, priority: "none", ...partial };
}

const mon = new Date(2026, 7, 3);
const tue = new Date(2026, 7, 4);
const wed = new Date(2026, 7, 5);

describe("@fenced/core - autoSchedule", () => {
  it("packs across multiple days when one day is too small", () => {
    const result = autoSchedule({
      days: [
        {
          day: mon,
          windows: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 10, 0) }],
        },
        {
          day: tue,
          windows: [{ startAt: new Date(2026, 7, 4, 9, 0), endAt: new Date(2026, 7, 4, 11, 0) }],
        },
      ],
      tasks: [task({ id: "a", title: "Thesis", estimateMinutes: 150 })],
      bufferMinutes: 0,
      minBlockMinutes: 15,
    });

    assert.equal(result.blocks.length, 2);
    assert.equal(result.blocks[0]!.dayKey, "2026-08-03");
    assert.equal(result.blocks[0]!.minutes, 60);
    assert.equal(result.blocks[1]!.dayKey, "2026-08-04");
    assert.equal(result.blocks[1]!.minutes, 90);
    assert.equal(result.blocks[1]!.reason, "spillover");
    assert.equal(result.unplaced.length, 0);
  });

  it("skips tasks blocked by incomplete dependencies", () => {
    const result = autoSchedule({
      days: [
        {
          day: mon,
          windows: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 12, 0) }],
        },
      ],
      tasks: [
        task({ id: "a", title: "Outline", estimateMinutes: 30 }),
        task({ id: "b", title: "Draft", estimateMinutes: 60, blockedBy: ["a"], priority: "high" }),
      ],
      completedTaskIds: [],
      bufferMinutes: 0,
    });

    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0]!.taskId, "a");
    assert.ok(result.unplaced.some((u) => u.taskId === "b" && u.reason === "blocked"));
  });

  it("schedules a dependent task once its blocker is complete", () => {
    const result = autoSchedule({
      days: [
        {
          day: mon,
          windows: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 12, 0) }],
        },
      ],
      tasks: [
        task({ id: "b", title: "Draft", estimateMinutes: 45, blockedBy: ["a"] }),
      ],
      completedTaskIds: ["a"],
      bufferMinutes: 0,
    });

    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0]!.taskId, "b");
  });

  it("subtracts already-scheduled minutes", () => {
    const result = autoSchedule({
      days: [
        {
          day: mon,
          windows: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 12, 0) }],
        },
      ],
      tasks: [task({ id: "a", title: "Essay", estimateMinutes: 90, scheduledMinutes: 60 })],
      bufferMinutes: 0,
    });

    assert.equal(result.blocks[0]!.minutes, 30);
  });

  it("marks placements after the due date", () => {
    const result = autoSchedule({
      days: [
        {
          day: wed,
          windows: [{ startAt: new Date(2026, 7, 5, 9, 0), endAt: new Date(2026, 7, 5, 12, 0) }],
        },
      ],
      tasks: [
        task({
          id: "a",
          title: "Due monday",
          estimateMinutes: 30,
          dueAt: new Date(2026, 7, 3, 17, 0),
        }),
      ],
      bufferMinutes: 0,
    });

    assert.equal(result.blocks[0]!.reason, "after-due");
  });

  it("avoids busy intervals on later days", () => {
    const result = autoSchedule({
      days: [
        {
          day: mon,
          windows: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 9, 30) }],
          busy: [{ startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 9, 30) }],
        },
        {
          day: tue,
          windows: [{ startAt: new Date(2026, 7, 4, 9, 0), endAt: new Date(2026, 7, 4, 10, 0) }],
        },
      ],
      tasks: [task({ id: "a", title: "Call", estimateMinutes: 30 })],
      bufferMinutes: 0,
      minBlockMinutes: 15,
    });

    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0]!.dayKey, "2026-08-04");
    assert.equal(result.blocks[0]!.reason, "spillover");
  });
});
