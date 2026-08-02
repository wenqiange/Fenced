import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTaskInput } from "../parser";

describe("@fenced/nlp - Task Natural Language Parser", () => {
  const refDate = new Date("2026-07-31T10:00:00.000Z");

  it("extracts tags and priority", () => {
    const res = parseTaskInput("Finish audit report !high #work #audit", refDate);
    assert.equal(res.title, "Finish audit report");
    assert.equal(res.priority, "high");
    assert.deepEqual(res.tags, ["work", "audit"]);
  });

  it("extracts duration estimates", () => {
    const res1 = parseTaskInput("Deep work session 1h 30m !urgent", refDate);
    assert.equal(res1.title, "Deep work session");
    assert.equal(res1.estimateMinutes, 90);
    assert.equal(res1.priority, "urgent");

    const res2 = parseTaskInput("Quick call 45m #team", refDate);
    assert.equal(res2.estimateMinutes, 45);
  });

  it("parses relative date keywords like tomorrow and today", () => {
    const resTomorrow = parseTaskInput("Submit PR tomorrow", refDate);
    assert.ok(resTomorrow.dueAt);
    assert.equal(resTomorrow.dueAt.getDate(), 1); // August 1st
    assert.equal(resTomorrow.title, "Submit PR");
  });
});
