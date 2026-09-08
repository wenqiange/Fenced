import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCalendar } from "../build";
import { escapeText, foldLine, formatFloating, formatUtc } from "../escape";
import {
  firstOccurrenceOnOrAfter,
  wallTimeWindow,
  weeklyRule,
} from "../recurrence";
import type { IcsEvent } from "../types";

const STAMP = new Date("2026-09-08T06:00:00.000Z");

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

/** Undoes RFC 5545 folding so a value can be asserted as one string. */
function unfold(ics: string): string {
  return ics.split("\r\n ").join("");
}

describe("escapeText", () => {
  it("escapes the four TEXT metacharacters", () => {
    assert.equal(
      escapeText("Study; maths, physics\\notes\nline two"),
      "Study\\; maths\\, physics\\\\notes\\nline two"
    );
  });

  it("escapes backslashes before the escapes it introduces", () => {
    // A naive order would turn `\` into `\\` and then re-escape those slashes.
    assert.equal(escapeText("a\\;b"), "a\\\\\\;b");
  });

  it("normalises every newline form to \\n", () => {
    assert.equal(escapeText("a\r\nb\rc\nd"), "a\\nb\\nc\\nd");
  });
});

describe("foldLine", () => {
  it("leaves lines within 75 octets untouched", () => {
    const line = "SUMMARY:" + "x".repeat(60);
    assert.equal(foldLine(line), line);
  });

  it("folds long lines with a leading space continuation", () => {
    const folded = foldLine("SUMMARY:" + "x".repeat(200));
    const parts = folded.split("\r\n");
    assert.ok(parts.length > 1);
    assert.equal(Buffer.byteLength(parts[0], "utf8"), 75);
    for (const part of parts.slice(1)) {
      assert.equal(part[0], " ");
      assert.ok(Buffer.byteLength(part, "utf8") <= 75);
    }
    assert.equal(folded.split("\r\n ").join(""), "SUMMARY:" + "x".repeat(200));
  });

  it("never splits a multi-byte character", () => {
    // 40 three-byte characters = 120 octets, so the fold lands mid-sequence
    // unless the boundary is backed off.
    const folded = foldLine("SUMMARY:" + "€".repeat(40));
    for (const part of folded.split("\r\n")) {
      assert.ok(!part.includes("�"), "replacement char means a split sequence");
    }
    assert.equal(folded.split("\r\n ").join(""), "SUMMARY:" + "€".repeat(40));
  });
});

describe("formatUtc / formatFloating", () => {
  it("writes UTC instants with a Z suffix", () => {
    assert.equal(formatUtc(new Date("2026-09-08T14:30:00Z")), "20260908T143000Z");
  });

  it("writes floating wall times without a zone marker", () => {
    assert.equal(formatFloating("2026-09-08T14:00"), "20260908T140000");
  });
});

describe("buildCalendar", () => {
  const instant: IcsEvent = {
    uid: "evt-1@fenced.app",
    summary: "Deep work",
    description: "Ship the calendar export",
    timing: {
      kind: "instant",
      start: new Date("2026-09-08T14:00:00Z"),
      end: new Date("2026-09-08T15:30:00Z"),
    },
    alarms: [{ minutesBefore: 10 }],
  };

  it("emits a well-formed VCALENDAR envelope", () => {
    const ics = buildCalendar({ name: "Fenced", events: [instant] }, STAMP);
    const out = lines(ics);
    assert.equal(out[0], "BEGIN:VCALENDAR");
    assert.equal(out[1], "VERSION:2.0");
    assert.ok(out.includes("CALSCALE:GREGORIAN"));
    assert.ok(out.includes("METHOD:PUBLISH"));
    assert.ok(out.includes("X-WR-CALNAME:Fenced"));
    // A trailing CRLF leaves one empty element after the final line.
    assert.equal(out[out.length - 1], "");
    assert.equal(out[out.length - 2], "END:VCALENDAR");
  });

  it("uses CRLF throughout", () => {
    const ics = buildCalendar({ name: "Fenced", events: [instant] }, STAMP);
    assert.equal(ics.split("\n").length - 1, ics.split("\r\n").length - 1);
    assert.ok(ics.endsWith("\r\n"));
  });

  it("writes instant events as UTC with an alarm", () => {
    const out = lines(buildCalendar({ name: "Fenced", events: [instant] }, STAMP));
    assert.ok(out.includes("DTSTART:20260908T140000Z"));
    assert.ok(out.includes("DTEND:20260908T153000Z"));
    assert.ok(out.includes("DTSTAMP:20260908T060000Z"));
    assert.ok(out.includes("TRIGGER:-PT10M"));
    assert.ok(out.includes("BEGIN:VALARM"));
    assert.ok(out.includes("END:VALARM"));
  });

  it("makes the all-day DTEND exclusive", () => {
    const out = lines(
      buildCalendar(
        {
          name: "Fenced",
          events: [
            {
              uid: "due-1@fenced.app",
              summary: "Essay due",
              timing: { kind: "allDay", start: "2026-09-08", end: "2026-09-08" },
            },
          ],
        },
        STAMP
      )
    );
    assert.ok(out.includes("DTSTART;VALUE=DATE:20260908"));
    assert.ok(out.includes("DTEND;VALUE=DATE:20260909"));
  });

  it("rolls the exclusive all-day end over month and year boundaries", () => {
    const out = lines(
      buildCalendar(
        {
          name: "Fenced",
          events: [
            {
              uid: "nye@fenced.app",
              summary: "Year end",
              timing: { kind: "allDay", start: "2026-12-31", end: "2026-12-31" },
            },
          ],
        },
        STAMP
      )
    );
    assert.ok(out.includes("DTEND;VALUE=DATE:20270101"));
  });

  it("writes recurring blocks as floating times with an RRULE", () => {
    const out = lines(
      buildCalendar(
        {
          name: "Fenced",
          events: [
            {
              uid: "fh-1@fenced.app",
              summary: "Study block",
              timing: {
                kind: "floating",
                start: "2026-09-07T14:00",
                end: "2026-09-07T15:00",
              },
              recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
            },
          ],
        },
        STAMP
      )
    );
    assert.ok(out.includes("DTSTART:20260907T140000"));
    assert.ok(out.includes("DTEND:20260907T150000"));
    assert.ok(out.includes("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"));
  });

  it("escapes and folds a long summary as one logical property", () => {
    const summary = "Revisar; ordenar, y planificar — " + "á".repeat(80);
    const ics = buildCalendar(
      {
        name: "Fenced",
        events: [
          {
            uid: "long@fenced.app",
            summary,
            timing: {
              kind: "instant",
              start: new Date("2026-09-08T14:00:00Z"),
              end: new Date("2026-09-08T15:00:00Z"),
            },
          },
        ],
      },
      STAMP
    );
    assert.ok(unfold(ics).includes("SUMMARY:" + escapeText(summary)));
  });

  it("publishes a refresh interval in both dialects", () => {
    const out = lines(
      buildCalendar({ name: "Fenced", refreshMinutes: 60, events: [] }, STAMP)
    );
    assert.ok(out.includes("REFRESH-INTERVAL;VALUE=DURATION:PT60M"));
    assert.ok(out.includes("X-PUBLISHED-TTL:PT60M"));
  });
});

describe("weeklyRule", () => {
  it("maps getDay() numbers to BYDAY codes in week order", () => {
    assert.equal(weeklyRule([1, 2, 3, 4, 5]), "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    assert.equal(weeklyRule([0, 6]), "FREQ=WEEKLY;BYDAY=SU,SA");
  });

  it("dedupes and drops out-of-range days", () => {
    assert.equal(weeklyRule([1, 1, 9, -2]), "FREQ=WEEKLY;BYDAY=MO");
  });

  it("returns null for an empty selection", () => {
    assert.equal(weeklyRule([]), null);
  });
});

describe("firstOccurrenceOnOrAfter", () => {
  it("returns the given day when it already matches", () => {
    // 2026-09-08 is a Tuesday.
    const found = firstOccurrenceOnOrAfter(new Date(2026, 8, 8), [2]);
    assert.equal(found?.getDate(), 8);
  });

  it("advances to the next matching weekday", () => {
    const found = firstOccurrenceOnOrAfter(new Date(2026, 8, 8), [5]);
    assert.equal(found?.getDay(), 5);
    assert.equal(found?.getDate(), 11);
  });

  it("returns null when no weekday is selected", () => {
    assert.equal(firstOccurrenceOnOrAfter(new Date(2026, 8, 8), []), null);
  });
});

describe("wallTimeWindow", () => {
  it("keeps both bounds on the same day for a normal window", () => {
    assert.deepEqual(wallTimeWindow("2026-09-08", "14:00", "15:30"), {
      start: "2026-09-08T14:00",
      end: "2026-09-08T15:30",
    });
  });

  it("rolls the end into the next day when the window crosses midnight", () => {
    assert.deepEqual(wallTimeWindow("2026-09-30", "22:00", "01:00"), {
      start: "2026-09-30T22:00",
      end: "2026-10-01T01:00",
    });
  });
});
