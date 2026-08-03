import type { Priority } from "@fenced/core";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ParsedRecurrence {
  /** RFC 5545 RRULE value, without the `RRULE:` prefix. */
  rrule: string;
  freq: RecurrenceFreq;
  interval: number;
  /** Two-letter weekday codes: MO, TU, WE, TH, FR, SA, SU. */
  byDay: string[];
  /** Days of the month. -1 means the last day. */
  byMonthDay: number[];
  until: Date | null;
  count: number | null;
}

export type AmbiguityKind =
  /** Nothing was left over to use as a title. */
  | "empty-title"
  /** A temporal preposition survived parsing, so a date or time was probably missed. */
  | "dangling-temporal"
  /** A bare hour with no am/pm, e.g. "at 9". */
  | "meridiem"
  /** A recurrence end that resolved to a whole month, e.g. "until June". */
  | "recurrence-end";

export interface Ambiguity {
  kind: AmbiguityKind;
  /** The source text that caused it. */
  text: string;
  /** Plain-language question to put to the user. */
  message: string;
  /** Concrete choices to offer, when there is a closed set. */
  options?: string[];
}

export interface ParsedTask {
  title: string;
  dueAt: Date | null;
  estimateMinutes: number | null;
  priority: Priority;
  tags: string[];
  /** Convenience mirror of `recurrence.rrule`. */
  rrule: string | null;
  recurrence: ParsedRecurrence | null;
  ambiguities: Ambiguity[];
  isAmbiguous: boolean;
}
