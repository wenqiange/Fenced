import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeRrule } from "../describe";
import { parseTaskInput } from "../parser";

describe("@fenced/nlp - describeRrule", () => {
  it("describes plain frequencies", () => {
    assert.equal(describeRrule("FREQ=DAILY"), "Daily");
    assert.equal(describeRrule("FREQ=MONTHLY"), "Monthly");
    assert.equal(describeRrule("FREQ=WEEKLY;INTERVAL=2"), "Every 2 weeks");
  });

  it("describes weekday sets", () => {
    assert.equal(describeRrule("FREQ=WEEKLY;BYDAY=MO"), "Every Mon");
    assert.equal(describeRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR"), "Every Mon, Wed, Fri");
    assert.equal(describeRrule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"), "Weekdays");
    assert.equal(describeRrule("FREQ=WEEKLY;BYDAY=SA,SU"), "Weekends");
    assert.equal(describeRrule("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"), "Every 2 weeks on Tue");
  });

  it("describes days of the month with ordinals", () => {
    assert.equal(describeRrule("FREQ=MONTHLY;BYMONTHDAY=1"), "Monthly on the 1st");
    assert.equal(describeRrule("FREQ=MONTHLY;BYMONTHDAY=1,15"), "Monthly on the 1st, 15th");
    assert.equal(describeRrule("FREQ=MONTHLY;BYMONTHDAY=-1"), "Monthly on the last day");
  });

  it("describes end conditions", () => {
    assert.match(describeRrule("FREQ=WEEKLY;UNTIL=20270630T235959Z") ?? "", /^Weekly until /);
    assert.equal(describeRrule("FREQ=WEEKLY;COUNT=6"), "Weekly (6 times)");
  });

  it("ignores input that is not a usable rule", () => {
    assert.equal(describeRrule(null), null);
    assert.equal(describeRrule(""), null);
    assert.equal(describeRrule("BYDAY=MO"), null);
  });

  it("round-trips what the parser produces", () => {
    const ref = new Date("2026-07-31T10:00:00.000Z");
    assert.equal(
      describeRrule(parseTaskInput("Retro every 2 weeks on monday", ref).rrule),
      "Every 2 weeks on Mon",
    );
    assert.equal(
      describeRrule(parseTaskInput("Pay rent the first of each month", ref).rrule),
      "Monthly on the 1st",
    );
  });
});
