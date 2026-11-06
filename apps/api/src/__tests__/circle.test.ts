import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeCirclePresence, type CoFocusCircle } from "@fenced/core";

describe("Co-Focus Circles & Silent Body Doubling Logic", () => {
  it("aggregates active focusers and subjects without DM exposure", () => {
    const circle: CoFocusCircle = {
      id: "c-123",
      name: "Selectividad 2026 - Biblioteca Silenciosa",
      inviteCode: "TIMBER-8K4P",
      circleFocusMinutes: 120,
      activeSessionEndsAt: null,
      members: [
        {
          id: "m-1",
          displayName: "Elena",
          avatarSeed: "elena82",
          isFocusing: true,
          currentSubject: "Matemáticas II",
          joinedAt: "2026-11-06T10:00:00Z",
        },
        {
          id: "m-2",
          displayName: "Lucas",
          avatarSeed: "lucas94",
          isFocusing: true,
          currentSubject: "Historia de España",
          joinedAt: "2026-11-06T10:15:00Z",
        },
        {
          id: "m-3",
          displayName: "Sara",
          avatarSeed: "sara11",
          isFocusing: false,
          joinedAt: "2026-11-06T10:30:00Z",
        },
      ],
    };

    const presence = summarizeCirclePresence(circle);
    assert.equal(presence.activeCount, 2);
    assert.equal(presence.totalMembers, 3);
    assert.deepEqual(presence.focusingSubjects, ["Matemáticas II", "Historia de España"]);
  });

  it("handles empty or all-resting circles gracefully", () => {
    const circle: CoFocusCircle = {
      id: "c-456",
      name: "Late Night Library",
      inviteCode: "TIMBER-99ZZ",
      circleFocusMinutes: 0,
      activeSessionEndsAt: null,
      members: [
        {
          id: "m-10",
          displayName: "Alex",
          avatarSeed: "seed10",
          isFocusing: false,
          joinedAt: "2026-11-06T12:00:00Z",
        },
      ],
    };

    const presence = summarizeCirclePresence(circle);
    assert.equal(presence.activeCount, 0);
    assert.equal(presence.totalMembers, 1);
    assert.deepEqual(presence.focusingSubjects, []);
  });
});
