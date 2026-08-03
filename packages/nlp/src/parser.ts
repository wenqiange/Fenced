import type { Priority } from "@fenced/core";
import { applyTime, extractDate, extractTime } from "./datetime";
import { extractRecurrence } from "./recurrence";
import type { Ambiguity, ParsedRecurrence, ParsedTask } from "./types";

const TAG_RE = /#(\w+)/g;
const PRIORITY_RE = /!(none|low|medium|high|urgent)\b/i;
const ESTIMATE_RE = /\b(\d+)\s*h\s*(\d+)\s*m\b|\b(\d+)\s*h\b|\b(\d+)\s*m\b/i;

const TRAILING_PREPOSITION_RE = /\b(by|on|at|in|until|till|from|before|after|every|each|next)\s*$/i;

export function parseTaskInput(input: string, referenceDate?: Date): ParsedTask {
  const ref = referenceDate ?? new Date();
  let remaining = input;

  const tags: string[] = [];
  let tagMatch: RegExpExecArray | null;
  const tagRe = new RegExp(TAG_RE.source, TAG_RE.flags);
  while ((tagMatch = tagRe.exec(remaining)) !== null) {
    tags.push(tagMatch[1]);
  }
  remaining = remaining.replace(TAG_RE, "");

  let priority: Priority = "none";
  const prioMatch = PRIORITY_RE.exec(remaining);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as Priority;
    remaining = remaining.replace(prioMatch[0], "");
  }

  let estimateMinutes: number | null = null;
  const estMatch = ESTIMATE_RE.exec(remaining);
  if (estMatch) {
    if (estMatch[1] !== undefined && estMatch[2] !== undefined) {
      estimateMinutes = parseInt(estMatch[1], 10) * 60 + parseInt(estMatch[2], 10);
    } else if (estMatch[3] !== undefined) {
      estimateMinutes = parseInt(estMatch[3], 10) * 60;
    } else if (estMatch[4] !== undefined) {
      estimateMinutes = parseInt(estMatch[4], 10);
    }
    remaining = remaining.replace(estMatch[0], "");
  }

  const ambiguities: Ambiguity[] = [];

  // Recurrence runs before the date pass so "every monday" is not eaten as a due date.
  let recurrence: ParsedRecurrence | null = null;
  const recurrenceResult = extractRecurrence(remaining, ref);
  if (recurrenceResult) {
    recurrence = recurrenceResult.recurrence;
    for (const match of recurrenceResult.matches) {
      remaining = remaining.replace(match, " ");
    }
    if (recurrenceResult.monthOnlyUntil) {
      const until = recurrence.until!;
      ambiguities.push({
        kind: "recurrence-end",
        text: recurrenceResult.monthOnlyUntil.trim(),
        message: `"${recurrenceResult.monthOnlyUntil.trim()}" has no day. Repeating through ${formatDay(until)} — is that right?`,
      });
    }
  }

  let dueAt: Date | null = null;

  const timeResult = extractTime(remaining);
  if (timeResult) {
    remaining = remaining.replace(timeResult.match, "");
  }

  const dateResult = extractDate(remaining, ref);
  if (dateResult) {
    dueAt = dateResult.date;
    remaining = remaining.replace(dateResult.match, "");
  }

  if (timeResult) {
    dueAt = applyTime(dueAt ?? ref, timeResult.hours, timeResult.minutes);
    if (timeResult.meridiemAssumed) {
      const hour12 = timeResult.hours > 12 ? timeResult.hours - 12 : timeResult.hours;
      ambiguities.push({
        kind: "meridiem",
        text: timeResult.match.trim(),
        message: `"${timeResult.match.trim()}" could be morning or evening.`,
        options: [`${hour12}:00 AM`, `${hour12}:00 PM`],
      });
    }
  }

  const title = remaining.replace(/\s+/g, " ").trim();

  if (title.length === 0) {
    ambiguities.push({
      kind: "empty-title",
      text: input.trim(),
      message: "This looks like a date, not a task. What should the task be called?",
    });
  }

  const dangling = findDanglingTemporal(title, { hasDate: dueAt !== null, hasRecurrence: recurrence !== null });
  if (dangling) {
    ambiguities.push({
      kind: "dangling-temporal",
      text: dangling,
      message: `"${dangling}" looks like the start of a date, but nothing followed it.`,
    });
  }

  return {
    title: title || input.trim(),
    dueAt,
    estimateMinutes,
    priority,
    tags,
    rrule: recurrence?.rrule ?? null,
    recurrence,
    ambiguities,
    isAmbiguous: ambiguities.length > 0,
  };
}

/**
 * Flags leftovers that read like an unfinished date, without punishing ordinary
 * words — "check in with Ana" is a fine title, "call Ana on" is not.
 */
function findDanglingTemporal(
  title: string,
  parsed: { hasDate: boolean; hasRecurrence: boolean },
): string | null {
  const trailing = TRAILING_PREPOSITION_RE.exec(title);
  if (trailing) return trailing[1];

  if (!parsed.hasRecurrence) {
    const repeat = /\b(every|each)\b/i.exec(title);
    if (repeat) return repeat[1];
  }

  if (!parsed.hasDate) {
    const relative = /\b(next|last)\s+(\w+)/i.exec(title);
    if (relative) return relative[0];
  }

  return null;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
