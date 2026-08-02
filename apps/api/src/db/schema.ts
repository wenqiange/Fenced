import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const ageBandEnum = pgEnum("age_band", ["child", "teen", "adult"]);
export const assuranceMethodEnum = pgEnum("assurance_method", [
  "declared-age-range-guardian",
  "declared-age-range-self",
  "neutral-screen",
]);
export const sessionStatusEnum = pgEnum("session_status", [
  "armed",
  "active",
  "completed",
  "abandoned",
]);
export const priorityEnum = pgEnum("priority", [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
]);
export const calendarSourceEnum = pgEnum("calendar_source", [
  "local",
  "google",
  "outlook",
  "apple",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").unique().notNull(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  ageBand: ageBandEnum("age_band").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  assuranceMethod: assuranceMethodEnum("assurance_method").notNull(),
  assuranceAt: timestamp("assurance_at", { withTimezone: true }),
  childrensCodeApplies: boolean("childrens_code_applies").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fences = pgTable(
  "fences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    appTokens: jsonb("app_tokens").notNull().$type<string[]>(),
    categoryTokens: jsonb("category_tokens").notNull().$type<string[]>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_fences_user").on(table.userId)]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    color: text("color"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_projects_user").on(table.userId)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    projectId: uuid("project_id").references(() => projects.id),
    parentTaskId: uuid("parent_task_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: priorityEnum("priority").notNull().default("none"),
    tags: jsonb("tags").notNull().$type<string[]>().default([]),
    dueAt: timestamp("due_at", { withTimezone: true }),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes"),
    rrule: text("rrule"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tasks_user_completed").on(table.userId, table.completedAt),
    index("idx_tasks_user_project").on(table.userId, table.projectId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    fenceId: uuid("fence_id").notNull().references(() => fences.id),
    status: sessionStatusEnum("status").notNull().default("armed"),
    presetName: text("preset_name"),
    durationMinutes: integer("duration_minutes").notNull(),
    strictDelayMinutes: integer("strict_delay_minutes").notNull().default(0),
    shieldHits: integer("shield_hits").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_user_status").on(table.userId, table.status),
    index("idx_sessions_user_created").on(table.userId, table.createdAt),
  ]
);

export const fencedHours = pgTable(
  "fenced_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    fenceId: uuid("fence_id").notNull().references(() => fences.id),
    daysOfWeek: jsonb("days_of_week").notNull().$type<number[]>(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    strictDelayMinutes: integer("strict_delay_minutes").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_fenced_hours_user").on(table.userId)]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    notes: text("notes"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    rrule: text("rrule"),
    reminders: jsonb("reminders").notNull().$type<number[]>().default([]),
    linkedSessionId: uuid("linked_session_id").references(() => sessions.id),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id),
    source: calendarSourceEnum("source").notNull().default("local"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_user").on(table.userId),
    index("idx_calendar_events_start").on(table.userId, table.startAt),
  ]
);

export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    guardianEmail: text("guardian_email").notNull(),
    method: text("method").notNull(),
    scope: text("scope").notNull(),
    noticeVersion: text("notice_version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_consent_events_user").on(table.userId)]
);

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastSessionDate: text("last_session_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
