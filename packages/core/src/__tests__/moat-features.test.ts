import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLoadScore,
  planDeadlineGravity,
  computeEnergyCurve,
  rebuildDay,
  evaluateClassMode,
  validatePactCompliance,
  computeYardProgression,
  summarizeCirclePresence,
  type FamilyPact,
} from "../index";

describe("@fenced/core - Moat Features F1 to F8", () => {
  it("F1: calculateLoadScore suggests appropriate fence height", () => {
    // Light task
    const light = calculateLoadScore({ priority: "none", estimateMinutes: 15 });
    assert.equal(light.recommendation, "rail");

    // Medium task
    const med = calculateLoadScore({ priority: "medium", estimateMinutes: 45, checklistLength: 2 });
    assert.equal(med.recommendation, "picket");

    // Deep heavy task
    const heavy = calculateLoadScore({
      priority: "urgent",
      estimateMinutes: 90,
      checklistLength: 5,
      blockedByCount: 1,
      tags: ["deep-work", "audit"],
    });
    assert.equal(heavy.recommendation, "palisade");
    assert.equal(heavy.suggestedStrictDelayMinutes, 10);
  });

  it("F2: planDeadlineGravity pulls focus blocks backward toward deadline", () => {
    const now = new Date(2026, 2, 10, 9, 0);
    const taskDueAt = new Date(2026, 2, 10, 18, 0); // 9h horizon
    const freeGaps = [
      { startAt: new Date(2026, 2, 10, 10, 0), endAt: new Date(2026, 2, 10, 12, 0) },
      { startAt: new Date(2026, 2, 10, 14, 0), endAt: new Date(2026, 2, 10, 16, 0) },
    ];

    const placements = planDeadlineGravity({
      taskDueAt,
      estimateMinutes: 90,
      now,
      freeGaps,
      maxBlockMinutes: 60,
    });

    assert.equal(placements.length, 2);
    // Chronological order
    assert.ok(placements[0].startAt < placements[1].startAt);
    assert.equal(placements[0].durationMinutes + placements[1].durationMinutes, 90);
    // The later block has higher gravitational pull
    assert.ok(placements[1].gravitationalPull >= placements[0].gravitationalPull);
  });

  it("F5: computeEnergyCurve and rebuildDay place tasks in peak biological windows", () => {
    const history = [
      { startedAt: "2026-03-01T09:00:00Z", durationMinutes: 45, status: "completed" as const, shieldHits: 0 },
      { startedAt: "2026-03-02T09:30:00Z", durationMinutes: 50, status: "completed" as const, shieldHits: 1 },
      { startedAt: "2026-03-03T15:00:00Z", durationMinutes: 30, status: "abandoned" as const, shieldHits: 5 },
    ];

    const profile = computeEnergyCurve(history);
    assert.equal(profile.hourlyCurve.length, 24);
    assert.ok(profile.peakHour >= 0 && profile.peakHour < 24);

    const tasks = [
      { id: "t1", title: "Urgent Math", estimateMinutes: 50, priority: "urgent" as const },
      { id: "t2", title: "Read Chapter", estimateMinutes: 25, priority: "low" as const },
    ];

    const schedule = rebuildDay(tasks, 8, 17, profile);
    assert.equal(schedule.length, 2);
    assert.ok(schedule.every((s) => s.startHour >= 8 && s.startHour <= 17));
  });

  it("F6: evaluateClassMode enforces classroom fences and opens during breaks", () => {
    const schedule = {
      schoolName: "Institut Barcelona-Congrés",
      enabled: true,
      periods: [
        { id: "p1", name: "Matemàtiques", startTime: "08:30", endTime: "09:25", daysOfWeek: [1, 2, 3, 4, 5] },
        { id: "p2", name: "Pati / Break", startTime: "09:25", endTime: "09:45", daysOfWeek: [1, 2, 3, 4, 5], isBreak: true },
        { id: "p3", name: "Física", startTime: "09:45", endTime: "10:40", daysOfWeek: [1, 2, 3, 4, 5] },
      ],
      strictDelayMinutes: 10,
    };

    // Tuesday at 09:00 (during p1)
    const tuesdayClass = new Date(2026, 2, 10, 9, 0); // 2026-03-10 is a Tuesday (getDay() = 2)
    const st1 = evaluateClassMode(schedule, tuesdayClass);
    assert.equal(st1.inClass, true);
    assert.equal(st1.shieldShouldArm, true);
    assert.equal(st1.activePeriod?.name, "Matemàtiques");

    // Tuesday at 09:30 (during break)
    const tuesdayBreak = new Date(2026, 2, 10, 9, 30);
    const st2 = evaluateClassMode(schedule, tuesdayBreak);
    assert.equal(st2.inClass, false);
    assert.equal(st2.shieldShouldArm, false);
    assert.equal(st2.activePeriod?.isBreak, true);

    // Sunday (no school)
    const sunday = new Date(2026, 2, 15, 9, 0); // getDay() = 0
    const st3 = evaluateClassMode(schedule, sunday);
    assert.equal(st3.inClass, false);
    assert.equal(st3.shieldShouldArm, false);
  });

  it("F8: validatePactCompliance verifies focus target and emergency passes", () => {
    const pact: FamilyPact = {
      id: "pact-1",
      guardianEmail: "guardian@example.com",
      studentDisplayName: "Alex",
      status: "active",
      rules: [
        { id: "r1", type: "daily_focus_target", description: "60 mins per day", targetValue: 60, allowedTokens: [] },
        { id: "r2", type: "emergency_passes", description: "Max 3 passes", targetValue: 3, allowedTokens: [] },
      ],
      guardianSignedAt: "2026-03-01T10:00:00Z",
      studentSignedAt: "2026-03-01T10:05:00Z",
      version: 1,
      createdAt: "2026-03-01T10:00:00Z",
      updatedAt: "2026-03-01T10:00:00Z",
    };

    // Compliant: 320 mins focus (target 300) and 2 passes used (max 3)
    const c1 = validatePactCompliance(pact, { weeklyFocusMinutes: 320, emergencyPassesUsed: 2 });
    assert.equal(c1.compliant, true);
    assert.equal(c1.targetMet, true);

    // Non-compliant: 4 passes used
    const c2 = validatePactCompliance(pact, { weeklyFocusMinutes: 350, emergencyPassesUsed: 4 });
    assert.equal(c2.compliant, false);
    assert.equal(c2.passesUnderBudget, false);
  });

  it("F3: computeYardProgression yields correct tier and materials", () => {
    const history = [
      { status: "completed" as const, durationMinutes: 60 },
      { status: "completed" as const, durationMinutes: 45 },
      { status: "completed" as const, durationMinutes: 50 },
      { status: "abandoned" as const, durationMinutes: 10 },
    ];

    const yard = computeYardProgression(history);
    assert.equal(yard.fencesCompleted, 3);
    assert.equal(yard.totalPicketsPlanted, 15); // 155 min / 10
    assert.equal(yard.tier, "sapling");
    assert.equal(yard.durabilityScore, 75); // 3 completed out of 4 total
  });

  it("F4: summarizeCirclePresence aggregates active members without DM leak", () => {
    const circle = {
      id: "circle-1",
      name: "2n Batxillerat Study Group",
      inviteCode: "BATX26",
      members: [
        { id: "m1", displayName: "Maria", avatarSeed: "seed1", isFocusing: true, currentSubject: "Història", joinedAt: "2026-03-01" },
        { id: "m2", displayName: "Pau", avatarSeed: "seed2", isFocusing: true, currentSubject: "Física", joinedAt: "2026-03-01" },
        { id: "m3", displayName: "Jordi", avatarSeed: "seed3", isFocusing: false, joinedAt: "2026-03-01" },
      ],
      circleFocusMinutes: 450,
      activeSessionEndsAt: null,
    };

    const summary = summarizeCirclePresence(circle);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.totalMembers, 3);
    assert.deepEqual(summary.focusingSubjects, ["Història", "Física"]);
  });
});
