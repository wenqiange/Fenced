import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { proposeTimeBlocks, type SchedulableTask } from "../time-block";

const day = new Date(2026, 7, 3); // Monday Aug 3 2026, local

function task(
  partial: Partial<SchedulableTask> & Pick<SchedulableTask, "id" | "title" | "estimateMinutes">,
): SchedulableTask {
  return {
    dueAt: null,
    priority: "none",
    ...partial,
  };
}

describe("@fenced/core - proposeTimeBlocks", () => {
  it("places a task into an open day window", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Essay", estimateMinutes: 60 })],
      busy: [],
      dayStartHour: 9,
      dayEndHour: 12,
      earliest: new Date(2026, 7, 3, 8, 0),
    });

    assert.equal(result.blocks.length, 1);
    assert.equal(result.unplaced.length, 0);
    assert.equal(result.blocks[0]!.minutes, 60);
    assert.equal(result.blocks[0]!.startAt.getHours(), 9);
    assert.equal(result.blocks[0]!.endAt.getHours(), 10);
  });

  it("avoids existing busy events", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Essay", estimateMinutes: 60 })],
      busy: [
        {
          startAt: new Date(2026, 7, 3, 9, 0),
          endAt: new Date(2026, 7, 3, 10, 0),
        },
      ],
      dayStartHour: 9,
      dayEndHour: 12,
      earliest: new Date(2026, 7, 3, 8, 0),
      bufferMinutes: 0,
    });

    assert.equal(result.blocks[0]!.startAt.getHours(), 10);
  });

  it("prefers Fenced Hour windows when provided", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Deep work", estimateMinutes: 45 })],
      busy: [],
      windows: [
        {
          startAt: new Date(2026, 7, 3, 14, 0),
          endAt: new Date(2026, 7, 3, 15, 30),
        },
      ],
      earliest: new Date(2026, 7, 3, 8, 0),
    });

    assert.equal(result.blocks[0]!.startAt.getHours(), 14);
    assert.equal(result.blocks[0]!.minutes, 45);
  });

  it("splits a long task across multiple short gaps", () => {
    // Four free 40-minute gaps inside a fenced morning, with 5m buffer between placements.
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Thesis", estimateMinutes: 180 })],
      busy: [
        { startAt: new Date(2026, 7, 3, 9, 40), endAt: new Date(2026, 7, 3, 10, 0) },
        { startAt: new Date(2026, 7, 3, 10, 40), endAt: new Date(2026, 7, 3, 11, 0) },
        { startAt: new Date(2026, 7, 3, 11, 40), endAt: new Date(2026, 7, 3, 12, 0) },
        { startAt: new Date(2026, 7, 3, 12, 40), endAt: new Date(2026, 7, 3, 13, 0) },
      ],
      windows: [
        { startAt: new Date(2026, 7, 3, 9, 0), endAt: new Date(2026, 7, 3, 13, 0) },
      ],
      earliest: new Date(2026, 7, 3, 8, 0),
      bufferMinutes: 0,
      minBlockMinutes: 15,
    });

    assert.equal(result.blocks.length, 4);
    assert.ok(result.blocks.every((b) => b.split));
    assert.equal(result.blocks[0]!.partCount, 4);
    assert.equal(
      result.blocks.reduce((sum, b) => sum + b.minutes, 0),
      160,
    );
    assert.equal(result.unplaced.length, 1);
    assert.equal(result.unplaced[0]!.unmetMinutes, 20);
    assert.equal(result.unplaced[0]!.reason, "too-small-gaps");
  });

  it("orders by due date then priority then size", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [
        task({ id: "low", title: "Low", estimateMinutes: 30, priority: "low" }),
        task({
          id: "due",
          title: "Due soon",
          estimateMinutes: 30,
          priority: "low",
          dueAt: new Date(2026, 7, 3, 18, 0),
        }),
        task({ id: "urgent", title: "Urgent", estimateMinutes: 30, priority: "urgent" }),
      ],
      busy: [],
      dayStartHour: 9,
      dayEndHour: 12,
      earliest: new Date(2026, 7, 3, 8, 0),
      bufferMinutes: 0,
    });

    assert.deepEqual(
      result.blocks.map((b) => b.taskId),
      ["due", "urgent", "low"],
    );
  });

  it("does not schedule before earliest", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Call", estimateMinutes: 30 })],
      busy: [],
      dayStartHour: 9,
      dayEndHour: 17,
      earliest: new Date(2026, 7, 3, 11, 15),
      bufferMinutes: 0,
    });

    assert.equal(result.blocks[0]!.startAt.getHours(), 11);
    assert.equal(result.blocks[0]!.startAt.getMinutes(), 15);
  });

  it("prefers earliest gap before deadline rather than later best-fitting gap", () => {
    // 60 min task due at 12:00.
    // Morning gap 9:00 - 11:00 (120 min), afternoon gap 15:00 - 16:00 (60 min).
    // An old pure best-fit would pick 15:00 because 60 matches 60 perfectly,
    // which breaks the 12:00 deadline. Earliest-fit places it in the morning gap!
    const result = proposeTimeBlocks({
      day,
      tasks: [
        task({
          id: "due-soon",
          title: "Urgent Essay",
          estimateMinutes: 60,
          dueAt: new Date(2026, 7, 3, 12, 0),
        }),
      ],
      busy: [
        {
          startAt: new Date(2026, 7, 3, 11, 0),
          endAt: new Date(2026, 7, 3, 15, 0),
        },
      ],
      dayStartHour: 9,
      dayEndHour: 17,
      bufferMinutes: 0,
      minBlockMinutes: 15,
    });

    assert.equal(result.blocks.length, 1);
    assert.equal(result.blocks[0]!.startAt.getHours(), 9);
    assert.ok(result.blocks[0]!.endAt <= new Date(2026, 7, 3, 12, 0));
  });

  it("reports unplaced when nothing fits", () => {
    const result = proposeTimeBlocks({
      day,
      tasks: [task({ id: "a", title: "Huge", estimateMinutes: 240 })],
      busy: [],
      windows: [
        { startAt: new Date(2026, 7, 3, 14, 0), endAt: new Date(2026, 7, 3, 14, 20) },
      ],
      earliest: new Date(2026, 7, 3, 8, 0),
      minBlockMinutes: 30,
    });

    assert.equal(result.blocks.length, 0);
    assert.equal(result.unplaced[0]!.reason, "no-fit");
  });
});
