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

  it("parses day-of-month and day-first dates", () => {
    const res = parseTaskInput("Pay rent on 3 September", refDate);
    assert.ok(res.dueAt);
    assert.equal(res.dueAt.getMonth(), 8);
    assert.equal(res.dueAt.getDate(), 3);
    assert.equal(res.title, "Pay rent");
  });
});

describe("@fenced/nlp - Recurrence", () => {
  const refDate = new Date("2026-07-31T10:00:00.000Z");

  it("parses a single weekday", () => {
    const res = parseTaskInput("Gym every Monday", refDate);
    assert.equal(res.rrule, "FREQ=WEEKLY;BYDAY=MO");
    assert.equal(res.title, "Gym");
    assert.equal(res.dueAt, null);
  });

  it("parses a list of weekdays and keeps them in week order", () => {
    const res = parseTaskInput("Standup every fri, mon and wed at 9am", refDate);
    assert.equal(res.rrule, "FREQ=WEEKLY;BYDAY=MO,WE,FR");
    assert.equal(res.title, "Standup");
    assert.ok(res.dueAt);
    assert.equal(res.dueAt.getHours(), 9);
  });

  it("parses weekdays and weekends as day spans", () => {
    assert.equal(
      parseTaskInput("Journal weekdays at 9", refDate).rrule,
      "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    );
    assert.equal(
      parseTaskInput("Long run every weekend", refDate).rrule,
      "FREQ=WEEKLY;BYDAY=SA,SU",
    );
  });

  it("parses plain frequencies and adverbs", () => {
    assert.equal(parseTaskInput("Water plants every day", refDate).rrule, "FREQ=DAILY");
    assert.equal(parseTaskInput("Daily standup", refDate).rrule, "FREQ=DAILY");
    assert.equal(parseTaskInput("Review budget monthly", refDate).rrule, "FREQ=MONTHLY");
    assert.equal(parseTaskInput("Board report quarterly", refDate).rrule, "FREQ=MONTHLY;INTERVAL=3");
  });

  it("parses intervals written as words, digits and 'other'", () => {
    assert.equal(parseTaskInput("Deep clean every two weeks", refDate).rrule, "FREQ=WEEKLY;INTERVAL=2");
    assert.equal(parseTaskInput("Invoice every 3 months", refDate).rrule, "FREQ=MONTHLY;INTERVAL=3");
    assert.equal(parseTaskInput("Therapy every other tuesday", refDate).rrule, "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU");
    assert.equal(parseTaskInput("Retro every 2 weeks on monday", refDate).rrule, "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO");
  });

  it("parses monthly rules anchored to a day of the month", () => {
    const first = parseTaskInput("Pay rent the first of each month", refDate);
    assert.equal(first.rrule, "FREQ=MONTHLY;BYMONTHDAY=1");
    assert.equal(first.title, "Pay rent");

    assert.equal(
      parseTaskInput("Payroll on the 1st and 15th of every month", refDate).rrule,
      "FREQ=MONTHLY;BYMONTHDAY=1,15",
    );
    assert.equal(
      parseTaskInput("Close books the last day of the month", refDate).rrule,
      "FREQ=MONTHLY;BYMONTHDAY=-1",
    );
    assert.equal(
      parseTaskInput("Sync every month on the 3rd", refDate).rrule,
      "FREQ=MONTHLY;BYMONTHDAY=3",
    );
  });

  it("parses an end date into UNTIL", () => {
    const res = parseTaskInput("Swim every two weeks until June", refDate);
    assert.equal(res.title, "Swim");
    assert.ok(res.recurrence);
    assert.equal(res.recurrence.freq, "WEEKLY");
    assert.equal(res.recurrence.interval, 2);
    assert.ok(res.recurrence.until);
    assert.equal(res.recurrence.until.getMonth(), 5); // June
    assert.equal(res.recurrence.until.getFullYear(), 2027); // June has already passed in 2026
    assert.match(res.rrule ?? "", /^FREQ=WEEKLY;INTERVAL=2;UNTIL=\d{8}T\d{6}Z$/);
  });

  it("parses a repetition count", () => {
    const res = parseTaskInput("Physio every week for 6 weeks", refDate);
    assert.equal(res.rrule, "FREQ=WEEKLY;COUNT=6");
    assert.equal(res.title, "Physio");
  });

  it("does not invent recurrence for one-off tasks", () => {
    const res = parseTaskInput("Plan the weekend trip tomorrow", refDate);
    assert.equal(res.rrule, null);
    assert.equal(res.recurrence, null);
  });
});

describe("@fenced/nlp - Ambiguity", () => {
  const refDate = new Date("2026-07-31T10:00:00.000Z");

  it("accepts a clean task without complaining", () => {
    const res = parseTaskInput("Check in with Ana tomorrow at 4pm", refDate);
    assert.equal(res.isAmbiguous, false);
    assert.deepEqual(res.ambiguities, []);
    assert.equal(res.title, "Check in with Ana");
  });

  it("asks about a bare hour", () => {
    const res = parseTaskInput("Journal weekdays at 9", refDate);
    const meridiem = res.ambiguities.find((a) => a.kind === "meridiem");
    assert.ok(meridiem);
    assert.deepEqual(meridiem.options, ["9:00 AM", "9:00 PM"]);
    assert.equal(res.isAmbiguous, true);
  });

  it("does not ask about an explicit hour", () => {
    const res = parseTaskInput("Journal weekdays at 9am", refDate);
    assert.equal(res.ambiguities.length, 0);
  });

  it("flags a date that was started but never finished", () => {
    const res = parseTaskInput("Send the invoice on", refDate);
    const dangling = res.ambiguities.find((a) => a.kind === "dangling-temporal");
    assert.ok(dangling);
    assert.equal(dangling.text, "on");
  });

  it("flags a repetition it could not read", () => {
    const res = parseTaskInput("Water plants every so often", refDate);
    assert.equal(res.rrule, null);
    assert.ok(res.ambiguities.some((a) => a.kind === "dangling-temporal"));
  });

  it("flags input that left no title behind", () => {
    const res = parseTaskInput("tomorrow at 4pm", refDate);
    assert.ok(res.ambiguities.some((a) => a.kind === "empty-title"));
  });

  it("asks which day a month-only end date means", () => {
    const res = parseTaskInput("Swim every two weeks until June", refDate);
    assert.ok(res.ambiguities.some((a) => a.kind === "recurrence-end"));
  });
});
