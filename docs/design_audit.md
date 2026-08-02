# Fenced — Exhaustive Design Audit

> **Audit scope**: All six design documents (README, 01–06), the current codebase (`packages/core`, `packages/policy`, `packages/nlp`, `apps/api`, `apps/mobile`, `native/fenced-blocking`), and the implications of building this for real.
>
> **Mindset**: This is the meeting where uncomfortable truths save you hundreds of thousands of dollars. Nothing here is personal — it is all about shipping a defensible product.

---

## 1. Product

### 1.1 The "three products in one" thesis

The central bet — blocking + tasks + calendar in a single app — is sound in positioning but treacherous in execution. You are competing against:

- **Forest / Opal / one sec**: single-purpose, polished, years of platform-specific hardening.
- **Todoist / Things / TickTick**: mature task managers with deep integrations, import/export, and collaboration.
- **Fantastical / Google Calendar**: calendar incumbents with sync that *works*.

The risk is not that the idea is bad. It is that you ship three mediocre products and lose to each single-purpose competitor on their turf. The docs are aware of this ("a task list too weak to hold a user's real work means they keep Todoist open") but the mitigation is mostly aspirational. The actual implementation (see Section 7: API / Data Model) is a task system with no search, no bulk operations, no attachments, no rich text, and a calendar with no timezone handling at the schema level. That is a gap between documentation ambition and code reality.

> [!WARNING]
> **Verdict**: The concept is viable, but the "genuinely complete task manager" promise in the docs has almost no corresponding completeness in the implementation. Plan for at least 3–4 more months of task/calendar feature work beyond what is currently built.

### 1.2 Student target market versus revenue timeline

Students are price-sensitive and seasonal. Conversion peaks around exam periods and drops to near zero during summer. You have no monetization in the MVP, which means you are burning runway while building for an audience that historically converts at 2–4% for productivity subscriptions. The docs defer all revenue to "later" across 12 pages of specification without once modeling the runway implications.

> [!IMPORTANT]
> You need a financial model before Phase 3 completes. When does the MVP ship? How long until paid tiers? What is the monthly burn rate? The docs are silent on all of this, and "later" is not a plan for monetization — it is an assumption that you will still exist when "later" arrives.

### 1.3 Missing user personas and jobs-to-be-done

The docs define a target user as "students, freelancers, and knowledge workers" but never break these into concrete personas with distinct needs. A 14-year-old GCSE student, a 22-year-old freelance designer, and a 35-year-old senior engineer all fit the description and have radically different:

- Daily app-blocking needs (TikTok vs. Slack vs. nothing)
- Task complexity (homework list vs. client deliverables with subtasks)
- Calendar maturity (nothing vs. three synced calendars with 30+ events/week)
- Willingness to grant permissions
- Privacy sensitivity

The onboarding has three intent options. That is not enough segmentation to configure a meaningfully different experience.

### 1.4 Competitive moat

The docs claim the *combination* of three products is the differentiator. That is a bundling play, not a moat. TickTick already combines tasks + calendar + pomodoro (without blocking). Forest already has streaks and gamification with years of polish. The fence metaphor is genuinely novel, but a visual metaphor is a marketing asset, not a technical barrier to entry.

**The real moat would be**:
1. The compliance-first architecture for under-16s (genuinely hard to replicate after the fact)
2. Cross-device session continuity (phone blocks + browser extension blocks from one trigger)
3. Shield-hit analytics as a unique data asset

The docs don't position these as moats — they should.

---

## 2. Technical Architecture

### 2.1 Monorepo design — mostly sound

The Turborepo + pnpm layout is appropriate. The decision to share zod schemas via `packages/core` between API and client is the single most valuable architectural choice in the project. The separation of `packages/policy` for age-band and feature-access logic is excellent.

**Problems:**

- **No `targets/` directory exists.** The docs describe iOS app extension targets at `targets/device-activity-monitor/`, `targets/shield-configuration/`, `targets/shield-action/`. These directories are completely absent from the codebase. This is not "to be built later" — the docs specifically state Phase 1 should prove these work before anything else, and Phase 1 has not been done.

- **The `native/fenced-blocking/` module is a pure stub.** Every method returns hardcoded values. `requestAuthorization()` returns `"unavailable"`. `applyShield()` returns `{ applied: false, practice: true }`. There is no Swift code, no Kotlin code, no Expo module config (`expo-module.config.json`), and no `ios/` or `android/` directories. The core differentiator of the product — blocking — does not exist in the codebase at any level.

> [!CAUTION]
> **This is the biggest risk in the project.** The build-order doc says "Phase 1 contains all the unknowns — protect it." Phase 1 has not been started. Everything currently built is Phase 3 product code sitting on top of a blocking layer that literally does nothing. If the Family Controls entitlement is denied, or the native bridge proves infeasible within Expo's CNG constraints, the entire product concept fails. You have built the house before testing the foundation.

### 2.2 The Expo CNG + native extensions tension

The docs correctly identify this: "this is not the Expo managed workflow." But the codebase shows no evidence of having confronted it. Specifically:

1. No `app.json` or `app.config.ts` references to `@bacons/apple-targets` — the plugin that generates iOS extension targets.
2. No evidence that `expo prebuild --clean` has ever been run successfully with extension targets.
3. No `ios/` or `android/` directories (expected — CNG generates them), but also no configuration that would generate them correctly.
4. The `app.json` has a basic Expo config with no `appleTeamId`, no `entitlements`, no Family Controls capability, and no App Group.

```json
// What app.json should contain but doesn't:
{
  "expo": {
    "ios": {
      "appleTeamId": "YOUR_TEAM_ID",
      "entitlements": {
        "com.apple.developer.family-controls": true,
        "com.apple.developer.declared-age-range": true,
        "com.apple.security.application-groups": ["group.com.fenced.app"]
      }
    }
  }
}
```

### 2.3 Backend architecture

Hono + tRPC on Vercel Functions is a reasonable choice for the current scale. However:

- **No rate limiting exists.** The docs mention Upstash Redis for rate limiting — there is no Redis integration in the codebase. Every endpoint is unlimited.
- **No idempotency keys.** The docs emphasize "a persisted mutation queue that replays on reconnect with idempotency keys so retries cannot double-create." The task and session creation endpoints have no idempotency handling. A retry creates a duplicate.
- **No versioning.** No API version prefix, no migration strategy. When the schema changes, all clients break simultaneously.
- **No pagination cursors.** The list endpoints use offset-based pagination, which is O(n) for deep pages and produces inconsistent results when items are inserted during pagination. Cursor-based pagination is standard for mobile apps.

### 2.4 Missing infrastructure

The docs specify these as MVP but none exist in the codebase:

| Component | Status |
|---|---|
| Redis (Upstash) for rate limiting and locks | **Not implemented** |
| Durable jobs (Vercel Workflow / Inngest) | **Not implemented** |
| Streak rollover job (per-user timezone midnight) | **Not implemented** — streak logic runs synchronously in session.complete |
| Retention enforcement job | **Not implemented** |
| Deletion cascade with completion window | Partially implemented (synchronous, no stated window) |
| Export as machine-readable bundle | Implemented as a query returning JSON — no downloadable file, no format spec |
| PostHog analytics (adults only) | **Not implemented** |
| Sentry crash reporting | **Not implemented** |
| Custom onboarding funnel instrumentation | **Not implemented** |

---

## 3. Mobile Engineering

### 3.1 The blocking layer gap (the critical finding)

This is worth repeating because it is the single item most likely to kill the project:

**There is no native blocking code.** Not in Swift. Not in Kotlin. Not as an Expo module. The `FencedBlocking` class in `native/fenced-blocking/src/index.ts` is a TypeScript mock that simulates authorization and shield application without touching any platform API. The session UI references it, but every session runs in "practice mode" regardless of platform.

The docs state: "Phase 1 is the one to protect. Every other phase is conventional application work with predictable risk; Phase 1 contains all the unknowns." **Phase 1 has not been started.**

To be clear about what "Phase 1" requires:

**iOS:**
- Register four bundle IDs with Apple and request Family Controls distribution entitlement
- Configure `@bacons/apple-targets` to generate `DeviceActivityMonitor`, `ShieldConfiguration`, and `ShieldAction` extensions
- Write Swift code for `AuthorizationCenter.requestAuthorization(for: .individual)`
- Write Swift code for `FamilyActivityPicker` presentation
- Write Swift code for `ManagedSettingsStore` shield application
- Write Swift code for `DeviceActivitySchedule` for Fenced Hours
- Write Swift code for `ShieldAction` extension to log shield hits to App Group
- Configure a shared App Group container for data exchange between main app and extensions
- Bridge all of the above to React Native via an Expo module

**Android:**
- Write Kotlin for `FenceMonitorService` foreground service with `specialUse` type
- Write Kotlin for `UsageStatsManager` polling loop (every ~800ms)
- Write Kotlin for `FenceOverlayActivity` full-screen overlay
- Handle `START_STICKY` service restart and session state recovery
- Handle OEM battery-optimization detection and guidance
- Write a custom app picker using launcher-intent filtering
- Bridge all of the above to React Native via the same Expo module

This is months of work, not weeks. And it is platform-specific native code that cannot be tested in Expo Go or a simulator — it requires real devices.

### 3.2 Session screen and timer

The session screen ([session.tsx](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/mobile/app/session.tsx)) exists and has a timer implementation, but:

- Timer uses `setInterval` which drifts over time and stops when the app is backgrounded. A real session timer needs to compute elapsed time from `Date.now() - startedAt` on each tick, and persist the session start time so it survives app kill and device restart.
- There is no background timer / notification integration. When the user leaves the app, they get no countdown, no notification at completion, and no awareness that a session is running.
- Strict mode delay countdown has no persistence. If the user kills and relaunches the app during a strict-mode delay, the delay state is lost.

### 3.3 Offline mutation queue — missing

The docs specify "a persisted mutation queue that replays on reconnect with idempotency keys." The codebase uses `@tanstack/react-query` for data fetching but has no offline queue, no retry logic, and no idempotency keys. Tasks and sessions created while offline will be lost.

### 3.4 Local SQLite — missing

The docs specify "SQLite via `expo-sqlite` or `op-sqlite` locally." There is no local database. All data comes from the API. If the API is unreachable, the app shows nothing. This is especially problematic because:

1. Focus sessions must work offline (the docs correctly identify this)
2. Pending-consent child accounts must work in local-only mode
3. The sync strategy depends on local-first data with server reconciliation

### 3.5 Missing screens from IA doc

The Information Architecture specifies these MVP screens that do not exist:

| Screen | Status |
|---|---|
| Task detail (full view with subtasks, notes, linked events) | **Missing** |
| Quick add bar (pinned above tab bar, always visible) | **Missing** |
| Filter and sort sheet for tasks | **Missing** |
| Projects and lists management | **Missing** |
| Completed archive | **Missing** |
| Day/3-day/week/month calendar views | **Missing** (calendar.tsx exists but is a basic list) |
| Event detail and editor | **Missing** |
| Drag-and-drop scheduling | **Missing** |
| Session history | **Missing** |
| Active session card on Today | Partially implemented |
| Merged timeline (tasks + events) on Today | **Missing** |

---

## 4. Blocking System

### 4.1 iOS blocking — entirely unbuilt

As detailed in Section 3.1, there is no iOS blocking implementation. The required components:

- `FamilyControls` authorization
- `ManagedSettings` shield application
- `DeviceActivity` scheduling
- Three app extensions (Monitor, ShieldConfiguration, ShieldAction)
- App Group for inter-process communication
- `FamilyActivityPicker` for app selection

None of these exist. Not as stubs. Not as configurations. Not as TODO comments.

### 4.2 Android blocking — entirely unbuilt

Similarly:

- `FenceMonitorService` foreground service
- `UsageStatsManager` polling
- `FenceOverlayActivity` overlay
- `PACKAGE_USAGE_STATS` permission handling
- `SYSTEM_ALERT_WINDOW` permission handling
- `START_STICKY` restart recovery
- OEM battery-optimization guidance

None of these exist.

### 4.3 The "50 ManagedSettingsStore instances" constraint

The docs mention this limit but don't address how the fence management system handles it. Each named fence could consume a store instance. If a user creates 10 fences with different schedules, they use 10 of the 50 slots. The `fence.create` API endpoint has no limit, and there's no cleanup of unused stores.

### 4.4 Shield latency on Android

The docs correctly identify the ~800ms polling latency and prescribe a "fast and fully opaque" overlay entrance. But there is no discussion of what happens during that 800ms:

- The user sees their feed content, potentially including content inappropriate for minors
- Push notifications from fenced apps may arrive and be readable
- The fenced app may execute background tasks (e.g., auto-play video)

The overlay must not just be fast — it must be `FLAG_NOT_TOUCHABLE` and `FLAG_LAYOUT_IN_SCREEN` to prevent interaction during the transition.

---

## 5. Security

### 5.1 Auth middleware allows unauthenticated requests through

The [auth.ts](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/api/src/auth.ts) middleware calls `await next()` in every failure path — no header, no token, invalid token, missing Clerk keys. This means unauthenticated requests reach the route handlers. The protection is in the tRPC procedure layer (`clerkProcedure` and `authedProcedure` throw `UNAUTHORIZED`), but:

- The `/health` endpoint is intentionally public — fine.
- The `user.healthAuth` procedure uses `publicProcedure` and returns `clerkId` and `userId` for any request — this is an information leak.
- If any developer adds a new `publicProcedure` endpoint, it is accessible without any auth. There is no defense-in-depth.

### 5.2 Dev token bypass

The auth middleware accepts `dev:<id>` tokens in non-production environments. This is standard for development, but:

- The check is `process.env.NODE_ENV !== "production"`. Many hosting platforms (including Vercel preview deployments) do not set `NODE_ENV=production` by default.
- There is no logging of dev-token usage that would help detect accidental deployment with dev tokens enabled.

> [!WARNING]
> Verify that all Vercel deployment environments set `NODE_ENV=production`. A single preview deployment with dev tokens enabled gives anyone `Bearer dev:admin` access.

### 5.3 No input sanitization beyond zod

Zod validates types and constraints, but there is no sanitization of:

- Display names (could contain HTML/JS for XSS if rendered in a web dashboard later)
- Task titles and notes (same risk)
- Tags (no length limit per tag, no total tag count limit)

### 5.4 Delete cascade is not transactional

The [deleteAccount](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/api/src/trpc/routers/user.ts#L158-L169) mutation runs 9 sequential `DELETE` queries without a database transaction. If any intermediate query fails, the user ends up in a partially-deleted state — some data gone, some remaining, account row possibly still present or absent. This is unacceptable for a compliance-critical operation.

```typescript
// Current: sequential deletes, no transaction
await ctx.db.delete(consentEvents).where(eq(consentEvents.userId, ctx.userId));
await ctx.db.delete(calendarEvents).where(eq(calendarEvents.userId, ctx.userId));
// ... 7 more deletes ...

// Required: wrap in a transaction
await ctx.db.transaction(async (tx) => {
  await tx.delete(consentEvents).where(eq(consentEvents.userId, ctx.userId));
  // ... all other deletes ...
});
```

### 5.5 Shield hit increment has a race condition

The `recordShieldHit` mutation reads the current count, then writes `count + 1` in a separate query. Two concurrent shield hits can both read the same count and both write `count + 1`, losing one hit. Use `sql\`shield_hits + 1\`` in the SET clause instead.

### 5.6 No CORS configuration

The Hono app has no CORS middleware. When the web dashboard ships, it will need CORS headers. More immediately, if the API is accessed from a web-based dev tool or admin panel, it will fail silently.

### 5.7 No request logging

There is no request logging, no audit trail, and no way to investigate incidents. For a product handling children's data, this is a compliance liability.

---

## 6. Privacy & Compliance

### 6.1 COPPA compliance — partially built, critically incomplete

**What exists:**
- Age band resolution logic (`packages/policy/src/age-band.ts`) — works correctly
- Feature access gating (`packages/policy/src/feature-access.ts`) — works correctly
- Consent event schema and database table — exists
- `ensureProfile` mutation records consent events — exists

**What is missing:**
- **VPC vendor integration.** There is no actual verification of parental identity. The current flow records a "consent event" with method `"email-notice"` but performs no actual verification. Under the amended COPPA Rule (effective April 22, 2026), email-only notice is NOT an approved VPC method — it was explicitly deprecated.
- **Direct notice email sending.** The mutation records the guardian email but sends no email. There is no email service integration (SendGrid, Resend, SES) anywhere in the codebase.
- **Local-only restricted state enforcement.** The docs specify that child accounts pending consent operate in "local-only" mode where "nothing behavioral syncs to the server." The codebase has no mechanism to enforce this — all API calls work identically regardless of consent status. There is no middleware, no procedure guard, and no client-side enforcement.
- **Consent revocation flow.** No way for a guardian to revoke consent. No webhook endpoint for a VPC vendor callback.
- **Guardian portal.** Deferred to "LATER" in the IA doc, but the docs also say "parent/guardian rights (consent status, export, deletion) can be handled in-app and via support email." There is no support email integration.

> [!CAUTION]
> The current implementation gives a false sense of compliance. Recording a consent event is not the same as obtaining verifiable parental consent. If you launch with the current code and a US child creates an account, you are collecting their data (session metrics, task content, device identifiers via Clerk) without verified parental consent. That is a COPPA violation.

### 6.2 GDPR lawful-basis architecture — well-designed but unimplemented

The docs' strategy of using contractual necessity (Art. 6(1)(b)) for core processing and not offering consent-based processing to minors is clever and legally sound (pending legal confirmation). However:

- **No privacy policy exists** — not in the app, not as a URL, not as a document. Both stores require it.
- **No child-friendly privacy notice** — specified as MVP in the docs, does not exist.
- **No DPIA** — specified as a launch deliverable, not started.
- **No data processing record** — required under GDPR Art. 30.

### 6.3 Data retention — specified but not implemented

The docs require a published retention policy and a real scheduled deletion job. Neither exists. Data is retained indefinitely.

### 6.4 Children's Code mapping — good in docs, absent in code

The UK Children's Code requirements are mapped thoughtfully in the docs (Section 06). But the codebase has no mechanism to:

- Detect UK jurisdiction at the application layer (the `childrensCodeApplies` flag exists on the user record but nothing reads it to adjust behavior)
- Suppress loss-framed language for minors
- Provide different privacy notices for children
- Disable profiling (no profiling exists yet, so this is compliant by absence)
- Cap strict-mode delay for children (the constant `MAX_STRICT_DELAY_CHILD = 30` exists in policy but the session creation endpoint does not check it)

### 6.5 Age-band correction path — risky

The docs specify a "deliberate, re-verified path to correct an age band entered wrongly." The implementation ([age-band.tsx](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/mobile/app/profile/age-band.tsx) and `user.updateAgeBand`) allows age-band changes with no re-verification mechanism. A child could change their age band to "adult" from the settings screen and immediately gain access to LLM features and product analytics.

> [!CAUTION]
> The `updateAgeBand` mutation must require actual re-verification (Declared Age Range re-prompt or neutral screen re-entry), not just accepting the new value. The current implementation is a compliance vulnerability that a 12-year-old could exploit in 30 seconds.

### 6.6 `requiresParentalConsent` is too narrow

The function only returns `true` for US children. Under the docs' own lawful-basis architecture, VPC is needed for US under-13s only — which is correct. But the function name is misleading, because other jurisdictions may require consent for different processing activities (not core service, but any future additions). More importantly, the function is only called in one test — it is not used anywhere in the API to actually enforce the consent requirement.

---

## 7. Data Model

### 7.1 Schema review

**Users table** — good. The fields `age_band`, `jurisdiction`, `assurance_method`, `assurance_at`, and `childrens_code_applies` are exactly what the compliance design requires. `clerk_id` as the external identity link is clean. No birthdate column — correct per docs.

**Sessions table** — mostly good. `strict_delay_minutes` as an immutable field set at creation time is correct. However:
- No `timezone` field. The streak rollover logic computes "today" in server time, not user time. A user who completes a session at 11:50 PM in Los Angeles (server time: 2:50 AM next day if server is US East) gets credited for the wrong day.
- No `practice` flag. Sessions created in practice mode (no actual blocking) are stored identically to real sessions. The streak can be earned by practice-mode sessions, which undermines the metric.

**Tasks table** — adequate for MVP but missing:
- No `description` field for rich content (the `notes` field is plain text)
- No `list_id` or `section_id` for Todoist-style project sections
- The `position` field is an integer with no gap strategy — reordering a task in the middle of a list requires updating every subsequent task's position
- Self-referential `parent_task_id` with no depth limit — infinite recursion in queries if subtasks reference each other (no FK constraint to prevent circular references)

**Calendar events table** — missing critical fields:
- No `timezone` field. All timestamps are stored as UTC, but recurring events need the original timezone for correct `RRULE` expansion (e.g., "every weekday at 9 AM" in the user's timezone is a different UTC time depending on DST).
- No `color` field for event display
- No `location` field
- No `attendees` support (even for display-only purposes when syncing external calendars later)

**Fences table** — stores app tokens as `jsonb` arrays of strings. On iOS, `ApplicationToken` is not a string — it is an opaque Codable value that must be serialized to Data and round-tripped through the App Group. Storing it as a JSON string in Postgres will not work for iOS tokens. Android package names are strings and would work fine. This schema conflates two fundamentally different data types.

> [!WARNING]
> The fence token storage strategy needs to be split by platform. iOS tokens should live in the App Group on-device only. The server fence record should store category selections (which are known identifiers) and leave app-level tokens device-local.

**Streaks table** — the `last_session_date` is stored as a text string (`YYYY-MM-DD`). This is adequate but:
- No timezone on the user record means the date is computed in server time
- The streak logic is in the session completion mutation, not a durable job. If the session completion fails after updating the streak but before returning, the streak is incremented without the session being marked complete.

**Consent events table** — good design (append-only, with `granted_at` and `revoked_at`). Missing:
- No `guardian_identifier` field beyond email (the docs specify "guardian identifier" which could include phone, government ID reference from VPC vendor)
- No `verified_at` timestamp separate from `granted_at` (a consent can be granted by the guardian clicking a link before VPC verification completes)

### 7.2 Missing tables

| Table | Purpose | Docs Reference |
|---|---|---|
| `presets` | Named session configurations (duration + fence + strict combo) | IA doc: "Presets — named duration + fence + strict combinations" |
| `fenced_hours_skips` | Record of "skip today" actions for Fenced Hours | User flows: "a one-tap skip-today that does not break the streak" |
| `shield_hits` | Individual shield hit events with timestamps | Currently a counter on sessions; should be separate events for analytics |
| `onboarding_state` | Server-side onboarding progress | Currently client-only in `onboarding-state.ts` |
| `notification_preferences` | Per-user notification settings | IA doc: "Notifications — MVP" |
| `focus_audio_preferences` | Audio settings (white noise, rain, etc.) | IA doc: "Focus sounds and white noise — MVP" |

### 7.3 No database migrations

There is no migration directory, no `drizzle.config.ts`, and no evidence that `drizzle-kit` has been configured. The schema exists as TypeScript definitions, but there is no way to apply it to a database, evolve it, or roll back changes. In production, schema changes without migrations will cause data loss.

---

## 8. APIs

### 8.1 Missing API endpoints

The following endpoints are required by the MVP feature set but do not exist:

| Missing Endpoint | Purpose |
|---|---|
| `fencedHours.create` / `update` / `delete` / `list` | Manage recurring scheduled sessions |
| `calendarEvent.create` / `update` / `delete` / `list` | Calendar CRUD |
| `project.create` / `update` / `delete` / `list` | Task project management |
| `insights.*` | Analytics queries (focus time, sessions, trends) |
| `session.getStreak` | Read streak data for display |
| `consent.getStatus` | Check consent state for a child account |
| `consent.revokeFromGuardian` | Guardian consent revocation |
| `user.updateProfile` | Update display name, email, notification preferences |

### 8.2 API design issues

**No server-side policy enforcement on session creation.** The `session.create` mutation accepts any `strictDelayMinutes` value. For child accounts, this should be capped at `MAX_STRICT_DELAY_CHILD` (30 minutes). The constant exists in `packages/policy` but is never imported or checked by the API.

**No server-side validation of fence ownership.** The `session.create` mutation accepts a `fenceId` but does not verify that the fence belongs to the requesting user. A user could create a session referencing another user's fence ID.

**Export endpoint is a query, not a job.** The `user.exportData` procedure runs synchronously and returns all user data in a single response. For a user with thousands of tasks and hundreds of sessions, this will timeout. The docs specify "export generation" as a durable job that produces a downloadable bundle.

**Delete endpoint has no confirmation or delay.** GDPR allows a reasonable processing period. More importantly, irreversible account deletion with no confirmation step and no grace period is a support nightmare. Consider a soft-delete with a 7-day grace period, with immediate anonymization of PII.

### 8.3 No webhook endpoints

The docs specify webhook endpoints for:
- VPC vendor callbacks (consent granted/revoked)
- Future: calendar push channels, billing events

The API has no webhook routes. The Hono setup provides HTTP routes alongside tRPC, but none are defined beyond `/health`.

---

## 9. Database

### 9.1 No connection pooling configuration

The `apps/api/src/db/index.ts` creates a Drizzle instance but the Neon configuration is not visible. For Vercel Functions (serverless), you must use Neon's `@neondatabase/serverless` driver with WebSocket connections, not the standard `pg` driver. Standard Postgres connections do not work in serverless environments due to connection limits and cold-start overhead.

### 9.2 No indexes for common queries

The schema has two composite indexes on `tasks` and `sessions`, which is good. Missing indexes:

- `fences.user_id` — every fence list query filters by user
- `fenced_hours.user_id` — same
- `calendar_events.user_id` — same
- `calendar_events.(user_id, start_at)` — calendar queries will filter by date range
- `consent_events.user_id` — consent status lookups
- `users.clerk_id` — the most common lookup (already has a UNIQUE constraint, which creates an index)

### 9.3 No soft-delete support

Hard deletes on tasks and sessions mean:
- Undo is impossible
- Analytics on historical data break
- Compliance audit trails are incomplete (you need to prove what you deleted and when)

Consider adding `deleted_at` timestamps and filtering in queries.

### 9.4 Timestamp handling

All timestamps use Drizzle's `timestamp()` which defaults to `timestamp without time zone` in Postgres. This stores the timestamp without timezone context, which means:

- Two users in different timezones who complete a session "at 5 PM" will have different UTC values but the database cannot tell you what local time they meant
- Recurring events need the originating timezone to expand correctly
- The streak logic needs the user's local date, not the server's UTC date

Use `timestamp('...', { withTimezone: true })` for all timestamp columns, and store the user's timezone on the user record.

---

## 10. AI Features

### 10.1 NLP parser — solid for a first implementation

The [parser.ts](file:///c:/Users/Usuario/Github/Fenced/Fenced/packages/nlp/src/parser.ts) handles dates, times, tags, priorities, and estimates via regex. The test coverage is good. Issues:

- **No recurrence parsing.** The parser always sets `rrule: null`. Input like "gym every monday" or "daily standup at 9am" does not produce recurrence rules. This is documented as an MVP feature in the task system but the parser cannot handle it.
- **No locale awareness.** Date parsing assumes MM/DD format for slash dates. European users expect DD/MM. "5/7" is May 7th or July 5th depending on locale.
- **`isAmbiguous` is always `false`.** The parser never flags ambiguous input, which means the LLM fallback for adults and the "ask to clarify" path for minors will never trigger. This is the entire age-gated AI pipeline and it doesn't activate.
- **No timezone handling.** Times are parsed against the JavaScript runtime's local timezone, which in a serverless environment is UTC. "tomorrow 3pm" means 3 PM UTC, not 3 PM in the user's timezone.

### 10.2 LLM fallback — not implemented

The docs specify Vercel AI SDK with zod-constrained structured output for adult accounts. There is no LLM integration in the codebase. No AI SDK dependency, no API route for LLM calls, no prompt engineering.

### 10.3 The "no minor's data reaches a model" boundary — not enforced

The docs say: "Enforce this at the boundary of the AI service, checked against `packages/policy`, not at call sites." There is no AI service boundary to enforce it at. When the LLM fallback is built, the enforcement point must be a server-side middleware, not a client-side check.

---

## 11. UX / Design

### 11.1 Onboarding — partially designed, not built

The onboarding flow in the codebase has:
- A hook screen
- Age assurance (neutral screen only — no Declared Age Range API integration)
- Sign-in (Clerk)
- Intent selection
- Category selection

Missing from onboarding:
- Guardian consent collection for under-13s
- Permission explainer screen
- The OS permission request
- App picker (`FamilyActivityPicker` on iOS, custom on Android)
- First session offer
- Post-session notification permission request
- Practice mode flow

### 11.2 The fence animation — not built

The entire brand direction doc centers on the fence metaphor: pickets dropping in, panels completing, the gate swinging shut, the line extending. The codebase has no animation system, no fence component, and no visual representation of the metaphor that is the product's signature identity. This is the visual equivalent of not having a logo.

### 11.3 Shield screen — not built

The shield screen (what the user sees when they open a fenced app) is described as "the highest-stakes copy surface in the app." It does not exist. On iOS it would be rendered by the `ShieldConfiguration` extension; on Android by the overlay activity. Neither exists.

### 11.4 Sound and haptics — not built

The brand direction specifies custom sound design (wooden latch click, warm two-note resolve, soft muted knock) and synchronized haptics. No audio files exist, no haptic calls exist.

### 11.5 Accessibility

- No Dynamic Type support evident in the mobile code
- No VoiceOver/TalkBack labels on custom components
- No Reduce Motion checks
- The docs correctly specify "Respect Reduce Motion" but the implementation has no motion to reduce
- No color-contrast verification between Timber (#C08A4E) and Paper (#FAF7F2) — the docs flag this as "the risky pair" but it hasn't been checked

### 11.6 Deep links — not implemented

The IA doc specifies six deep link patterns (`fenced://session/start`, `fenced://task/new`, etc.). None are configured in the Expo router.

---

## 12. Performance

### 12.1 Data loading

- No data caching strategy beyond React Query's in-memory cache
- No background prefetching
- No stale-while-revalidate configuration visible
- Large list queries (tasks, sessions) fetch everything — no virtualization in the UI, no pagination in the default case

### 12.2 Timer accuracy

As noted in Section 3.2, the session timer uses `setInterval` which drifts. Over a 90-minute deep-work session, drift can be 1–2 minutes. The timer should compute from `Date.now() - startedAt` on each render.

### 12.3 Cold start

Vercel Functions cold starts are typically 200-500ms. With Clerk JWT verification, database connection establishment, and tRPC context creation, the first request to a cold function could take 1-2 seconds. For a mobile app where "one tap from app open to fence active" is the goal, this is noticeable.

Consider:
- Keeping the function warm with a cron ping
- Using Vercel Edge Functions for latency-sensitive endpoints (Neon's serverless driver supports Edge)

---

## 13. Reliability

### 13.1 Session state recovery

If the app is killed during an active session:
- **iOS**: The `DeviceActivityMonitor` extension would continue enforcing the schedule (if it existed). But the main app's session state is in memory. On relaunch, there is no mechanism to restore the active session.
- **Android**: `START_STICKY` would restart the service (if it existed). Same session state problem.

The docs correctly specify persistence in the App Group / shared preferences. This is not implemented.

### 13.2 Streak correctness

The streak logic in [session.ts](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/api/src/trpc/routers/session.ts#L68-L98) has multiple issues:

1. **Timezone bug**: `new Date().toISOString().slice(0, 10)` produces the UTC date, not the user's local date. A user who completes a session at 11 PM PST on Monday gets credited for Tuesday (UTC).
2. **Yesterday calculation**: `Date.now() - 86400000` does not account for DST transitions. On a "spring forward" day, "yesterday" is 23 hours ago, and on "fall back" it is 25 hours ago.
3. **No idempotency**: Completing multiple sessions on the same day could increment the streak multiple times (the check `existing.lastSessionDate !== today` prevents this, but the streak *increment* happens without verifying the day boundary correctly).

### 13.3 No health checks beyond basic

The `/health` endpoint returns `{ status: "ok" }` without checking database connectivity. A health check that reports healthy while the database is down is worse than no health check.

---

## 14. Testing

### 14.1 Current test coverage

- `packages/nlp` has a test suite (`__tests__/`) — the only package with tests
- `packages/policy` has a test suite — also present
- `apps/api` has **no tests**
- `apps/mobile` has **no tests**
- `native/fenced-blocking` has **no tests**

### 14.2 Critical testing gaps

| What needs testing | Why it's critical |
|---|---|
| Session state machine (armed → active → completed/abandoned) | Core business logic, currently untested |
| Streak calculation (timezone edge cases, DST, multi-session days) | User-visible metric, bugs cause rage-uninstalls |
| Policy enforcement (feature access by age band) | Compliance-critical, currently unit-tested but not integration-tested |
| Delete cascade (all user data removed) | Compliance-critical, currently untested |
| Auth middleware (dev tokens, expired tokens, missing tokens) | Security-critical, currently untested |
| Concurrent shield hit recording (race condition) | Data correctness, known bug |
| NLP parser edge cases (locale-dependent dates, malicious input) | User experience |
| Onboarding flow (each step, each age band path) | Conversion-critical |

### 14.3 No E2E test infrastructure

No Detox, Maestro, or Appium configuration. No EAS Build configuration for test builds. No CI pipeline definition (no `.github/workflows/`, no `vercel.json` build config).

---

## 15. Business & Go-to-Market

### 15.1 No launch checklist

The docs describe a phased build order but no launch checklist. Missing pre-launch items:

- Apple Developer Program enrollment confirmed
- Family Controls entitlement requested (the docs say "this week" — has it been done?)
- App Store Connect app record created with age rating questionnaire completed
- Google Play Console app record with target audience declaration
- Privacy policy URL (required by both stores)
- Support email / URL (required by both stores)
- Marketing website
- App Store screenshots and metadata
- TestFlight / Play Console internal testing track
- Legal engagement for DPIA and COPPA review (the docs say "this week")

### 15.2 No beta/testflight strategy

How will you test with real users before launch? The blocking layer requires real devices and real permissions. TestFlight supports Family Controls with the development entitlement. But there is no test plan, no beta signup mechanism, and no feedback collection system.

### 15.3 No support infrastructure

When users have problems — and they will, especially with Android OEM battery-killer issues — where do they go? No in-app support channel, no help desk, no FAQ, no status page.

---

## 16. Missing Documentation

### 16.1 Documents that should exist but don't

| Document | Purpose |
|---|---|
| **API specification** | Endpoint contracts, request/response shapes, error codes |
| **Data model diagram** | Visual representation of tables and relationships |
| **Privacy policy** | Legal requirement for both stores |
| **Child-friendly privacy notice** | COPPA and UK Children's Code requirement |
| **Terms of service** | Legal requirement |
| **DPIA template / draft** | UK Children's Code requirement, pre-launch |
| **Retention policy** | COPPA requirement, must be published and implemented |
| **Incident response plan** | What happens when you have a data breach involving children's data? |
| **Contributor guide** | How new developers set up the project |
| **Architecture decision records** | Why specific technical choices were made |
| **QA test plan** | What to test before each release |
| **App Store submission guide** | Exact steps, metadata, and declaration answers for both stores |
| **OEM battery-optimization guide** | Per-manufacturer instructions for Android users |

### 16.2 Documentation that exists and is excellent

Credit where due — the existing six documents are among the best product design documentation I have seen for a project at this stage. Specifically:

- The platform constraints document is exceptional. It tells the truth about what cannot be done and provides actionable alternatives.
- The youth compliance document is thorough and correctly identifies the lawful-basis strategy as the key legal question.
- The brand direction document is unusually specific about what *not* to do, which is harder than specifying what to do.
- The build-order prioritization is correct: prove blocking first, then compliance, then product.

The problem is not documentation quality — it is the gap between what is documented and what is built.

---

## 17. Contradictions

### 17.1 Build order vs. actual build order

The docs specify Phase 1 (prove blocking) → Phase 2 (compliance foundation) → Phase 3 (product). The codebase has built Phase 3 (product UI, session management, task CRUD) without completing Phase 1 or Phase 2. This is the opposite of the documented priority.

### 17.2 "Genuinely complete task manager" vs. implementation

The docs repeatedly claim the task manager must be "genuinely complete" to displace Todoist. The implementation has no search, no bulk operations, no attachments, no rich text, no keyboard shortcuts, no task detail screen, no recurring task materialization, no quick add bar. It is a basic CRUD list.

### 17.3 Local-first vs. server-first

The docs describe "server is the source of truth with optimistic writes and a durable offline mutation queue." The implementation is server-first with no offline capability. There is no local database, no mutation queue, and no offline detection.

### 17.4 "First-party focus audio" vs. implementation

Focus audio is listed as MVP in both the IA doc and the platform constraints doc. The [focus-sounds.tsx](file:///c:/Users/Usuario/Github/Fenced/Fenced/apps/mobile/app/profile/focus-sounds.tsx) profile screen exists but there are no audio files, no audio playback system, and no integration with the session screen.

### 17.5 "Shield hits are your best telemetry" vs. implementation

The docs emphasize shield hits as the key metric. The implementation stores them as a counter on the session record, incremented by a race-condition-prone API call. There is no per-hit timestamp, no offline accumulation, and no analytics visualization.

### 17.6 Guardian portal deferred but consent required at launch

The docs defer the guardian portal to "LATER" but also require COPPA-compliant consent management at MVP. Without a guardian portal, how does a guardian review data, revoke consent, or request deletion? "Via support email" is not COPPA-compliant — it requires a mechanism, not a promise.

---

## 18. Gap Analysis

### 18.1 Readiness by phase

| Phase | Description | Readiness |
|---|---|---|
| Phase 0 | Entitlement request + legal | **Not started** |
| Phase 1 | Prove blocking on both platforms | **Not started** — zero native code |
| Phase 2 | Auth + compliance foundation | **30%** — Clerk auth and age-band schema exist; consent enforcement, email sending, guardian portal, retention jobs do not |
| Phase 3 | MVP product features | **25%** — Session, task, and fence CRUD exist; calendar, insights, onboarding, blocking integration, offline, sync do not |
| Phase 4 | Hardening + launch | **0%** — No tests, no accessibility, no store submissions |

### 18.2 Estimated remaining work (aggressive but realistic)

| Work Area | Estimate |
|---|---|
| iOS blocking layer (Swift + Expo bridge + extensions) | 6–10 weeks |
| Android blocking layer (Kotlin + Expo bridge + service) | 4–6 weeks |
| Compliance enforcement (consent flow, email, local-only mode, retention) | 3–4 weeks |
| Task manager completion (detail screen, quick add, projects, filters, recurrence) | 4–6 weeks |
| Calendar completion (views, event editor, drag-drop) | 4–6 weeks |
| Insights/analytics dashboard | 2–3 weeks |
| Offline support (SQLite, mutation queue, sync) | 3–4 weeks |
| Onboarding completion (all screens, permission flows, practice mode) | 2–3 weeks |
| Fence animation system | 2–3 weeks |
| Sound, haptics, motion | 1–2 weeks |
| Testing (unit, integration, E2E) | 3–4 weeks |
| Store submissions and launch prep | 2–3 weeks |
| Legal (DPIA, privacy policy, terms, legal review) | 4–8 weeks (external dependency) |
| **Total** | **40–62 weeks** for a single full-stack developer |

With a team of 3 (1 mobile, 1 backend, 1 native/platform), this compresses to roughly **15–22 weeks** assuming parallel execution and no blocking dependencies.

> [!IMPORTANT]
> The Family Controls entitlement approval is a hard external dependency with a 1–6 week timeline. It must be submitted immediately. Everything else can proceed in parallel, but nothing ships to iOS without it.

---

## 19. Readiness Scoring

| Category | Score (1–10) | Notes |
|---|---|---|
| Documentation quality | **9/10** | Exceptional. Among the best I've reviewed. |
| Architecture design | **8/10** | Sound decisions, well-reasoned trade-offs. |
| Implementation completeness | **2/10** | Most MVP features exist as stubs or are missing entirely. |
| Blocking system | **0/10** | Does not exist. The core product differentiator is unbuilt. |
| Compliance enforcement | **2/10** | Schema exists, enforcement does not. |
| Test coverage | **1/10** | Two packages have unit tests. Everything else is untested. |
| Security posture | **3/10** | Basic auth exists, significant gaps (see Section 5). |
| Store readiness | **1/10** | No submissions, no privacy policy, no age rating, no metadata. |
| Launch readiness | **1/10** | Not close to launchable in current state. |
| **Overall** | **3/10** | Excellent blueprint, early-stage implementation. |

---

## 20. Rewrite Recommendations

### 20.1 Things to stop doing immediately

1. **Stop building product features until Phase 1 is proven.** Do not write another screen, another API endpoint, or another UI component until a shield goes up and comes down on a real iOS device and a real Android device. If blocking doesn't work, none of the product code matters.

2. **Stop accepting age-band changes without re-verification.** The `updateAgeBand` mutation is a compliance vulnerability. Add a re-verification step or remove the endpoint until one is built.

3. **Stop using sequential deletes without transactions.** Wrap the delete cascade in a transaction today.

### 20.2 Things to start doing immediately

1. **Submit the Family Controls entitlement request.** This is the single highest-leverage action. It is also the action the docs say should have been done first, weeks ago.

2. **Start the legal engagement.** Find a privacy lawyer who knows COPPA and UK Children's Code. The DPIA alone is a multi-week process.

3. **Set up database migrations.** Run `drizzle-kit generate` and commit the migration files. Every schema change from now on must go through migrations.

4. **Add timestamp timezone support.** Switch to `timestamp with time zone` and add a `timezone` field to the user record.

5. **Implement the shield hit race condition fix.** Use SQL increment instead of read-then-write.

### 20.3 Architecture changes to consider

1. **Split the native module by platform.** The current `native/fenced-blocking` TypeScript stub should become two separate native implementations (Swift and Kotlin) with a shared TypeScript interface. Consider using `expo-modules-core` for the bridge, or evaluate whether `react-native-device-activity` (Kingstinct) provides enough of the iOS surface.

2. **Add cursor-based pagination to all list endpoints.** Offset pagination is a technical debt that worsens with scale.

3. **Implement the offline mutation queue before more API endpoints are added.** Every new endpoint added now is an endpoint that later needs offline support retrofitted. Build the queue infrastructure first.

4. **Add a proper logging and observability layer.** Even if it's just structured JSON logs to Vercel's log drain. You need to be able to investigate production issues.

### 20.4 What NOT to rewrite

- **The zod schema sharing pattern** — this is the project's best architectural decision.
- **The policy module design** — `packages/policy` is well-structured and should be the model for all gating logic.
- **The docs** — they are excellent and should be treated as the source of truth.
- **The age-band resolution logic** — correct and well-tested.
- **The tRPC + Hono setup** — appropriate for the scale and well-configured.
- **The NLP parser** — solid for a first implementation and genuinely useful.

---

## Summary

**The documentation is a 9/10. The implementation is a 2/10. The gap between them is the project's defining risk.**

You have an exceptionally well-thought-out product design. The compliance strategy is clever, the platform constraints analysis is honest, and the architectural decisions are sound. This is genuinely better product thinking than most funded startups produce.

But the code tells a different story. The core differentiator — app blocking — does not exist. The compliance enforcement is a schema with no teeth. The task manager and calendar are CRUD shells. There is no offline support, no local database, no animations, no sounds, no tests, and no store readiness.

The most important action is also the simplest: **go back to Phase 1.** Prove the blocking layer works on real devices. If it does, you have a product worth building. If it doesn't, you need to know now, not after six more months of product code.
