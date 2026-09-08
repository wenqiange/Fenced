import type { Priority } from "@fenced/core";
import type { ThemePreference } from "@fenced/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Intent } from "./onboarding-state";
import { INTENT_DEFAULTS } from "./onboarding-state";

export interface LocalTask {
  id: string;
  remoteId: string | null;
  title: string;
  notes: string;
  completed: boolean;
  priority: Priority;
  tags: string[];
  dueAt: string | null;
  estimateMinutes: number | null;
  rrule: string | null;
  /** Local task ids that must be completed before this one can be auto-scheduled. */
  blockedByTaskIds: string[];
  createdAt: string;
}

export interface SessionPreset {
  label: string;
  durationMinutes: number;
}

export interface FencedHourSchedule {
  id: string;
  label: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  enabled: boolean;
  skippedDates: string[];
}

export interface SessionHistoryEntry {
  id: string;
  completedAt: string;
  durationMinutes: number;
  shieldHits: number;
  presetLabel: string;
  practice: boolean;
  linkedTaskId: string | null;
}

export interface UserSettings {
  theme: ThemePreference;
  focusSound: "white-noise" | "rain" | "hearth" | "waves" | "silence";
  notifications: {
    sessionReminders: boolean;
    streakAlerts: boolean;
    scheduledHoursAlerts: boolean;
    dailySummary: boolean;
  };
}

export interface LocalCalendarEvent {
  id: string;
  remoteId: string | null;
  title: string;
  notes: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  linkedTaskId: string | null;
  /** `google` rows came from a connected provider and are read-only here. */
  source: "local" | "time-block" | "google";
  createdAt: string;
}

export interface LocalAppState {
  tasks: LocalTask[];
  calendarEvents: LocalCalendarEvent[];
  fencedHours: FencedHourSchedule[];
  sessionHistory: SessionHistoryEntry[];
  focusMinutesThisWeek: number;
  shieldHitsThisWeek: number;
  streakDays: number;
  lastSessionDate: string | null;
  lastPreset: SessionPreset | null;
  sessionsCompleted: number;
  settings: UserSettings;
}

const STORAGE_KEY = "fenced.app.v2";

const defaultSettings: UserSettings = {
  theme: "system",
  focusSound: "white-noise",
  notifications: {
    sessionReminders: true,
    streakAlerts: true,
    scheduledHoursAlerts: true,
    dailySummary: false,
  },
};

const defaults: LocalAppState = {
  tasks: [],
  calendarEvents: [],
  fencedHours: [],
  sessionHistory: [],
  focusMinutesThisWeek: 0,
  shieldHitsThisWeek: 0,
  streakDays: 0,
  lastSessionDate: null,
  lastPreset: null,
  sessionsCompleted: 0,
  settings: defaultSettings,
};

let state: LocalAppState = { ...defaults };
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* best-effort */
  }
}

function normalizeTask(raw: Partial<LocalTask> & { title: string; id: string }): LocalTask {
  return {
    id: raw.id,
    remoteId: raw.remoteId ?? null,
    title: raw.title,
    notes: raw.notes ?? "",
    completed: raw.completed ?? false,
    priority: raw.priority ?? "none",
    tags: raw.tags ?? [],
    dueAt: raw.dueAt ?? null,
    estimateMinutes: raw.estimateMinutes ?? null,
    rrule: raw.rrule ?? null,
    blockedByTaskIds: raw.blockedByTaskIds ?? [],
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function normalizeCalendarEvent(
  raw: Partial<LocalCalendarEvent> & { title: string; id: string; startAt: string; endAt: string },
): LocalCalendarEvent {
  return {
    id: raw.id,
    remoteId: raw.remoteId ?? null,
    title: raw.title,
    notes: raw.notes ?? "",
    startAt: raw.startAt,
    endAt: raw.endAt,
    allDay: raw.allDay ?? false,
    linkedTaskId: raw.linkedTaskId ?? null,
    source: raw.source ?? "local",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export function subscribeAppState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAppStateHydrated() {
  return hydrated;
}

export function updateUserSettings(patch: Partial<UserSettings>) {
  state = {
    ...state,
    settings: {
      ...state.settings,
      ...patch,
      notifications: {
        ...state.settings.notifications,
        ...(patch.notifications ?? {}),
      },
    },
  };
  void persist();
  notify();
}

export async function resetAppState() {
  state = { ...defaults };
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem("fenced.app.v1");
    await AsyncStorage.removeItem("fenced.onboarding.v1");
  } catch {
    /* best effort */
  }
  notify();
}

export async function hydrateAppState(): Promise<LocalAppState> {
  try {
    const rawV2 = await AsyncStorage.getItem(STORAGE_KEY);
    const rawV1 = rawV2 ? null : await AsyncStorage.getItem("fenced.app.v1");
    const raw = rawV2 ?? rawV1;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalAppState>;
      state = {
        ...defaults,
        ...parsed,
        tasks: (parsed.tasks ?? []).map((t) =>
          normalizeTask(t as LocalTask)
        ),
        calendarEvents: (parsed.calendarEvents ?? []).map((e) =>
          normalizeCalendarEvent(e as LocalCalendarEvent)
        ),
        fencedHours: parsed.fencedHours ?? [],
        sessionHistory: parsed.sessionHistory ?? [],
      };
    }
  } catch {
    state = { ...defaults };
  }
  hydrated = true;
  notify();
  return state;
}

export function getAppState(): LocalAppState {
  return state;
}

export function getTaskById(id: string): LocalTask | undefined {
  return state.tasks.find((t) => t.id === id);
}

export function addTask(
  task: Omit<LocalTask, "id" | "createdAt" | "completed" | "remoteId" | "notes" | "blockedByTaskIds"> & {
    notes?: string;
    remoteId?: string | null;
    blockedByTaskIds?: string[];
  }
) {
  const entry = normalizeTask({
    ...task,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    remoteId: task.remoteId ?? null,
    notes: task.notes ?? "",
    completed: false,
    createdAt: new Date().toISOString(),
  });
  state = { ...state, tasks: [entry, ...state.tasks] };
  void persist();
  notify();
  return entry;
}

export function updateTask(
  id: string,
  patch: Partial<
    Pick<
      LocalTask,
      | "title"
      | "notes"
      | "priority"
      | "tags"
      | "dueAt"
      | "estimateMinutes"
      | "rrule"
      | "blockedByTaskIds"
      | "completed"
      | "remoteId"
    >
  >
) {
  state = {
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
  void persist();
  notify();
}

export function deleteTask(id: string) {
  state = {
    ...state,
    tasks: state.tasks
      .filter((t) => t.id !== id)
      .map((t) =>
        t.blockedByTaskIds.includes(id)
          ? { ...t, blockedByTaskIds: t.blockedByTaskIds.filter((b) => b !== id) }
          : t,
      ),
  };
  void persist();
  notify();
}

export function toggleTask(id: string) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  updateTask(id, { completed: !task.completed });
}

export function replaceTasksFromSync(tasks: LocalTask[]) {
  state = { ...state, tasks };
  void persist();
  notify();
}

export function setTaskRemoteId(localId: string, remoteId: string) {
  updateTask(localId, { remoteId });
}

/** Monotonic suffix so batched creates never collide on the same Date.now(). */
let localIdSeq = 0;
function createLocalId(prefix: string): string {
  localIdSeq += 1;
  return `${prefix}-${Date.now()}-${localIdSeq.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addCalendarEvent(
  event: Omit<LocalCalendarEvent, "id" | "createdAt" | "remoteId" | "notes" | "allDay" | "source"> & {
    notes?: string;
    allDay?: boolean;
    source?: LocalCalendarEvent["source"];
    remoteId?: string | null;
    id?: string;
  },
) {
  const entry = normalizeCalendarEvent({
    ...event,
    id: event.id ?? createLocalId("evt"),
    remoteId: event.remoteId ?? null,
    notes: event.notes ?? "",
    allDay: event.allDay ?? false,
    source: event.source ?? "local",
    createdAt: new Date().toISOString(),
  });
  state = {
    ...state,
    calendarEvents: [...state.calendarEvents, entry].sort(
      (a, b) => a.startAt.localeCompare(b.startAt),
    ),
  };
  void persist();
  notify();
  return entry;
}

export function addCalendarEvents(
  events: Parameters<typeof addCalendarEvent>[0][],
): LocalCalendarEvent[] {
  const created = events.map((event) =>
    normalizeCalendarEvent({
      ...event,
      id: event.id ?? createLocalId("evt"),
      remoteId: event.remoteId ?? null,
      notes: event.notes ?? "",
      allDay: event.allDay ?? false,
      source: event.source ?? "local",
      createdAt: new Date().toISOString(),
    }),
  );
  state = {
    ...state,
    calendarEvents: [...state.calendarEvents, ...created].sort(
      (a, b) => a.startAt.localeCompare(b.startAt),
    ),
  };
  void persist();
  notify();
  return created;
}

/**
 * Replaces the whole calendar after a pull.
 *
 * Kept sorted because every consumer renders in start order and re-sorting on
 * each render of a day view is wasted work.
 */
export function replaceCalendarEventsFromSync(events: LocalCalendarEvent[]) {
  state = {
    ...state,
    calendarEvents: [...events].sort((a, b) => a.startAt.localeCompare(b.startAt)),
  };
  void persist();
  notify();
}

export function setCalendarEventRemoteId(localId: string, remoteId: string) {
  state = {
    ...state,
    calendarEvents: state.calendarEvents.map((e) =>
      e.id === localId ? { ...e, remoteId } : e,
    ),
  };
  void persist();
  notify();
}

export function deleteCalendarEvent(id: string) {
  state = {
    ...state,
    calendarEvents: state.calendarEvents.filter((e) => e.id !== id),
  };
  void persist();
  notify();
}

export function getCalendarEventsForDay(day: Date): LocalCalendarEvent[] {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${d}`;
  return state.calendarEvents.filter((e) => {
    const start = new Date(e.startAt);
    const ey = start.getFullYear();
    const em = String(start.getMonth() + 1).padStart(2, "0");
    const ed = String(start.getDate()).padStart(2, "0");
    return `${ey}-${em}-${ed}` === key;
  });
}

export function setLastPreset(preset: SessionPreset) {
  state = { ...state, lastPreset: preset };
  void persist();
  notify();
}

export function addFencedHour(
  schedule: Omit<FencedHourSchedule, "id" | "skippedDates" | "enabled"> & {
    enabled?: boolean;
  }
) {
  const entry: FencedHourSchedule = {
    ...schedule,
    id: `fh-${Date.now()}`,
    enabled: schedule.enabled ?? true,
    skippedDates: [],
  };
  state = { ...state, fencedHours: [...state.fencedHours, entry] };
  void persist();
  notify();
  return entry;
}

export function toggleFencedHour(id: string) {
  state = {
    ...state,
    fencedHours: state.fencedHours.map((h) =>
      h.id === id ? { ...h, enabled: !h.enabled } : h
    ),
  };
  void persist();
  notify();
}

export function skipFencedHourToday(id: string, dateKey = todayKey()) {
  state = {
    ...state,
    fencedHours: state.fencedHours.map((h) => {
      if (h.id !== id) return h;
      if (h.skippedDates.includes(dateKey)) return h;
      return { ...h, skippedDates: [...h.skippedDates, dateKey] };
    }),
  };
  void persist();
  notify();
}

export function seedDefaultFencedHour(intent: Intent | null) {
  if (!intent || state.fencedHours.length > 0) return;
  const minutes = INTENT_DEFAULTS[intent].sessionMinutes;
  addFencedHour({
    label: `${INTENT_DEFAULTS[intent].label} block`,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "14:00",
    endTime: minutesToEnd("14:00", minutes),
  });
}

function minutesToEnd(start: string, durationMin: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + durationMin;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${eh.toString().padStart(2, "0")}:${em.toString().padStart(2, "0")}`;
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function getFencedHoursForToday(now = new Date()): FencedHourSchedule[] {
  const day = now.getDay();
  const key = todayKey(now);
  return state.fencedHours.filter(
    (h) =>
      h.enabled &&
      h.daysOfWeek.includes(day) &&
      !h.skippedDates.includes(key)
  );
}

export function recordSessionComplete(options: {
  durationMinutes: number;
  shieldHits: number;
  preset: SessionPreset;
  practice?: boolean;
  linkedTaskId?: string | null;
}) {
  const today = todayKey();
  let streakDays = state.streakDays;
  if (state.lastSessionDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = todayKey(yesterday);
    streakDays =
      state.lastSessionDate === yKey ? state.streakDays + 1 : 1;
  }

  const historyEntry: SessionHistoryEntry = {
    id: `sess-${Date.now()}`,
    completedAt: new Date().toISOString(),
    durationMinutes: options.durationMinutes,
    shieldHits: options.shieldHits,
    presetLabel: options.preset.label,
    practice: options.practice ?? false,
    linkedTaskId: options.linkedTaskId ?? null,
  };

  state = {
    ...state,
    focusMinutesThisWeek: state.focusMinutesThisWeek + options.durationMinutes,
    shieldHitsThisWeek: state.shieldHitsThisWeek + options.shieldHits,
    streakDays,
    lastSessionDate: today,
    lastPreset: options.preset,
    sessionsCompleted: state.sessionsCompleted + 1,
    sessionHistory: [historyEntry, ...state.sessionHistory].slice(0, 50),
  };
  void persist();
  notify();
}

export type TaskSectionId =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "later"
  | "no-date";

export interface TaskSection {
  id: TaskSectionId;
  title: string;
  tasks: LocalTask[];
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = 7 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function groupTasks(tasks: LocalTask[], now = new Date()): TaskSection[] {
  const active = tasks.filter((t) => !t.completed);
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = endOfWeek(now);

  const buckets: Record<TaskSectionId, LocalTask[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    "this-week": [],
    later: [],
    "no-date": [],
  };

  for (const task of active) {
    if (!task.dueAt) {
      buckets["no-date"].push(task);
      continue;
    }
    const due = new Date(task.dueAt);
    const dueDay = startOfDay(due);
    if (dueDay < today) buckets.overdue.push(task);
    else if (dueDay.getTime() === today.getTime()) buckets.today.push(task);
    else if (dueDay.getTime() === tomorrow.getTime()) buckets.tomorrow.push(task);
    else if (due <= weekEnd) buckets["this-week"].push(task);
    else buckets.later.push(task);
  }

  const order: { id: TaskSectionId; title: string }[] = [
    { id: "overdue", title: "Overdue" },
    { id: "today", title: "Today" },
    { id: "tomorrow", title: "Tomorrow" },
    { id: "this-week", title: "This week" },
    { id: "later", title: "Later" },
    { id: "no-date", title: "No date" },
  ];

  return order
    .map(({ id, title }) => ({ id, title, tasks: buckets[id] }))
    .filter((s) => s.tasks.length > 0);
}

export function pickNextUpTask(tasks: LocalTask[], now = new Date()): LocalTask | null {
  const sections = groupTasks(tasks, now);
  for (const section of sections) {
    if (section.tasks.length > 0) return section.tasks[0];
  }
  return null;
}

export function formatFocusHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function parseHour(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
