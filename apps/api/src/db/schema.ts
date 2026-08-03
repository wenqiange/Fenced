import { relations } from "drizzle-orm";
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
  uniqueIndex,
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
  /** Onboarding answers — synced across devices */
  birthMonth: integer("birth_month"),
  birthYear: integer("birth_year"),
  intent: text("intent"),
  distractionCategories: jsonb("distraction_categories")
    .$type<string[]>()
    .notNull()
    .default([]),
  practiceMode: boolean("practice_mode").notNull().default(false),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  needsGuardianConsent: boolean("needs_guardian_consent").notNull().default(false),
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

/** "taskId cannot start until dependsOnTaskId is done" — distinct from parentTaskId subtasks. */
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_task_dependency").on(table.taskId, table.dependsOnTaskId),
    index("idx_task_deps_task").on(table.taskId),
    index("idx_task_deps_blocker").on(table.dependsOnTaskId),
    index("idx_task_deps_user").on(table.userId),
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

// Drizzle Relational Queries Schema definitions
export const usersRelations = relations(users, ({ many, one }) => ({
  fences: many(fences),
  projects: many(projects),
  tasks: many(tasks),
  sessions: many(sessions),
  fencedHours: many(fencedHours),
  calendarEvents: many(calendarEvents),
  consentEvents: many(consentEvents),
  streak: one(streaks, {
    fields: [users.id],
    references: [streaks.userId],
  }),
}));

export const fencesRelations = relations(fences, ({ one, many }) => ({
  user: one(users, {
    fields: [fences.userId],
    references: [users.id],
  }),
  sessions: many(sessions),
  fencedHours: many(fencedHours),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  fence: one(fences, {
    fields: [sessions.fenceId],
    references: [fences.id],
  }),
  linkedTask: one(tasks, {
    fields: [sessions.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const fencedHoursRelations = relations(fencedHours, ({ one }) => ({
  user: one(users, {
    fields: [fencedHours.userId],
    references: [users.id],
  }),
  fence: one(fences, {
    fields: [fencedHours.fenceId],
    references: [fences.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  linkedSession: one(sessions, {
    fields: [calendarEvents.linkedSessionId],
    references: [sessions.id],
  }),
  linkedTask: one(tasks, {
    fields: [calendarEvents.linkedTaskId],
    references: [tasks.id],
  }),
}));

export const consentEventsRelations = relations(consentEvents, ({ one }) => ({
  user: one(users, {
    fields: [consentEvents.userId],
    references: [users.id],
  }),
}));

export const streaksRelations = relations(streaks, ({ one }) => ({
  user: one(users, {
    fields: [streaks.userId],
    references: [users.id],
  }),
}));
