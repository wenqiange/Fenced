import { relations, sql } from "drizzle-orm";
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
/** Providers we can hold an OAuth link for — narrower than `calendar_source`. */
export const calendarProviderEnum = pgEnum("calendar_provider", ["google"]);
export const syncDirectionEnum = pgEnum("calendar_sync_direction", [
  /** Provider → Fenced only. */
  "pull",
  /** Fenced → provider only. */
  "push",
  "both",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("clerk_id") /* legacy column name: now stores the Supabase user id */.unique().notNull(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  ageBand: ageBandEnum("age_band").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  assuranceMethod: assuranceMethodEnum("assurance_method").notNull(),
  assuranceAt: timestamp("assurance_at", { withTimezone: true }),
  childrensCodeApplies: boolean("childrens_code_applies").notNull().default(false),
  timezone: text("timezone").notNull().default("UTC"),
  /**
   * Onboarding answers — synced across devices. Birth month/year are never
   * stored: the device derives `ageBand` and discards them (docs/06).
   */
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
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    parentTaskId: uuid("parent_task_id").references((): any => tasks.id, { onDelete: "cascade" }),
    occurrenceIndex: integer("occurrence_index").notNull().default(0),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: priorityEnum("priority").notNull().default("none"),
    tags: jsonb("tags").notNull().$type<string[]>().default([]),
    dueAt: timestamp("due_at", { withTimezone: true }),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes"),
    rrule: text("rrule"),
    /** Lightweight checklist; full subtasks use `parentTaskId`. */
    checklist: jsonb("checklist")
      .$type<{ id: string; title: string; done: boolean }[]>()
      .notNull()
      .default([]),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_tasks_user_completed").on(table.userId, table.completedAt),
    index("idx_tasks_user_project").on(table.userId, table.projectId),
    index("idx_tasks_user_updated").on(table.userId, table.updatedAt),
    index("idx_tasks_user_due_open").on(table.userId, table.dueAt, table.completedAt),
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
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fenceId: uuid("fence_id").notNull().references(() => fences.id, { onDelete: "cascade" }),
    status: sessionStatusEnum("status").notNull().default("armed"),
    presetName: text("preset_name"),
    durationMinutes: integer("duration_minutes").notNull(),
    strictDelayMinutes: integer("strict_delay_minutes").notNull().default(0),
    shieldHits: integer("shield_hits").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sessions_user_status").on(table.userId, table.status),
    index("idx_sessions_user_created").on(table.userId, table.createdAt),
    index("idx_sessions_user_fence").on(table.userId, table.fenceId),
    index("idx_sessions_user_status_completed").on(table.userId, table.status, table.completedAt),
  ]
);

export const fencedHours = pgTable(
  "fenced_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    fenceId: uuid("fence_id").notNull().references(() => fences.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Fenced hour"),
    daysOfWeek: jsonb("days_of_week").notNull().$type<number[]>(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    strictDelayMinutes: integer("strict_delay_minutes").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    /** Local YYYY-MM-DD dates the user skipped ("not today"). */
    skippedDates: jsonb("skipped_dates").notNull().$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_fenced_hours_user").on(table.userId)]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    rrule: text("rrule"),
    reminders: jsonb("reminders").notNull().$type<number[]>().default([]),
    linkedSessionId: uuid("linked_session_id").references(() => sessions.id, { onDelete: "set null" }),
    linkedTaskId: uuid("linked_task_id").references(() => tasks.id, { onDelete: "set null" }),
    source: calendarSourceEnum("source").notNull().default("local"),
    externalId: text("external_id"),
    /** Connection this row came from (or was pushed through); null = Fenced-only. */
    connectionId: uuid("connection_id").references(() => calendarConnections.id, {
      onDelete: "set null",
    }),
    /** Provider ETag, so a pull can skip rows the provider has not changed. */
    externalEtag: text("external_etag"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_user").on(table.userId),
    index("idx_calendar_events_start").on(table.userId, table.startAt),
    index("idx_calendar_events_user_start_end").on(table.userId, table.startAt, table.endAt),
    // Makes the pull an idempotent upsert: replaying a page of provider events
    // updates rows instead of duplicating them.
    uniqueIndex("uq_calendar_events_external")
      .on(table.connectionId, table.externalId)
      .where(sql`${table.externalId} is not null`),
  ]
);

/**
 * An authorised link to an external calendar provider.
 *
 * Tokens are stored encrypted (AES-256-GCM, see `integrations/token-crypto.ts`)
 * and must never leave the server: every tRPC procedure that returns a
 * connection projects an explicit column list that omits them.
 */
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProviderEnum("provider").notNull(),
    /** The provider account this link belongs to, shown in settings. */
    accountEmail: text("account_email"),
    /** Provider calendar id; `primary` is the account's default calendar. */
    externalCalendarId: text("external_calendar_id").notNull().default("primary"),
    externalCalendarName: text("external_calendar_name"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    /**
     * Provider cursor for incremental pulls. Cleared when the provider reports
     * it has expired (Google answers 410), which forces one full resync.
     */
    syncToken: text("sync_token"),
    syncDirection: syncDirectionEnum("sync_direction").notNull().default("both"),
    syncEnabled: boolean("sync_enabled").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leasedBy: text("leased_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_calendar_connections_user").on(table.userId),
    // Reconnecting the same provider calendar updates the link in place rather
    // than accumulating duplicates that would each sync the same events.
    uniqueIndex("uq_calendar_connection").on(
      table.userId,
      table.provider,
      table.externalCalendarId
    ),
  ]
);

/**
 * Records that a synced event was deleted locally, so the next push can delete
 * it at the provider too.
 *
 * Without this, a local delete removes the only row that knew the provider id
 * and the event would linger in Google forever.
 */
export const calendarSyncTombstones = pgTable(
  "calendar_sync_tombstones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => calendarConnections.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_calendar_tombstone").on(table.connectionId, table.externalId),
    index("idx_calendar_tombstones_user").on(table.userId),
  ]
);

/**
 * A subscribable read-only ICS feed.
 *
 * `token` is the only credential, so it is a capability URL: treat it as a
 * secret, never log it, and rotate to revoke.
 */
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    tokenEnc: text("token_enc"),
    includeEvents: boolean("include_events").notNull().default(true),
    includeFencedHours: boolean("include_fenced_hours").notNull().default(true),
    includeTaskDueDates: boolean("include_task_due_dates").notNull().default(false),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_calendar_feed_token_hash").on(table.tokenHash),
    uniqueIndex("uq_calendar_feed_user").on(table.userId),
  ]
);

export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    guardianEmail: text("guardian_email").notNull(),
    method: text("method").notNull(),
    scope: text("scope").notNull(),
    noticeVersion: text("notice_version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    vendorRef: text("vendor_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_consent_events_user").on(table.userId),
    index("idx_consent_events_user_created").on(table.userId, table.createdAt),
    uniqueIndex("uq_consent_events_vendor_ref").on(table.vendorRef),
  ]
);

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
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
  calendarConnections: many(calendarConnections),
  calendarFeed: one(calendarFeeds, {
    fields: [users.id],
    references: [calendarFeeds.userId],
  }),
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
  connection: one(calendarConnections, {
    fields: [calendarEvents.connectionId],
    references: [calendarConnections.id],
  }),
}));

export const calendarConnectionsRelations = relations(
  calendarConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [calendarConnections.userId],
      references: [users.id],
    }),
    events: many(calendarEvents),
    tombstones: many(calendarSyncTombstones),
  })
);

export const calendarSyncTombstonesRelations = relations(
  calendarSyncTombstones,
  ({ one }) => ({
    user: one(users, {
      fields: [calendarSyncTombstones.userId],
      references: [users.id],
    }),
    connection: one(calendarConnections, {
      fields: [calendarSyncTombstones.connectionId],
      references: [calendarConnections.id],
    }),
  })
);

export const calendarFeedsRelations = relations(calendarFeeds, ({ one }) => ({
  user: one(users, {
    fields: [calendarFeeds.userId],
    references: [users.id],
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
