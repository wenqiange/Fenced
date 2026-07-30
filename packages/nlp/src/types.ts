import type { Priority } from "@fenced/core";

export interface ParsedTask {
  title: string;
  dueAt: Date | null;
  estimateMinutes: number | null;
  priority: Priority;
  tags: string[];
  rrule: string | null;
  isAmbiguous: boolean;
}
