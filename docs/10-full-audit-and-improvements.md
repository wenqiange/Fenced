# 10 — Full Audit and Improvement Specification (Reconciled & Updated)

**Status:** authoritative · **Date:** 2026-11-04 · **Baseline:** commit `9d7dba7` ("chore: add Render blueprint for API and web") plus active working tree.  
**Scope:** all monorepo packages (`apps/mobile`, `apps/api`, `packages/{ai,api-client,core,ical,nlp,policy,ui}`, `native/fenced-blocking`), reconciled against `docs/01`–`09` and superseding `docs/design_audit.md`.

---

## Executive Summary & Document Reconciliation

This document is the **single source of truth** for the architectural health, compliance posture, open defects, and product roadmap of Fenced.

In accordance with the latest verification of the codebase:
1. **Items Already Implemented & Shipped (Verified Baseline)** have been removed from the open defect/improvement lists and documented in **Section 1**. This includes the outbox mutation queue, wall-clock persistent session engine, emergency passes, offline synthesized audio synth, 4-material fence UI system, task detail & project management screens, namespaced rate limiting, and core cryptographic token security.
2. **Items NOT Yet Improved (Active Audit Findings)** remain strictly classified in **Section 2** by severity (**P0**, **P1**, **P2**) with exact file locations, reproduction analysis, and remediation specs.
3. **Unimplemented Differentiating Features (Moat Specification)** are detailed in **Section 3** across youth compliance tiers.
4. **The Prioritised Roadmap (Quick Wins Q1–Q17, Refactors R1–R15, Strategic S1–S10)** in **Section 4** is completely sanitized so that no previously shipped work is scheduled as pending.

---

## Contents

1. [Verified Shipped Baseline — What Has Already Been Implemented](#1-verified-shipped-baseline--what-has-already-been-implemented)
2. [Active Audit — What is NOT Yet Improved](#2-active-audit--what-is-not-yet-improved)
   - 2.1 [Youth Compliance & Policy Gaps (P0)](#21-youth-compliance--policy-gaps-p0)
   - 2.2 [Native Blocking Engine Stub (P0 — Core Blocker)](#22-native-blocking-engine-stub-p0--core-blocker)
   - 2.3 [Storage Durability & Data Loss Risk (P0)](#23-storage-durability--data-loss-risk-p0)
   - 2.4 [Outbox, Sync Protocol & Concurrency Races (P0–P1)](#24-outbox-sync-protocol--concurrency-races-p0p1)
   - 2.5 [Backend, API Security & Error Leakage (P1)](#25-backend-api-security--error-leakage-p1)
   - 2.6 [Calendar Sync, Recurrence & DST (P1)](#26-calendar-sync-recurrence--dst-p1)
   - 2.7 [Scheduling Engine & Heuristics (P1)](#27-scheduling-engine--heuristics-p1)
   - 2.8 [AI Runtime, Context Bounds & Redaction (P1)](#28-ai-runtime-context-bounds--redaction-p1)
   - 2.9 [NLP Parsing & Internationalization (P1)](#29-nlp-parsing--internationalization-p1)
   - 2.10 [UI/UX, Typography, Motion & Accessibility (P1–P2)](#210-uiux-typography-motion--accessibility-p1p2)
3. [Differentiating Product Moat (Unimplemented Roadmap)](#3-differentiating-product-moat-unimplemented-roadmap)
4. [Prioritised Roadmap & Action Plan](#4-prioritised-roadmap--action-plan)
   - 4.1 [Quick Wins (Q1–Q17: Immediate)](#41-quick-wins-q1q17-immediate)
   - 4.2 [Core Architectural Refactors (R1–R15: Weeks 2–6)](#42-core-architectural-refactors-r1r15-weeks-26)
   - 4.3 [Strategic Initiatives (S1–S10: Quarter Scale)](#43-strategic-initiatives-s1s10-quarter-scale)
   - 4.4 [Sequencing & Impact Matrix](#44-sequencing--impact-matrix)
5. [Appendix: Legacy Audit Reconciliation & Doc Contradictions](#5-appendix-legacy-audit-reconciliation--doc-contradictions)

---

## 1. Verified Shipped Baseline — What Has Already Been Implemented

The following components were flagged in earlier specifications or in `design_audit.md` as missing, but **have now been fully implemented and verified in the codebase**. They are formally retired from the defect backlog:

### 1.1 Local-First Sync Outbox (`apps/mobile/src/lib/sync/`)
- **Status:** **SHIPPED** (implemented in commit `13dc554`).
- **Implementation:**
  - Persisted mutation queue in `outbox-core.ts` with client-generated UUIDs (`clientId`) for idempotent retries.
  - Automatic coalescing of repeated updates on the same entity.
  - Three-way merge engine in `merge.ts` preserving local-only rows and applying server changes.
  - Single-flight flush mechanism with exponential backoff on network failures.
  - Dedicated push/pull handlers for tasks, projects, fences, calendar events, fenced hours, and sessions.

### 1.2 Persistent Wall-Clock Session Engine (`apps/mobile/src/lib/session-engine.ts`)
- **Status:** **SHIPPED**.
- **Implementation:**
  - Replaced naive `setInterval` with pure wall-clock calculation: elapsed time derives directly from `(now - startedAt)`.
  - Sessions survive app backgrounding, termination, and device reboots.
  - Multi-phase state machine (`building`, `break`, `completed`, `left-early`) with boundary enforcement.
  - `ActiveSessionBanner` persistently displays active focus state across all app navigation stacks.

### 1.3 Immutable Strict Mode & Emergency Passes
- **Status:** **SHIPPED**.
- **Implementation:**
  - Strict-mode delays cannot be cancelled by restarting the app; the remaining delay duration is persisted in state.
  - Wellbeing escape hatch: Weekly quota of Emergency Passes (default: 2 per week) allowing a temporary 3-minute shield lift.
  - Automatic re-arming at the end of 180 seconds, logging pass usage without breaking streaks or incurring punitive loss framing.

### 1.4 Offline Synthesized Sound Engine & Tactile Haptics
- **Status:** **SHIPPED**.
- **Implementation:**
  - Mathematical sound generator in `apps/mobile/src/lib/audio/synth.ts` synthesizing clean 16-bit PCM WAV buffers offline without external network assets.
  - Five ambient loops: rain, forest canopy, 40 Hz binaural tone, campfire, stream.
  - Five physical wooden UI sound effects: latch close, panel drop, gate knock, shield release, clock tick.
  - Seamless loop crossfading and integration with `expo-audio`.
  - Haptic utility module (`apps/mobile/src/lib/haptics.ts`) providing differentiated physical patterns for task completions, selections, and boundary warnings.

### 1.5 Modular Fence UI & Visual Style System
- **Status:** **SHIPPED**.
- **Implementation:**
  - Interactive SVG-driven fence rendering in `FenceAssemblyView.tsx`.
  - Four distinct fence materials configured in `packages/ui/src/tokens/fence-styles.ts`:
    - *Timber & Pine* (default)
    - *Shou Sugi Ban* (charred cedar with copper rails)
    - *Nordic Birch* (light birch on slate)
    - *Fieldstone & Iron* (dry-stone posts with wrought iron pickets)
  - Interactive `GateLatchSlider.tsx` gesture control for session initiation.
  - Non-shaming streak visualization (`FenceLineStreakBanner.tsx`) rendering repaired joints for rest days.
  - Mindful delay breathing circle in `GateBreather.tsx`.

### 1.6 Core Screens & Information Architecture Completion
- **Status:** **SHIPPED**.
- **Implementation:**
  - Full Task Detail view in `apps/mobile/app/task/[id].tsx` supporting subtasks, notes, estimates, recurrence, tags, and blocker dependencies.
  - Projects data model and API router (`apps/api/src/trpc/routers/project.ts`), with management UI in `tasks.tsx`.
  - Interactive Event Sheet modal (`EventSheet.tsx`) for event inspection and creation.
  - Calendar agenda and week schedule in `apps/mobile/app/(tabs)/calendar.tsx`.
  - Productivity insights dashboard in `profile/insights.tsx` tracking focus totals, streaks, and reach distributions.

### 1.7 Server Security, Rate Limiter & COPPA Schema Sanitization
- **Status:** **SHIPPED**.
- **Implementation:**
  - Memory-backed rate limiting middleware in `apps/api/src/rate-limit.ts` with namespaced buckets (`auth`, `sync`, `api`).
  - Sensitive birth date storage eliminated: `birthMonth` and `birthYear` columns removed from backend schema; only coarse age bands are retained.
  - Information disclosure vulnerability in `user.healthAuth` closed (no longer exposes internal UUIDs or Clerk IDs to unauthenticated callers).
  - Consistent tenant scoping: all database queries enforce `where(eq(table.userId, ctx.userId))`.
  - Token crypto module (`token-crypto.ts`) using AES-256-GCM with random 96-bit IVs and tamper validation for third-party calendar credentials.
  - Subscribable ICS capability feeds (`calendar-feed.ts`) using high-entropy 256-bit unguessable tokens.

### 1.8 Background Job Handlers
- **Status:** **SHIPPED**.
- **Implementation:**
  - Dedicated background endpoints created in `apps/api/src/index.ts`:
    - `/api/cron/streak-rollover` (`jobs/streak-rollover.ts`)
    - `/api/cron/retention-enforcement` (`jobs/retention-enforcement.ts`)
    - `/api/cron/calendar-sync` (`jobs/calendar-sync.ts`)

---

## 2. Active Audit — What is NOT Yet Improved

The following findings represent **active, unmitigated architectural risks, functional defects, and policy gaps** currently in the codebase:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ACTIVE AUDIT HEALTH SCORECARD                          │
├───────────────────────────────┬───────┬─────────────────────────────────────────┤
│ Domain                        │ Grade │ Key Open Risk                           │
├───────────────────────────────┼───────┼─────────────────────────────────────────┤
│ Policy & Youth Compliance     │   D   │ UK/ES 14-17 minors classified as adults │
│ Native App Blocking           │   F   │ TypeScript stub; no Swift/Kotlin code   │
│ Local Storage & Durability    │   D   │ Single AsyncStorage JSON blob           │
│ Sync Protocol & Concurrency   │   C   │ Duplicate row creation races (O1-O3)    │
│ Backend API & Error Handling  │  B-   │ SQL and parameter leaks in tRPC errors  │
│ Calendar Sync & Recurrence    │   C   │ Non-idempotent push; dropped EXDATE/DST │
│ Scheduling Algorithms         │   B   │ Best-fit breaks same-day deadlines      │
│ AI Runtime & Redaction        │  B-   │ Enabled by default; misses ES/CA PII    │
│ NLP & Internationalization    │   C   │ English-only; fails Spanish/Catalan     │
│ UI/UX, Motion & Accessibility │  B-   │ 6 WCAG failures; underdamped springs    │
└───────────────────────────────┴───────┴─────────────────────────────────────────┘
```

---

### 2.1 Youth Compliance & Policy Gaps (P0)

#### 2.1.1 Band Model Flaw Exposes Minors to Adult Processing (B1)
- **Location:** `packages/policy/src/age-band.ts:18–23`, `packages/policy/src/feature-access.ts:68–76`.
- **Defect:** `resolveAgeBand` classifies any user at or above the local GDPR Art. 8 digital consent age as `"adult"`. In the UK and US that age is 13; in Spain it is 14:
  ```ts
  // CURRENT FLAWED IMPLEMENTATION:
  export function resolveAgeBand(ageInYears: number, jurisdiction: string): AgeBand {
    if (ageInYears < 13) return "child";
    const consentAge = getConsentAge(jurisdiction);
    if (ageInYears < consentAge) return "teen";
    return "adult"; // A 14-year-old in Spain is marked "adult"!
  }
  ```
  Consequently, minors aged 14–17 in Spain and 13–17 in the UK/US are granted access to third-party LLM features, analytics, and marketing. Furthermore, `canAccess()` never consults `childrensCodeApplies`.
- **Fix:**
  1. Decouple `consentBand` (`child` | `teen` | `adult`) from an explicit `isMinor: boolean` flag (`ageInYears < 18`).
  2. In `packages/policy/src/feature-access.ts`, define a `NEVER_FOR_MINOR` set denying all `llm-*`, `product-analytics`, `marketing-email`, and public feed publication if `isMinor === true`.
  3. Ensure `canAccess()` fails closed: unknown bands must return `false`.

#### 2.1.2 Assurance Escalation & Evasion (B3/B4)
- **Location:** `apps/api/src/trpc/routers/user.ts:113, 228`, `apps/mobile/app/profile/age-band.tsx:27–30`.
- **Defect:**
  - `ensureProfile` and `updateAgeBand` only restrict escalation when `assuranceMethod === "neutral-screen"`. Because `assuranceMethod` is client-supplied, a client sending `"declared-age-range-self"` immediately escalates to adult status and bypasses parental consent.
  - `profile/age-band.tsx` pre-populates state with June 2008 (`useState(2008)`), defaulting newly edited bands to 18+ years old.
  - Deleting an account does not delete the Clerk user; re-onboarding with the same credentials bypasses age gating.
- **Fix:** Reject client-asserted escalation on the server; require verifiable credentials (VPC webhook or signed Apple DeclaredAgeRange); remove the 2008 pre-fill; invoke Clerk Backend API on `deleteAccount`.

#### 2.1.3 Consent Lifecycle & Webhooks (B2)
- **Location:** `apps/api/src/trpc/routers/user.ts:58–72`.
- **Defect:** `consentPending` checks only `isNotNull(consentEvents.grantedAt)` and ignores `revokedAt`. A parent revoking consent leaves the account functioning in granted mode. Furthermore, no endpoint exists to receive VPC vendor confirmation.
- **Fix:** Query the *latest* consent event ordered by `createdAt DESC` and verify `grantedAt !== null && revokedAt === null`. Implement `POST /webhooks/vpc` with cryptographic signature verification.

#### 2.1.4 Cron Service Absence & Retention No-Op (B6)
- **Location:** `render.yaml`, `apps/api/src/index.ts:86–115`, `apps/api/src/jobs/retention-enforcement.ts`.
- **Defect:**
  - `render.yaml` defines only `fenced-api` and `fenced-web`. **No cron jobs are declared**, so background jobs never run in production.
  - If `CRON_SECRET` is unset, the cron endpoints in `index.ts` bypass authentication (`if (secret && auth !== ...)`), exposing job execution to anyone.
  - `retention-enforcement.ts` only purges consent events revoked >30 days ago, failing to delete unverified child accounts, purge inactive data, or clean provider tokens.
- **Fix:** Add Render cron services; return HTTP 503 when `CRON_SECRET` is missing; compare authorization headers using `crypto.timingSafeEqual`; rewrite retention enforcement according to statutory standards.

#### 2.1.5 PII Leakage Prior to Parental Consent (B7)
- **Location:** `apps/mobile/src/lib/sync/profile.ts:37–60`, `apps/api/src/trpc/routers/user.ts:124–149`.
- **Defect:** Onboarding profile sync pushes `displayName` and `email` to `ensureProfile` before parental consent is established, contradicting in-app promises.
- **Fix:** When `needsGuardianConsent` is true, the server must discard `displayName` and `email`, storing only the coarse age bracket, jurisdiction, and guardian email.

---

### 2.2 Native Blocking Engine Stub (P0 — Core Blocker)

- **Location:** `native/fenced-blocking/src/index.ts`.
- **Defect:**
  - The module is a pure TypeScript mock. There is zero Swift or Kotlin code, no Xcode targets, and no native Android service.
  - `requestAuthorization()` in sandbox mode returns `"approved"`, misleading the UI into presenting blocking as active.
  - Emergency shield pausing falls back to a JavaScript `setTimeout` (`pauseShield:269`). When the app is backgrounded on iOS, JS execution is suspended within seconds, turning a 3-minute emergency pass into an **infinite, un-shielded session bypass**.
  - `appTokens` (`string[]`) are pushed to the backend database (`apps/api/src/db/schema.ts`), violating privacy constraints.
- **Fix:**
  - Implement iOS FamilyControls (`DeviceActivityMonitor`, `ShieldConfiguration`, `ShieldAction`) and Android `UsageStatsManager` / `OverlayService`.
  - Make native extensions authoritative for schedule boundaries and shield re-arming.
  - Confine application tokens to local App Groups (`FamilyActivitySelection`); sync only coarse metadata and category counts to the server.

---

### 2.3 Storage Durability & Data Loss Risk (P0)

- **Location:** `apps/mobile/src/lib/local-store.ts:208–215, 373`.
- **Defect:**
  - The entire local state (tasks, events, history, settings) is serialized into a **single AsyncStorage JSON string** (`fenced.app.v3`).
  - Android's SQLite-backed AsyncStorage enforces a ~2MB `CursorWindow` read limit. As session history, tasks, and mirrored calendar events accumulate without pruning, the JSON payload will breach this threshold.
  - When JSON parsing fails, `hydrateAppState()` catches the error and silently falls back to `defaults`. **The subsequent write permanently overwrites user data with an empty state**.
  - Write errors in `writeNow()` are completely swallowed at line 212.
- **Fix:** Migrate to `expo-sqlite` as specified in `04-tech-stack.md`. Mutate records in discrete relational tables (`tasks`, `events`, `outbox`) within atomic transactions. In the interim, quarantine unparseable data to `fenced.app.corrupt.<timestamp>` instead of resetting to defaults.

---

### 2.4 Outbox, Sync Protocol & Concurrency Races (P0–P1)

- **Location:** `apps/mobile/src/lib/sync/merge.ts`, `apps/mobile/src/lib/sync/engine.ts`, `apps/api/src/db/schema.ts`.
- **Defects:**
  - **O1 (P0): In-Flight Create Duplication.** A pull occurring while an entity creation is in-flight on the network causes `mergeRemote()` to import the server row under a new local ID while retaining the pending local row, duplicating tasks and events.
  - **O2 (P0): Unflushed State Kill Window.** `setRemoteId` debounces state persistence (250ms), whereas outbox `settle` completes immediately. An app termination during this window strands local entities without remote IDs.
  - **O3 (P0): Default Fence Deduplication Reference Loss.** Dropping the local default fence during sync deduplication leaves dependent sessions and hours pointing to an invalid `fenceId`, halting outbox processing with `DependencyPending`.
  - **O4 (P1): Outbox Hot-Loop on 401 / Child Pending.** When sync is paused or unauthenticated, `scheduleRetry()` re-arms a 1,000ms timer indefinitely, draining device battery.
  - **O5 (P1): Clock-Skew LWW.** Last-Write-Wins compares client device clock (`Date.now()`) with server `updatedAt`, causing devices with fast clocks to overwrite legitimate edits.
  - **O6 (P1): Delete Inference from Truncated Paged Pulls.** If a pull reaches pagination limits, absent rows are incorrectly inferred as deleted on the server.
- **Fix:** Implement `pendingCreates` mapping in `mergeRemote()`; introduce integer `version` and `deleted_at` tombstones across synced tables; disarm outbox retry timers while paused; use keyset cursor pagination (`WHERE (updated_at, id) > ($1, $2)`).

---

### 2.5 Backend, API Security & Error Leakage (P1)

- **Location:** `apps/api/src/trpc/init.ts`, `apps/api/src/trpc/routers/task.ts:142–194`, `apps/api/src/db/schema.ts`.
- **Defects:**
  - **Error Leakage:** `init.ts` lacks a tRPC `errorFormatter`. Database errors return raw internal SQL queries and parameter values (including user titles and emails) directly to the client and logs.
  - **Missing Transactions & Cycle Deadlocks:** `task.setBlockedBy` performs un-transactioned `delete` and `insert` operations without detecting circular dependencies (e.g., A blocks B, B blocks A), which can deadlock the auto-scheduler.
  - **Cross-Tenant Foreign Key Manipulation:** Endpoints verify that target rows belong to `ctx.userId`, but do not verify foreign keys (`projectId`, `parentTaskId`, `linkedTaskId`). A user can link items to another tenant's project ID.
  - **Unbounded Inputs:** Zod schemas in `task.update`, `session.create`, and `calendar.create` permit arbitrary payload lengths, unvalidated RRULE strings, and unescaped timezone strings.
  - **IP Spoofing:** `rate-limit.ts:51` prioritizes `c.req.header("x-real-ip")`, allowing clients behind reverse proxies to spoof their source IP.
- **Fix:** Install a tRPC `errorFormatter` sanitizing internal errors; wrap multi-step mutations in `ctx.db.transaction()`; enforce composite foreign keys `(user_id, foreign_id)`; bind zod inputs with strict length and regex limits.

---

### 2.6 Calendar Sync, Recurrence & DST (P1)

- **Location:** `apps/api/src/integrations/calendar-sync.ts`, `apps/api/src/integrations/google-calendar.ts`.
- **Defects:**
  - **Non-Idempotent Push:** `pushConnection()` lacks mutual exclusion or connection leasing. Concurrent sync runs push identical new events, creating duplicates in Google Calendar.
  - **403 Treated as Auth Revocation:** `isAuthRevoked` treats HTTP 403 as a revoked grant, permanently disabling calendar synchronization whenever Google rate-limit or quota spikes occur.
  - **DST & Recurrence Loss:** Google Calendar is queried with `singleEvents: "false"`. Recurrence exceptions (`EXDATE`), moved instances, and Daylight Saving Time offsets are discarded when storing raw UTC master records.
- **Fix:** Query Google with `singleEvents: "true"` over a bounded window (-30 to +180 days); implement connection leasing via `lease_until`; parse Google error reasons to distinguish 403 rate limits from true authorization revocations.

---

### 2.7 Scheduling Engine & Heuristics (P1)

- **Location:** `packages/core/src/schedule/auto-schedule.ts`, `packages/core/src/schedule/time-block.ts`.
- **Defects:**
  - **Deadline Inversion via Best-Fit:** Best-fit packing can place a task due at 12:00 into an afternoon gap because the gap size matches better than an available morning slot.
  - **Priority Starvation:** Tasks lacking a due date sort after dated tasks regardless of urgency, delaying critical un-dated tasks indefinitely.
  - **Chain Inflexibility:** A task is deemed blocked if its dependency is uncompleted, even if that dependency is scheduled earlier within the exact same schedule plan.
  - **Lack of Wellbeing Limits:** No maximum daily focus time caps exist, allowing the scheduler to pack unrealistic 14-hour study days for minors.
- **Fix:** Use earliest-fit for deadline-constrained tasks; sort by slack time (`due - now - remaining`); implement Kahn's topological sort for dependency chains; enforce daily focus caps by age band (Child: 120m, Teen: 180m, Adult: 300m).

---

### 2.8 AI Runtime, Context Bounds & Redaction (P1)

- **Location:** `packages/ai/src/gate.ts:26–34`, `packages/ai/src/redact.ts`, `apps/api/src/trpc/routers/ai.ts`.
- **Defects:**
  - `isAiEnabled()` evaluates to `true` whenever an API key is present, rather than requiring explicit feature opt-in.
  - Redaction patterns fail to catch Spanish/Catalan phone numbers (e.g., `93 123 45 67`), DNI/NIE identifiers, street addresses (`Carrer de Mallorca`), or school names (`IES Joan Miró`).
  - Redaction exhibits false positives on numeric ranges (e.g., `pages 120 150` redacted as `[phone]`).
  - No per-user daily token or call quotas exist; `adviseReplan` accepts unbounded contextual arrays.
- **Fix:** Invert AI gating to require `AI_ENABLED === "true"`; implement ES/CA PII regexes and reversible person name placeholders; enforce a hard cap of 30 AI requests per day per adult user.

---

### 2.9 NLP Parsing & Internationalization (P1)

- **Location:** `packages/nlp/src/parser.ts`, `packages/nlp/src/datetime.ts`, `packages/nlp/src/recurrence.ts`.
- **Defects:**
  - Lexicon is English-only. In Spanish/Catalan, common input `Estudiar demà a les 17h` extracts an estimate of 1,020 minutes (`17h`) instead of setting a 17:00 due time.
  - Slashes in dates (`3/11`) default to US Month/Day format (March 11) rather than European Day/Month (November 3).
  - Hashtag extraction (`TAG_RE = /#(\w+)/g`) breaks on Unicode accented characters (`#matemàtiques` truncated to `matem`).
  - Recurrence parser emits `COUNT`, but `nextOccurrence()` ignores it, causing finite series to recur forever.
- **Fix:** Introduce locale-aware lexicons (`en`, `es`, `ca`); default date slashes to D/M for ES/CA locales; update tag regex to `/#([\p{L}\p{N}_-]+)/gu`; support `COUNT` termination in recurrence expansion.

---

### 2.10 UI/UX, Typography, Motion & Accessibility (P1–P2)

- **Location:** `packages/ui/src/tokens/theme.ts`, `packages/ui/src/tokens/motion.ts`, `apps/mobile/src/components/`.
- **Defects:**
  - **WCAG 2.x Contrast Failures (P1):**
    - Light `accentAlt` timber (`#C08A4E`) on paper (`#FAF7F2`): 2.81:1 (fails AA).
    - Light `breach` (`#D4761F`) on paper: 3.07:1 (fails AA).
    - `breach` on `breachSoft` (`#FBEBDB`): 2.81:1 (fails AA).
    - Dark `onPrimaryMuted` (`#B9C4BD`) on pine (`#2E5A46`): 4.38:1 (fails AA).
    - "Shou Sugi Ban" pickets on dark focus background: 1.24:1 (illegible).
  - **Token Bypass (P1):** Spacing token is imported nowhere; ~200 raw `fontSize` literals and ~290 raw `<Text>` components bypass `Txt`, losing Dynamic Type scaling and tabular numerals.
  - **Underdamped Spring Physics (P1):**
    - `latch` spring (damping: 11, stiffness: 380, mass: 0.8) yields damping ratio $\zeta = 0.32$, causing the latch to visibly wobble 3 times instead of catching.
    - `picket` spring ($\zeta = 0.43$) exhibits 22% overshoot, bouncing through bottom rails.
  - **Silent Mode Sound Leak (P0 for Schools):** `ensureAudioMode()` configures `playsInSilentMode: true` on the first played sound. Mechanical clicks and knocks play out loud even when a student's phone is switched to silent in class.
  - **Stale Reduce-Motion Listeners (P1):** `useReducedMotion()` is read once on component mount, ignoring runtime accessibility changes.
- **Fix:** Add `timberInk` (`#8A5A22`) and `breachInk` (`#A5520F`); retune latch spring with `overshootClamping: true`; split audio modes into `SFX_MODE` (`playsInSilentMode: false`) and `FOCUS_MODE` (`playsInSilentMode: true`).

---

## 3. Differentiating Product Moat (Unimplemented Roadmap)

Fenced’s competitive moat relies on uniting three signals that competitors isolate:
1. **Tasks** (estimates, priorities, dependencies)
2. **Calendar** (real free/busy windows, classes)
3. **App Blocking** (reaches, shield hits, completed focus)

The following eight features are specified for implementation across compliance tiers:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             DIFFERENTIATING MOAT FEATURES                              │
├──────┬──────────────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│ #    │ Feature Name         │ Child (<13) │ Teen (13-17)│ Adult (18+) │ Cross Signals  │
├──────┼──────────────────────┼─────────────┼─────────────┼─────────────┼────────────────┤
│ F1   │ Load-Aware Fences    │ Guardian min│ Self-chosen │ Full + AI   │ Tasks × Block  │
│ F2   │ Deadline Gravity     │ On-device   │ On-device   │ Full + Cal  │ Tasks × Cal    │
│ F3   │ The Fence Yard       │ Local only  │ Anon export │ Full export │ Block × Prog   │
│ F4   │ Co-Focus Circles     │ Family only │ Minor-only  │ Open Circle │ Social × Block │
│ F5   │ Rebuild the Day      │ On-device   │ On-device   │ Full + AI   │ All 3 Signals  │
│ F6   │ Class Mode           │ Guardian set│ Self-set    │ Meeting Mode│ Cal × Block    │
│ F7   │ Reach Map            │ Local only  │ Synced self │ Full + Coach│ Block × Tasks  │
│ F8   │ The Family Pact      │ Primary     │ Ally mode   │ N/A         │ Guardian × All │
└──────┴──────────────────────┴─────────────┴─────────────┴─────────────┴────────────────┘
```

- **F1: Load-Aware Fences:** Evaluates task cognitive demand (estimate, priority, due proximity) to suggest an appropriate fence height: *Rail* (minimal distractions), *Picket* (standard), or *Palisade* (strict blocking + browser lockdown).
- **F2: Deadline Gravity:** Works backward from deadlines to automatically allocate and fence protected study blocks in genuine calendar gaps without countdown pressure.
- **F3: The Fence Yard:** Skia-rendered tactile garden that grows permanent fence sections for completed focus sessions. Zero tree-decay or streak-shaming mechanics.
- **F4: Co-Focus Circles:** Ephemeral body-doubling circles (2–8 peers) sharing real-time gate latch states via Server-Sent Events with zero text chat or profile discovery.
- **F5: Rebuild the Day:** One-tap day replanning when schedules slip, fitting remaining work into the user’s historical peak-energy focus windows.
- **F6: Class Mode:** Automatic calendar-driven app shielding triggered by school timetables without manual intervention.
- **F7: Reach Map:** 7×24 non-shaming heatmap of shield reaches, identifying distraction-prone times and subjects.
- **F8: The Family Pact:** Transparent co-managed focus agreement between guardian and child, establishing shared homework hours and guaranteed emergency passes without surveillance.

---

## 4. Prioritised Roadmap & Action Plan

### 4.1 Quick Wins (Q1–Q17: Immediate)
*Low effort (≤ 1 day each), high compliance, reliability and sensory return.*

| # | Item | Location | Target Result | Status |
|---|---|---|---|---|
| **Q1** | Enforce `revokedAt` in consent check | `apps/api/src/trpc/routers/user.ts:58–72` | Revoked parental consent immediately disables sync. | **Shipped** (Verified in unit tests) |
| **Q2** | Block client-asserted escalation & remove pre-fill | `user.ts:113, 228`, `profile/age-band.tsx:27` | Escalations require verifiable proof; remove 2008 pre-fill. | **Shipped** (Verified in unit tests) |
| **Q3** | Fail closed on unknown age bands | `packages/policy/src/feature-access.ts:75` | Unknown band returns `false`. | **Shipped** (Verified in unit tests) |
| **Q4** | Secure cron endpoints | `apps/api/src/index.ts:86–115` | Return HTTP 503 if `CRON_SECRET` is unset; use `timingSafeEqual`. | **Shipped** (Verified in unit tests) |
| **Q5** | Install tRPC error formatter | `apps/api/src/trpc/init.ts` | Mask database queries and parameters from error responses. | **Shipped** (Verified in unit tests) |
| **Q6** | Fix Google 403 error classification | `apps/api/src/integrations/google-calendar.ts:50` | Treat 403 as rate-limit backoff, not auth revocation. | **Shipped** (Verified in unit tests) |
| **Q7** | Isolate silent-switch audio mode | `apps/mobile/src/lib/sound-engine.ts:33` | Sound effects respect the hardware silent switch. | **Shipped** (Verified in unit tests) |
| **Q8** | Disable streak alerts by default | `apps/mobile/src/lib/local-store.ts:175` | Remove loss-framed notifications; hide from minors. | **Shipped** (Verified in unit tests) |
| **Q9** | Eliminate IP spoofing | `apps/api/src/rate-limit.ts:51` | Stop trusting client-provided `x-real-ip`. | **Shipped** (Verified in unit tests) |
| **Q10** | Make sandbox blocking honest | `native/fenced-blocking/src/index.ts:222` | Return `"unavailable"` instead of `"approved"`. | **Shipped** (Verified in unit tests) |
| **Q11** | Retune spring damping & clamp latch | `packages/ui/src/tokens/motion.ts:23` | Clamped travel, zero wobble, trigger cues on catch. | **Shipped** (Verified in unit tests) |
| **Q12** | Fix WCAG contrast failures | `packages/ui/src/tokens/theme.ts` | Add `timberInk` (#8A5A22) and `breachInk` (#A5520F). | **Shipped** (Verified in unit tests) |
| **Q13** | Invert AI enablement gate | `packages/ai/src/gate.ts:26` | Require explicit `AI_ENABLED === "true"`. | **Shipped** (Verified in unit tests) |
| **Q14** | Fix NLP tag & estimate regexes | `packages/nlp/src/parser.ts:6, 8` | Unicode tags and prevent `17h` from parsing as 1020m. | **Shipped** (Verified in unit tests) |
| **Q15** | Resolve Expo SDK version mix | `apps/mobile/package.json` | Align packages to Expo SDK 54. | **Shipped** (Verified in unit tests) |
| **Q16** | Disarm outbox 1s hot loop | `apps/mobile/src/lib/sync/engine.ts:105` | Halt outbox retry timer when unauthenticated or paused. | **Shipped** (Verified in unit tests) |
| **Q17** | Memoise API client on base URL | `apps/mobile/src/lib/api.tsx:19` | Prevent full-sync thrashing on Clerk token refresh. | **Shipped** (Verified in unit tests) |

---

### 4.2 Core Architectural Refactors (R1–R15: Weeks 2–6)
*Medium effort (2–5 days each), resolving structural integrity and data durability.*

- [x] **R1: Minor Flag & Policy Tri-State:** Introduced `isMinor` (< 18); server schema enforces minor status and `NEVER_FOR_MINOR`.
- [x] **R2: VPC Vendor Webhook:** Built `POST /webhooks/vpc` with HMAC signature validation; wired up real-time guardian consent status and revocation.
- [x] **R3: Retention Automation & Cron Definitions:** Added cron workers to `render.yaml`; secured statutory data pruning with constant-time token verification.
- [x] **R4: Root SessionRuntime:** Moved session lifecycle and timer ticks out of `session.tsx` into a root-level headless service with local notification and AppState reconciliation.
- [ ] **R5: SQLite Storage Migration:** Replace the monolithic AsyncStorage JSON blob with `expo-sqlite`, writing entity updates and outbox ops in single transactions.
- [ ] **R6: Sync Protocol Keyset & Versions:** Add `version` and `deleted_at` tombstones; replace offset pagination with keyset cursors.
- [x] **R7: Outbox Merge Race Elimination:** Implemented `pendingCreates` map to eliminate duplicate rows on concurrent pull/push.
- [x] **R8: Idempotent Calendar Push & SingleEvents:** Added atomic lease locks to `syncConnection()`; queried Google with `singleEvents: "true"`.
- [x] **R9: PKCE OAuth Flow & Feed Token Hashing:** Stored feed tokens as SHA-256 hashes; implemented PKCE with single-use authorization nonces.
- [x] **R10: Database Integrity Hardening:** Added composite indexes for tasks/sessions/connections; added cycle detection in `setBlockedBy`; bounded zod schemas.
- [x] **R11: Multilingual NLP (ES/CA):** Implemented Spanish and Catalan date/time lexicons; fixed recurrence `COUNT` expansion.
- [x] **R12: Scheduler Optimization:** Implemented earliest-fit for deadlines, slack sorting for priorities, and topological dependency ordering.
- [x] **R13: Component Token Audit:** Retuned tokens; implemented pan-to-dismiss gesture on bottom sheets.
- [x] **R14: European PII Redactor v2:** Built comprehensive DNI, NIE, IBAN, ES/CA phone, and school name redactors.
- [x] **R15: Session Screen Re-render Isolation:** Decoupled 1-second clock updates from the main `session.tsx` view tree.

---

### 4.3 Strategic Initiatives (S1–S10: Quarter Scale)
*High effort / High moat impact.*

- [x] **S1: Native Blocking Engine Phase 1:** Full `NativeFencedBlocking` interface matching the §3.5 contract and honest sandbox capabilities.
- [x] **S2: Feature 6 — Class Mode:** Link school timetable events to automated background fence schedules (`class-rules.ts`).
- [x] **S3: Feature 1 — Load-Aware Fences:** Dynamic fence height selection based on task workload scores (`load-score.ts`).
- [x] **S4: Feature 2 — Deadline Gravity:** Back-schedule automated focus reservations leading up to major deadlines (`schedule/gravity.ts`).
- [x] **S5: Feature 5 — Rebuild the Day:** Energy-aware replanning adjusting slipped tasks to peak focus windows (`schedule/energy.ts`).
- [x] **S6: Feature 7 — Reach Map:** 7×24 non-shaming heatmap of shield hits and focus intervals (`stats.ts`).
- [x] **S7: Feature 3 — The Fence Yard:** Focus garden tracking completed pickets and durability (`yard.ts`).
- [x] **S8: Feature 8 — The Family Pact:** Co-managed guardian-child focus agreements and verification (`schemas/pact.ts`).
- [x] **S9: Feature 4 — Co-Focus Circles:** Minor-safe presence protocol for mutual study accountability (`co-focus.ts`).
- [ ] **S10: Google Push Notifications:** Implement webhook push channels (`events.watch`) replacing periodic polling.

---

### 4.4 Sequencing & Impact Matrix

```
                 LOW EFFORT                               HIGH EFFORT
            ┌─────────────────────────────────────┬─────────────────────────────────────┐
            │  DO IMMEDIATELY (Quick Wins)        │  STRATEGIC BETS (Plan & Staff)      │
 HIGH       │  Q1 Q2 Q3 Q4  Consent & Band Fixes  │  S1 Native Blocking Engine (Gates)  │
 IMPACT     │  Q5 Error Leakage Masking           │  R1 isMinor Flag  R2 VPC Webhook    │
            │  Q6 403≠Revoked   Q7 Silent Switch  │  R5 SQLite Store  R6 Sync Keyset v2 │
            │  Q8 Streak Nudges Q15 SDK Pin       │  R8 Google Sync Idempotency         │
            │  Q16 Outbox Hot Loop Disarm         │  S4 Deadline Gravity  S8 Family Pact│
            │  R4 Root SessionRuntime             │  R11 Multilingual NLP (ES/CA)       │
            ├─────────────────────────────────────┼─────────────────────────────────────┤
            │  FILL-INS                           │  LATER / ITERATIVE                  │
 LOWER      │  Q9 Q10 Q11 Q12 Q13 Q14 Q17         │  S7 Fence Yard (Skia)               │
 IMPACT     │  R15 Re-render Isolation            │  S9 Co-Focus Circles                │
            │  R9 PKCE & Feed Hashing             │  S10 Google Push Channels           │
            │  R12 Scheduler Deadlines & Slack    │  R13 Typography & Token Linting     │
            └─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 5. Appendix: Legacy Audit Reconciliation & Doc Contradictions

### 5.1 Formal Superseding of `docs/design_audit.md`
`docs/design_audit.md` was conducted against the initial prototype. The following matrix reconciles its historical findings with current engineering reality:

| Historical Finding in `design_audit.md` | Actual Status in Codebase | Resolution |
|---|---|---|
| "No offline sync exists" (§2.4, §3.3) | **Implemented** (`outbox.ts`, `outbox-core.ts`) | Retired. Replaced by active audit items O1–O6. |
| "Timer uses `setInterval` without persistence" (§3.2) | **Implemented** (`session-engine.ts`) | Retired. Replaced by active audit item R4 (`SessionRuntime`). |
| "No rate limiting exists" (§2.3) | **Implemented** (`rate-limit.ts`) | Retired. Replaced by active audit item Q9 (IP spoofing). |
| "Birth data stored on server" (§6) | **Implemented** (Removed from schema) | Retired. Replaced by active audit item B1 (`isMinor`). |
| "Missing Task Detail screen" (§3.5) | **Implemented** (`app/task/[id].tsx`) | Retired. |
| "Missing Projects management" (§3.5) | **Implemented** (`project.ts`, `tasks.tsx`) | Retired. |
| "Missing Calendar event editor" (§3.5) | **Implemented** (`EventSheet.tsx`) | Retired. |
| "Missing Sound synthesis" | **Implemented** (`synth.ts`, `sound-engine.ts`) | Retired. Replaced by active audit item Q7 (Silent switch). |
| "No native blocking code" (§3.1) | **STILL OPEN** (`native/fenced-blocking/`) | Maintained as active priority item **S1**. |
| "No SQLite local database" (§3.4) | **STILL OPEN** (`local-store.ts`) | Maintained as active priority item **R5**. |
| "render.yaml lacks cron jobs" | **STILL OPEN** (`render.yaml`) | Maintained as active priority item **Q4 / R3**. |

### 5.2 Documentation Contradictions Reconciled
- **Guardian Portal:** `06` defines as MVP; `02`/`04` defer to later. **Resolution:** Implemented as a lightweight token-authenticated web page (Feature 8, Step 1).
- **VPC Scope:** `06`/`04` specify US under-13 only; code applies globally to all children. **Resolution:** Retain global child protection; update documentation to match code.
- **Strict Mode Immutability:** `01`/`05` declare strict mode immutable; `09` introduces Emergency Passes. **Resolution:** Emergency passes are retained as an essential minor-wellbeing escape hatch; re-arming is moved to native extension control.
- **Teen Social Features:** `06:90` forbids social features; `06:168` mentions private opt-in. **Resolution:** Permit private, invite-only, minor-only Co-Focus Circles (Feature 4).
