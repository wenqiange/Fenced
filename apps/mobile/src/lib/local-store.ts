import type { Priority } from "@fenced/core";
import { nextOccurrence } from "@fenced/nlp";
import type { FenceStyleId, ThemePreference } from "@fenced/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { localId } from "./ids";
import type { DistractionCategory, Intent } from "./onboarding-state";
import { INTENT_DEFAULTS } from "./onboarding-state";
import type { ActiveSession } from "./session-engine";
import { dateKey } from "./stats";
import { clearOutbox, enqueue } from "./sync/outbox";

export type { ActiveSession } from "./session-engine";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface LocalTask {
  id: string;
  remoteId: string | null;
  title: string;
  notes: string;
  completed: boolean;
  completedAt: string | null;
  priority: Priority;
  tags: string[];
  dueAt: string | null;
  estimateMinutes: number | null;
  rrule: string | null;
  /** Local task ids that must be completed before this one can be auto-scheduled. */
  blockedByTaskIds: string[];
  /** Local project id. */
  projectId: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalProject {
  id: string;
  remoteId: string | null;
  name: string;
  color: string | null;
  updatedAt: string;
}

/** A named set of apps/categories to block ("what the fence keeps out"). */
export interface LocalFence {
  id: string;
  remoteId: string | null;
  name: string;
  categoryTokens: string[];
  appTokens: string[];
  isDefault: boolean;
  updatedAt: string;
}

export interface SessionPreset {
  label: string;
  durationMinutes: number;
}

export interface FencedHourSchedule {
  id: string;
  remoteId: string | null;
  label: string;
  /** Local fence id; null = the default fence. */
  fenceId: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  strictDelayMinutes: number;
  enabled: boolean;
  /** Local YYYY-MM-DD dates skipped with "not today". */
  skippedDates: string[];
  updatedAt: string;
}

export interface SessionHistoryEntry {
  id: string;
  remoteId: string | null;
  startedAt: string;
  completedAt: string;
  /** Focus minutes actually done. */
  durationMinutes: number;
  plannedMinutes: number;
  strictDelayMinutes: number;
  shieldHits: number;
  presetLabel: string;
  practice: boolean;
  linkedTaskId: string | null;
  fenceId: string | null;
  status: "completed" | "abandoned";
  emergencyPassesUsed: number;
}

export type { FenceStyleId } from "@fenced/ui";
export type FocusSoundId = "white-noise" | "rain" | "hearth" | "waves" | "silence";

export interface UserSettings {
  theme: ThemePreference;
  focusSound: FocusSoundId;
  soundVolume: number;
  soundEffects: boolean;
  haptics: boolean;
  fenceStyle: FenceStyleId;
  emergencyPassesPerWeek: number;
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
  updatedAt: string;
}

/** Morning/evening ritual state for one local day. */
export interface DayPlan {
  date: string;
  keystoneTaskIds: string[];
  morningDoneAt: string | null;
  eveningDoneAt: string | null;
}

export interface LocalAppState {
  tasks: LocalTask[];
  projects: LocalProject[];
  fences: LocalFence[];
  calendarEvents: LocalCalendarEvent[];
  fencedHours: FencedHourSchedule[];
  sessionHistory: SessionHistoryEntry[];
  activeSession: ActiveSession | null;
  emergencyPassUses: string[];
  dayPlan: DayPlan | null;
  lastPreset: SessionPreset | null;
  settings: UserSettings;
}

// ─── State & persistence ────────────────────────────────────────────────────

const STORAGE_KEY = "fenced.app.v3";
const LEGACY_KEYS = ["fenced.app.v2", "fenced.app.v1"];
const HISTORY_CAP = 1000;
const PERSIST_DEBOUNCE_MS = 250;

const defaultSettings: UserSettings = {
  theme: "system",
  focusSound: "rain",
  soundVolume: 0.6,
  soundEffects: true,
  haptics: true,
  fenceStyle: "timber-pine",
  emergencyPassesPerWeek: 2,
  notifications: {
    sessionReminders: true,
    streakAlerts: true,
    scheduledHoursAlerts: true,
    dailySummary: false,
  },
};

const defaults: LocalAppState = {
  tasks: [],
  projects: [],
  fences: [],
  calendarEvents: [],
  fencedHours: [],
  sessionHistory: [],
  activeSession: null,
  emergencyPassUses: [],
  dayPlan: null,
  lastPreset: null,
  settings: defaultSettings,
};

let state: LocalAppState = { ...defaults };
let hydrated = false;
let hydrating: Promise<LocalAppState> | null = null;
const listeners = new Set<() => void>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function writeNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const snapshot = JSON.stringify(state);
  // Serialized: a slow older write can never land after a newer one.
  writeChain = writeChain
    .then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot))
    .catch(() => {
      /* the next mutation writes the full state again */
    });
  return writeChain;
}

/** Writes are coalesced; a burst of edits costs one serialization. */
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(writeNow, PERSIST_DEBOUNCE_MS);
}

/** Flush pending writes now — called when the app leaves the foreground. */
export function flushAppState(): Promise<void> {
  return persistTimer ? writeNow() : writeChain;
}

AppState.addEventListener("change", (s) => {
  if (s !== "active") void flushAppState();
});

function commit(next: LocalAppState) {
  state = next;
  schedulePersist();
  for (const l of listeners) l();
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

export function getAppState(): LocalAppState {
  return state;
}

const nowIso = () => new Date().toISOString();

// ─── Hydration & migration ──────────────────────────────────────────────────

type Raw<T> = Partial<T>;

function normalizeTask(raw: Raw<LocalTask> & { id: string; title: string }): LocalTask {
  const completed = raw.completed ?? false;
  return {
    id: raw.id,
    remoteId: raw.remoteId ?? null,
    title: raw.title,
    notes: raw.notes ?? "",
    completed,
    completedAt: raw.completedAt ?? (completed ? (raw.createdAt ?? nowIso()) : null),
    priority: raw.priority ?? "none",
    tags: raw.tags ?? [],
    dueAt: raw.dueAt ?? null,
    estimateMinutes: raw.estimateMinutes ?? null,
    rrule: raw.rrule ?? null,
    blockedByTaskIds: raw.blockedByTaskIds ?? [],
    projectId: raw.projectId ?? null,
    checklist: raw.checklist ?? [],
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? nowIso(),
  };
}

function normalizeCalendarEvent(
  raw: Raw<LocalCalendarEvent> & { id: string; title: string; startAt: string; endAt: string },
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
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? nowIso(),
  };
}

function normalizeHistory(raw: Raw<SessionHistoryEntry> & { id: string; completedAt: string }): SessionHistoryEntry {
  const duration = raw.durationMinutes ?? 0;
  return {
    id: raw.id,
    remoteId: raw.remoteId ?? null,
    startedAt:
      raw.startedAt ?? new Date(new Date(raw.completedAt).getTime() - duration * 60_000).toISOString(),
    completedAt: raw.completedAt,
    durationMinutes: duration,
    plannedMinutes: raw.plannedMinutes ?? duration,
    strictDelayMinutes: raw.strictDelayMinutes ?? 0,
    shieldHits: raw.shieldHits ?? 0,
    presetLabel: raw.presetLabel ?? "Focus",
    practice: raw.practice ?? false,
    linkedTaskId: raw.linkedTaskId ?? null,
    fenceId: raw.fenceId ?? null,
    status: raw.status ?? "completed",
    emergencyPassesUsed: raw.emergencyPassesUsed ?? 0,
  };
}

function normalizeFencedHour(raw: Raw<FencedHourSchedule> & { id: string }): FencedHourSchedule {
  return {
    id: raw.id,
    remoteId: raw.remoteId ?? null,
    label: raw.label ?? "Fenced hour",
    fenceId: raw.fenceId ?? null,
    daysOfWeek: raw.daysOfWeek ?? [1, 2, 3, 4, 5],
    startTime: raw.startTime ?? "14:00",
    endTime: raw.endTime ?? "15:00",
    strictDelayMinutes: raw.strictDelayMinutes ?? 0,
    enabled: raw.enabled ?? true,
    skippedDates: raw.skippedDates ?? [],
    updatedAt: raw.updatedAt ?? nowIso(),
  };
}

function migrate(parsed: Raw<LocalAppState>): LocalAppState {
  const settings = (parsed.settings ?? {}) as Partial<UserSettings>;
  return {
    ...defaults,
    tasks: (parsed.tasks ?? []).map((t) => normalizeTask(t as LocalTask)),
    projects: parsed.projects ?? [],
    fences: parsed.fences ?? [],
    calendarEvents: (parsed.calendarEvents ?? []).map((e) =>
      normalizeCalendarEvent(e as LocalCalendarEvent),
    ),
    fencedHours: (parsed.fencedHours ?? []).map((h) => normalizeFencedHour(h as FencedHourSchedule)),
    sessionHistory: (parsed.sessionHistory ?? []).map((s) =>
      normalizeHistory(s as SessionHistoryEntry),
    ),
    activeSession: parsed.activeSession ?? null,
    emergencyPassUses: parsed.emergencyPassUses ?? [],
    dayPlan: parsed.dayPlan ?? null,
    lastPreset: parsed.lastPreset ?? null,
    settings: {
      ...defaultSettings,
      ...settings,
      notifications: { ...defaultSettings.notifications, ...(settings.notifications ?? {}) },
    },
  };
}

export function hydrateAppState(): Promise<LocalAppState> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      let raw = await AsyncStorage.getItem(STORAGE_KEY);
      for (const key of LEGACY_KEYS) {
        if (raw) break;
        raw = await AsyncStorage.getItem(key);
      }
      if (raw) state = migrate(JSON.parse(raw));
    } catch {
      state = { ...defaults };
    }
    hydrated = true;
    for (const l of listeners) l();
    return state;
  })();
  return hydrating;
}

export async function resetAppState() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  state = { ...defaults };
  try {
    await writeChain;
    await AsyncStorage.multiRemove([STORAGE_KEY, ...LEGACY_KEYS, "fenced.onboarding.v1"]);
  } catch {
    /* best effort */
  }
  await clearOutbox();
  for (const l of listeners) l();
}

// ─── Settings ───────────────────────────────────────────────────────────────

export function updateUserSettings(patch: Partial<UserSettings>) {
  commit({
    ...state,
    settings: {
      ...state.settings,
      ...patch,
      notifications: { ...state.settings.notifications, ...(patch.notifications ?? {}) },
    },
  });
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export function getTaskById(id: string): LocalTask | undefined {
  return state.tasks.find((t) => t.id === id);
}

export type NewTask = Pick<LocalTask, "title" | "priority" | "tags" | "dueAt" | "estimateMinutes" | "rrule"> &
  Partial<Pick<LocalTask, "notes" | "blockedByTaskIds" | "projectId" | "checklist">>;

export function addTask(task: NewTask): LocalTask {
  const now = nowIso();
  const entry = normalizeTask({ ...task, id: localId("task"), createdAt: now, updatedAt: now });
  commit({ ...state, tasks: [entry, ...state.tasks] });
  enqueue("task", entry.id, "upsert", null);
  return entry;
}

export type TaskPatch = Partial<
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
    | "completedAt"
    | "projectId"
    | "checklist"
  >
>;

export function updateTask(id: string, patch: TaskPatch) {
  const task = getTaskById(id);
  if (!task) return;
  commit({
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)),
  });
  enqueue("task", id, "upsert", task.remoteId);
}

export function deleteTask(id: string) {
  const task = getTaskById(id);
  if (!task) return;
  const dependents = state.tasks.filter((t) => t.blockedByTaskIds.includes(id));
  commit({
    ...state,
    tasks: state.tasks
      .filter((t) => t.id !== id)
      .map((t) =>
        t.blockedByTaskIds.includes(id)
          ? { ...t, blockedByTaskIds: t.blockedByTaskIds.filter((b) => b !== id), updatedAt: nowIso() }
          : t,
      ),
    dayPlan: state.dayPlan && {
      ...state.dayPlan,
      keystoneTaskIds: state.dayPlan.keystoneTaskIds.filter((k) => k !== id),
    },
  });
  enqueue("task", id, "delete", task.remoteId);
  for (const d of dependents) enqueue("task", d.id, "upsert", d.remoteId);
}

/**
 * Completing a recurring task closes this occurrence and creates the next
 * one, so history keeps a record of every occurrence done.
 */
export function toggleTask(id: string): LocalTask | null {
  const task = getTaskById(id);
  if (!task) return null;
  const completing = !task.completed;
  updateTask(id, { completed: completing, completedAt: completing ? nowIso() : null });
  if (!completing || !task.rrule) return null;

  const anchor = task.dueAt ? new Date(task.dueAt) : new Date();
  const next = nextOccurrence(task.rrule, anchor, new Date());
  if (!next) return null;
  return addTask({
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    tags: task.tags,
    dueAt: next.toISOString(),
    estimateMinutes: task.estimateMinutes,
    rrule: task.rrule,
    projectId: task.projectId,
    checklist: task.checklist.map((c) => ({ ...c, done: false })),
  });
}

// ─── Projects ───────────────────────────────────────────────────────────────

export function addProject(name: string, color: string | null = null): LocalProject {
  const entry: LocalProject = { id: localId("proj"), remoteId: null, name, color, updatedAt: nowIso() };
  commit({ ...state, projects: [...state.projects, entry] });
  enqueue("project", entry.id, "upsert", null);
  return entry;
}

export function deleteProject(id: string) {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;
  const detached = state.tasks.filter((t) => t.projectId === id);
  commit({
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    tasks: state.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null, updatedAt: nowIso() } : t)),
  });
  enqueue("project", id, "delete", project.remoteId);
  for (const t of detached) enqueue("task", t.id, "upsert", t.remoteId);
}

// ─── Fences ─────────────────────────────────────────────────────────────────

export function getDefaultFence(): LocalFence | undefined {
  return state.fences.find((f) => f.isDefault) ?? state.fences[0];
}

export function addFence(input: Pick<LocalFence, "name" | "categoryTokens"> & Partial<LocalFence>): LocalFence {
  const entry: LocalFence = {
    id: localId("fence"),
    remoteId: null,
    appTokens: [],
    isDefault: state.fences.length === 0,
    ...input,
    updatedAt: nowIso(),
  };
  commit({ ...state, fences: [...state.fences, entry] });
  enqueue("fence", entry.id, "upsert", null);
  return entry;
}

export function updateFence(id: string, patch: Partial<Pick<LocalFence, "name" | "categoryTokens" | "appTokens">>) {
  const fence = state.fences.find((f) => f.id === id);
  if (!fence) return;
  commit({
    ...state,
    fences: state.fences.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: nowIso() } : f)),
  });
  enqueue("fence", id, "upsert", fence.remoteId);
}

/** Ensures a default fence exists, seeded from the onboarding categories. */
export function ensureDefaultFence(categories: DistractionCategory[]): LocalFence {
  return getDefaultFence() ?? addFence({ name: "Everyday fence", categoryTokens: categories, isDefault: true });
}

// ─── Calendar ───────────────────────────────────────────────────────────────

const byStart = (a: LocalCalendarEvent, b: LocalCalendarEvent) => a.startAt.localeCompare(b.startAt);

export type NewCalendarEvent = Pick<LocalCalendarEvent, "title" | "startAt" | "endAt" | "linkedTaskId"> &
  Partial<Pick<LocalCalendarEvent, "notes" | "allDay" | "source">>;

export function addCalendarEvents(events: NewCalendarEvent[]): LocalCalendarEvent[] {
  const now = nowIso();
  const created = events.map((e) =>
    normalizeCalendarEvent({ ...e, id: localId("evt"), createdAt: now, updatedAt: now }),
  );
  commit({ ...state, calendarEvents: [...state.calendarEvents, ...created].sort(byStart) });
  for (const e of created) if (e.source !== "google") enqueue("calendarEvent", e.id, "upsert", null);
  return created;
}

export function addCalendarEvent(event: NewCalendarEvent): LocalCalendarEvent {
  return addCalendarEvents([event])[0];
}

export function updateCalendarEvent(
  id: string,
  patch: Partial<Pick<LocalCalendarEvent, "title" | "notes" | "startAt" | "endAt" | "allDay" | "linkedTaskId">>,
) {
  const event = state.calendarEvents.find((e) => e.id === id);
  if (!event || event.source === "google") return;
  commit({
    ...state,
    calendarEvents: state.calendarEvents
      .map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso() } : e))
      .sort(byStart),
  });
  enqueue("calendarEvent", id, "upsert", event.remoteId);
}

export function deleteCalendarEvent(id: string) {
  const event = state.calendarEvents.find((e) => e.id === id);
  if (!event) return;
  commit({ ...state, calendarEvents: state.calendarEvents.filter((e) => e.id !== id) });
  // Provider mirrors are deleted through the API too: that is what records
  // the tombstone so the deletion propagates back to Google.
  enqueue("calendarEvent", id, "delete", event.remoteId);
}

export function getCalendarEventsForDay(day: Date): LocalCalendarEvent[] {
  const key = dateKey(day);
  return state.calendarEvents.filter((e) => dateKey(new Date(e.startAt)) === key);
}

// ─── Fenced hours ───────────────────────────────────────────────────────────

export function addFencedHour(
  schedule: Pick<FencedHourSchedule, "label" | "daysOfWeek" | "startTime" | "endTime"> &
    Partial<Pick<FencedHourSchedule, "enabled" | "fenceId" | "strictDelayMinutes">>,
): FencedHourSchedule {
  const entry = normalizeFencedHour({ ...schedule, id: localId("fh") });
  commit({ ...state, fencedHours: [...state.fencedHours, entry] });
  enqueue("fencedHour", entry.id, "upsert", null);
  return entry;
}

export function updateFencedHour(
  id: string,
  patch: Partial<Omit<FencedHourSchedule, "id" | "remoteId" | "updatedAt">>,
) {
  const hour = state.fencedHours.find((h) => h.id === id);
  if (!hour) return;
  commit({
    ...state,
    fencedHours: state.fencedHours.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: nowIso() } : h)),
  });
  enqueue("fencedHour", id, "upsert", hour.remoteId);
}

export function toggleFencedHour(id: string) {
  const hour = state.fencedHours.find((h) => h.id === id);
  if (hour) updateFencedHour(id, { enabled: !hour.enabled });
}

export function deleteFencedHour(id: string) {
  const hour = state.fencedHours.find((h) => h.id === id);
  if (!hour) return;
  commit({ ...state, fencedHours: state.fencedHours.filter((h) => h.id !== id) });
  enqueue("fencedHour", id, "delete", hour.remoteId);
}

export function skipFencedHourToday(id: string, key = dateKey(new Date())) {
  const hour = state.fencedHours.find((h) => h.id === id);
  if (!hour || hour.skippedDates.includes(key)) return;
  // Only recent skips matter; keep the list (and the payload) small.
  updateFencedHour(id, { skippedDates: [...hour.skippedDates, key].slice(-30) });
}

export function seedDefaultFencedHour(intent: Intent | null, categories: DistractionCategory[] = []) {
  if (!intent) return;
  ensureDefaultFence(categories);
  if (state.fencedHours.length > 0) return;
  const minutes = INTENT_DEFAULTS[intent].sessionMinutes;
  addFencedHour({
    label: `${INTENT_DEFAULTS[intent].label} block`,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "14:00",
    endTime: minutesToEnd("14:00", minutes),
  });
}

function minutesToEnd(start: string, durationMin: number): string {
  const total = parseHour(start) + durationMin;
  const eh = Math.floor(total / 60) % 24;
  return `${String(eh).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function getFencedHoursForToday(now = new Date()): FencedHourSchedule[] {
  const key = dateKey(now);
  return state.fencedHours.filter(
    (h) => h.enabled && h.daysOfWeek.includes(now.getDay()) && !h.skippedDates.includes(key),
  );
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export function setLastPreset(preset: SessionPreset) {
  commit({ ...state, lastPreset: preset });
}

export function setActiveSession(session: ActiveSession | null) {
  commit({ ...state, activeSession: session });
  // A running session is the one thing that must survive an immediate kill.
  void flushAppState();
}

export function recordEmergencyPassUse(at = nowIso()) {
  commit({ ...state, emergencyPassUses: [...state.emergencyPassUses, at].slice(-20) });
}

export function recordSession(entry: Omit<SessionHistoryEntry, "id" | "remoteId">): SessionHistoryEntry {
  const full: SessionHistoryEntry = { ...entry, id: localId("sess"), remoteId: null };
  commit({
    ...state,
    activeSession: null,
    sessionHistory: [full, ...state.sessionHistory].slice(0, HISTORY_CAP),
    lastPreset: { label: entry.presetLabel, durationMinutes: entry.plannedMinutes },
  });
  void flushAppState();
  // Practice sessions are a rehearsal and stay on the device.
  if (!entry.practice) enqueue("session", full.id, "upsert", null);
  return full;
}

// ─── Daily ritual ───────────────────────────────────────────────────────────

export function getDayPlan(now = new Date()): DayPlan {
  const key = dateKey(now);
  return state.dayPlan?.date === key
    ? state.dayPlan
    : { date: key, keystoneTaskIds: [], morningDoneAt: null, eveningDoneAt: null };
}

export function updateDayPlan(patch: Partial<Omit<DayPlan, "date">>, now = new Date()) {
  commit({ ...state, dayPlan: { ...getDayPlan(now), ...patch } });
}

// ─── Sync application (used by pull modules) ────────────────────────────────

export function applySyncedState(patch: Partial<Pick<LocalAppState, "tasks" | "projects" | "fences" | "calendarEvents" | "fencedHours" | "sessionHistory">>) {
  commit({
    ...state,
    ...patch,
    ...(patch.calendarEvents ? { calendarEvents: [...patch.calendarEvents].sort(byStart) } : {}),
  });
}

/** Records the server id after a create; never enqueues (that would loop). */
export function setRemoteId(
  collection: "tasks" | "projects" | "fences" | "calendarEvents" | "fencedHours" | "sessionHistory",
  id: string,
  remoteId: string,
) {
  const list = state[collection] as { id: string; remoteId: string | null }[];
  if (!list.some((r) => r.id === id && r.remoteId !== remoteId)) return;
  commit({ ...state, [collection]: list.map((r) => (r.id === id ? { ...r, remoteId } : r)) });
}

// ─── Derived helpers ────────────────────────────────────────────────────────

export type TaskSectionId = "overdue" | "today" | "tomorrow" | "this-week" | "later" | "no-date";

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
  x.setDate(x.getDate() + (7 - x.getDay()));
  x.setHours(23, 59, 59, 999);
  return x;
}

export function groupTasks(tasks: LocalTask[], now = new Date()): TaskSection[] {
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

  for (const task of tasks) {
    if (task.completed) continue;
    if (!task.dueAt) {
      buckets["no-date"].push(task);
      continue;
    }
    const due = new Date(task.dueAt);
    const dueDay = startOfDay(due).getTime();
    if (dueDay < today.getTime()) buckets.overdue.push(task);
    else if (dueDay === today.getTime()) buckets.today.push(task);
    else if (dueDay === tomorrow.getTime()) buckets.tomorrow.push(task);
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
  for (const section of groupTasks(tasks, now)) {
    if (section.tasks.length > 0) return section.tasks[0];
  }
  return null;
}

export function formatFocusHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function parseHour(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
