# 10 — Full Audit and Improvement Specification (Reconciled & Verified)

**Status:** authoritative · **Date:** 2026-11-04 · **Baseline:** commit `801b35c` (current working tree).
**Scope:** all monorepo packages (`apps/mobile`, `apps/api`, `packages/{ai,api-client,core,ical,nlp,policy,ui}`, `native/fenced-blocking`), re-verified line-by-line against the actual source on this date.

---

## Executive Summary & Document Reconciliation

This document is the **single source of truth** for the architectural health, compliance posture, open defects, and product roadmap of Fenced.

This revision was produced by re-reading the actual implementation (not relying on prior claims) for every item in the previous audit. Findings:

1. **The overwhelming majority of the previous "Active Audit" items (B1–B7, Q1–Q17, R1–R4, R7–R10, R13–R15, S1–S9 partially, O1, O3, O4) are genuinely implemented and verified in the code.** They have been removed from the open list and are recorded in **Section 1**.
2. **A small number of items remain genuinely open** despite being marked `[x]` in the prior revision — most notably the **native blocking engine is still a pure TypeScript stub** with zero Swift/Kotlin code, and **local storage is still a single AsyncStorage JSON blob**. These are restored to the active list in **Section 2** with corrected evidence.
3. **Section 3** keeps the differentiating moat feature roadmap, cross-checked against source files — nearly all are present as algorithmic modules, though UI wiring/visibility was not independently verified.
4. **Section 4** is a sanitized, re-verified roadmap.
5. **Section 5** adds original code-review observations beyond the prior audit's scope.

---

## Contents

1. [Verified Shipped Baseline](#1-verified-shipped-baseline--what-has-already-been-implemented)
2. [Active Audit — What is NOT Yet Improved](#2-active-audit--what-is-not-yet-improved)
   - 2.1 [Native Blocking Engine Stub (P0 — Core Blocker)](#21-native-blocking-engine-stub-p0--core-blocker)
   - 2.2 [Storage Durability & Data Loss Risk (P0)](#22-storage-durability--data-loss-risk-p0)
   - 2.3 [Sync Protocol — Remaining Concurrency Gaps (P1)](#23-sync-protocol--remaining-concurrency-gaps-p1)
   - 2.4 [AI Runtime — Remaining Gap: No Per-User Quota (P2)](#24-ai-runtime--remaining-gap-no-per-user-quota-p2)
   - 2.5 [Scheduling Engine — No Wellbeing Daily Caps (P1)](#25-scheduling-engine--no-wellbeing-daily-caps-p1)
   - 2.6 [NLP — Locale Date Ambiguity (P2)](#26-nlp--locale-date-ambiguity-p2)
   - 2.7 [UI/UX & Accessibility — Stale Reduce-Motion Listener (P2)](#27-uiux--accessibility--stale-reduce-motion-listener-p2)
   - 2.8 [Backend — Google Push Notifications Not Implemented (P2)](#28-backend--google-push-notifications-not-implemented-p2)
3. [Differentiating Product Moat](#3-differentiating-product-moat)
4. [Prioritised Roadmap & Action Plan](#4-prioritised-roadmap--action-plan)
5. [Code Review Notes — Opportunities Beyond the Original Audit](#5-code-review-notes--opportunities-beyond-the-original-audit)

---

## 1. Verified Shipped Baseline — What Has Already Been Implemented

The following were re-verified directly against source on 2026-11-04 by reading the actual files (not trusting prior documentation):

### 1.1 Youth Compliance & Policy
- **`isMinor` tri-state model** — `packages/policy/src/age-band.ts` exports `isMinor(age)` and splits `resolveAgeBand` (child/teen/adult, purely age-based) from `resolveConsentBand` (jurisdiction-aware consent age). `feature-access.ts` defines `NEVER_FOR_MINOR` (all `llm-*`, `product-analytics`, `marketing-email`, `calendar-feed-publish`, `location-zones`) and `canAccess()` **fails closed** on unknown bands: `if (!VALID_BANDS.has(ageBand)) return false;`.
- **Escalation hardening** — `apps/api/src/trpc/routers/user.ts`: both `ensureProfile` and `updateAgeBand` block upward band changes (`isEscalation()`) unless `activeConsent()` returns a verified, unrevoked consent row; otherwise throws `BAD_REQUEST`.
- **Consent lifecycle correctness** — `apps/api/src/consent.ts`: `isConsentActive()` requires `grantedAt && !revokedAt` on the **most recent** event (`ORDER BY createdAt DESC LIMIT 1`), so a guardian revocation is honoured immediately.
- **VPC webhook** — `apps/api/src/app.ts` implements `POST /webhooks/vpc` with HMAC-SHA256 signature verification (`crypto.timingSafeEqual`), a 5-minute replay window, and `vendorRef` deduplication via a unique DB index. Covered by `apps/api/src/__tests__/vpc-webhook.test.ts`.
- **Cron security** — `verifyCronAuth()` in `app.ts` returns HTTP 503 when `CRON_SECRET` is unset and does a constant-time comparison otherwise. `render.yaml` declares three `type: cron` services (`fenced-cron-streak-rollover`, `fenced-cron-retention`, `fenced-cron-calendar-sync`) wired to the same secret.
- **PII-before-consent guard** — `ensureProfile` discards `displayName`/`email` server-side (`needsGuardianConsent ? "You" / null`) until consent is active, regardless of what the client sends.

### 1.2 Local-First Sync Outbox & Merge Engine
- `apps/mobile/src/lib/sync/{outbox-core.ts,outbox.ts,merge.ts,engine.ts}` — coalesced upserts (same-entity edits collapse to one op via `enqueueOp`), idempotent client-generated UUIDs (`clientId`), exponential backoff with jitter (`backoffMs`), dependency-ordered flush (`fence → project → task → calendarEvent → fencedHour → session`).
- **In-flight create duplication (O1) fixed** — `mergeRemote()` accepts `pendingCreates: ReadonlyMap<string,string>` and adopts the in-flight local row by `clientId` instead of minting a duplicate when a pull overtakes a create.
- **Default fence duplication (O3) fixed** — `pullFences()` explicitly keeps exactly one default fence, preferring the server's, discarding a second local-only default.
- **Outbox hot-loop (O4) fixed** — `armRetryTimer()` in `engine.ts` returns immediately when `!cfg.canSync()` (unauthenticated / guardian-pending), eliminating the unconditional 1 s retry loop.

### 1.3 Session Engine, Emergency Passes, Audio & Haptics
- Wall-clock `session-engine.ts` plus a root-level headless `session-runtime.tsx` (mounted once in `app/_layout.tsx`, confirmed via grep) drive phase transitions independent of any single screen's mount lifecycle; `ActiveSessionBanner` persists across navigation stacks.
- `sound-engine.ts` splits `SFX_MODE` (`playsInSilentMode: false`) from `FOCUS_MODE` (`playsInSilentMode: true`) and switches between them — mechanical click/knock SFX now respect the hardware silent switch; only intentional ambient focus sound plays through silent mode.
- `packages/ui/src/tokens/motion.ts`: `latch` spring sets `overshootClamping: true` with retuned `damping: 25, stiffness: 700`; `picket` retuned to `damping: 26, stiffness: 520` for a small, controlled overshoot instead of visible wobble.

### 1.4 Fence UI, Core Screens, Projects
- `FenceAssemblyView.tsx`, four fence materials in `packages/ui/src/tokens/fence-styles.ts`, `GateLatchSlider.tsx`, `FenceLineStreakBanner.tsx`, `GateBreather.tsx`, full Task Detail (`app/task/[id].tsx`), Projects router (`project.ts`) + UI in `tasks.tsx`, `EventSheet.tsx`, calendar agenda in `(tabs)/calendar.tsx` — all present and wired into navigation.

### 1.5 Backend Security & Data Integrity
- `apps/api/src/trpc/init.ts`: tRPC `errorFormatter` masks internal messages (`error.code === "INTERNAL_SERVER_ERROR" ? "Internal server error" : shape.message`), only ever surfaces `ZodError.flatten()` for validation failures — no raw SQL/parameter leakage to clients.
- `apps/api/src/rate-limit.ts`: `clientIp()` reads the **right-most** `X-Forwarded-For` entry (the one appended by Fenced's own reverse proxy), which cannot be spoofed by a client prepending fake entries. The old `x-real-ip`-trusting code is gone.
- `apps/api/src/trpc/routers/task.ts`: `setBlockedBy` does cross-tenant ownership checks (`owned` set derived from `inArray(tasks.id, ids)` filtered by `userId`) **and** cycle detection via BFS over existing + proposed dependency edges before committing — this closes both the cross-tenant FK and the deadlock risk called out in the original audit.
- `apps/api/src/db/schema.ts`: composite indexes exist for `tasks(userId, completedAt)`, `tasks(userId, projectId)`, `tasks(userId, updatedAt)`, `tasks(userId, dueAt, completedAt)`; unique indexes on `task_dependencies(taskId, dependsOnTaskId)` and `calendar_events(connectionId, externalId)`.
- `token-crypto.ts` (AES-256-GCM with random 96-bit IVs), calendar feed tokens stored only as `tokenHash` (SHA-256, plaintext never persisted or queried), stateless signed OAuth `state` with single-use nonce enforcement in `oauth-state.ts`.

### 1.6 Calendar Sync Robustness
- `calendar-sync.ts`: `syncConnection()` acquires a **lease lock** (`leaseUntil`/`leasedBy`, 120 s TTL, atomic conditional `UPDATE ... WHERE leaseUntil IS NULL OR leaseUntil < now`) before pulling/pushing — this is what actually fixes the "non-idempotent push" race from concurrent workers, not just intra-request ordering.
- `google-calendar.ts`: `GoogleApiError.isAuthRevoked` is scoped to **401 only**; `isRateLimited` separately covers 403/429 — a Google quota spike no longer permanently disables a calendar connection.
- `applyPulledPage()` implements last-write-wins keyed off `extendedProperties.private.fencedEventId` (an owner marker) so an echo of Fenced's own push never reverts a newer local edit.

### 1.7 AI Runtime Gating, Redaction & Payload Bounds
- `packages/ai/src/gate.ts`: `isAiEnabled()` requires `AI_ENABLED === "true"` **and** a provider key present — correct default-deny instead of "any key present enables it".
- `packages/ai/src/redact.ts`: ES/CA-aware phone regex, DNI/NIE, IBAN, address (`Calle/Carrer/Avinguda/Plaça`), and school name (`IES/CEIP/Col·legi/Institut`) redactors are all present and applied inside every `minimise*Payload` helper.
- Input schemas (`ReplanSummaryInputSchema.unplaced` capped `.max(30)`, `PlanningChatInputSchema.messages` capped `.max(12)`, ambiguities capped `.max(6)`) are explicitly bounded — the previously reported "unbounded contextual arrays" defect no longer exists.

### 1.8 Scheduling Engine
- `packages/core/src/schedule/time-block.ts`: `findBestGap()` does **earliest-fit for deadline-bound tasks** (scans gaps in order, picks first one starting before the due time), falling back to best-fit only for undated tasks — same-day deadlines are no longer broken by best-fit packing.
- `compareTasks()` sorts by due date first, then priority rank, then estimate size.
- `auto-schedule.ts` / `setBlockedBy` (API) both implement correct dependency-chain handling: a task blocked only by an already-completed or already-scheduled-earlier dependency is not spuriously treated as blocked forever, and a cycle is rejected server-side before it can deadlock the scheduler.

### 1.9 NLP Parsing & Partial Internationalization
- `packages/nlp/src/parser.ts`: `TAG_RE = /#([\p{L}\p{N}_-]+)/gu` now matches Unicode letters, fixing `#matemàtiques` truncation.
- Time extraction (`extractTime`) explicitly runs before estimate extraction, with Spanish/Catalan prepositions (`a les`, `a las`) recognized, so `"17h"` used as a time is no longer misparsed as a 1,020-minute estimate.
- `packages/nlp/src/datetime.ts`: full Spanish/Catalan day names, month names, and relative terms (`hoy/avui`, `mañana/demà`, `pasado mañana/demà passat`) are implemented and matched with Unicode-aware boundaries.
- `packages/nlp/src/next-occurrence.ts`: `COUNT` is now respected via the `occurrenceIndex` parameter threaded from `local-store.ts`'s `toggleTask()` — finite recurring series correctly terminate instead of recurring forever.

### 1.10 UI/UX, Typography, Motion & Accessibility
- `packages/ui/src/tokens/theme.ts`: `timberInk` (`#8A5A22`) and `breachInk` (`#A5520F`) accessible ink roles are defined and used for icon/text cases that previously failed WCAG AA on `accentAlt`/`breach`.
- Raw `fontSize` literals have been reduced to a single remaining instance (`EventSheet.tsx:fontSize: 17`) — a near-complete migration onto the `Txt` component system for Dynamic Type scaling.
- `Q7` (silent-mode leak) and `Q11` (spring wobble) — see §1.3 above.

### 1.11 Differentiating Moat — Algorithmic Modules Present
All eight moat features have a corresponding implementation module, confirmed by file listing:
`packages/core/src/load-score.ts` (F1), `packages/core/src/schedule/gravity.ts` (F2), `apps/mobile/src/lib/stats.ts::computeReachMap` (F7, tested in `stats.test.ts`), `packages/core/src/yard.ts` (F3), `packages/core/src/co-focus.ts` (F4), `packages/core/src/schedule/energy.ts` (F5), `packages/core/src/class-rules.ts` (F6), `packages/core/src/schemas/pact.ts` (F8). **Note:** this audit verified the algorithmic/schema layer exists and is unit-tested (`__tests__/moat-features.test.ts`); it did **not** independently verify that every feature is fully wired into production screens end-to-end — a follow-up UI audit is recommended before claiming full feature completeness to stakeholders.

---

## 2. Active Audit — What is NOT Yet Improved

These are the items that genuinely remain open after direct source inspection.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     ACTIVE AUDIT HEALTH SCORECARD (RE-VERIFIED)                  │
├───────────────────────────────┬───────┬─────────────────────────────────────────┤
│ Domain                        │ Grade │ Key Open Risk                           │
├───────────────────────────────┼───────┼─────────────────────────────────────────┤
│ Native App Blocking           │   F   │ TypeScript stub; no Swift/Kotlin code   │
│ Local Storage & Durability    │   D   │ Single AsyncStorage JSON blob persists  │
│ Sync Protocol (versions/dates)│   B-  │ Offset pagination; no version/tombstone │
│ AI Runtime                    │   B+  │ No per-user daily quota enforcement     │
│ Scheduling Algorithms         │   B+  │ No wellbeing daily focus caps by age     │
│ NLP & Internationalization    │   B   │ Slash dates still default to US M/D     │
│ UI/UX & Accessibility         │   B+  │ Reduce-motion read once at mount        │
│ Calendar Push Notifications   │   D   │ No `events.watch` webhook; polling only │
└───────────────────────────────┴───────┴─────────────────────────────────────────┘
```

### 2.1 Native Blocking Engine Stub (P0 — Core Blocker)
- **Location:** `native/fenced-blocking/src/index.ts` (confirmed only file in `native/fenced-blocking/src/`, alongside a stub `.d.ts`).
- **Defect confirmed unchanged:** The module is still a pure TypeScript façade. There is **no Swift, no Kotlin, no Xcode target, no Android service** anywhere in the repository. `getCapabilities()` correctly reports `mode: "sandbox"` when no native module is registered (this part is honest), but the underlying capability genuinely does not exist yet.
  - `requestAuthorization()` falls through to `"unavailable"` in sandbox mode (this is correctly honest, matching the shipped Q10 fix) — but there is still nothing to request authorization *from* once native code exists.
  - `pauseShield()` for the emergency pass still relies on a JS `setTimeout` fallback when no native module is present (`if (n) { ...; setTimeout(...) }`), which remains vulnerable to iOS suspending JS execution in the background.
- **Fix (unchanged from original spec):** Implement iOS FamilyControls (`DeviceActivityMonitor`, `ShieldConfiguration`, `ShieldAction`) and Android `UsageStatsManager`/`OverlayService`. Make native extensions authoritative for schedule boundaries and shield re-arming. Confine `appTokens` to local App Groups; sync only coarse metadata to the server.
- **Correction to prior doc:** The roadmap previously marked `S1: Native Blocking Engine Phase 1` as `[x]` — this is **false** and has been reverted to `[ ]` in §4.

### 2.2 Storage Durability & Data Loss Risk (P0)
- **Location:** `apps/mobile/src/lib/local-store.ts:174` (`STORAGE_KEY = "fenced.app.v3"`).
- **Defect confirmed unchanged:** The entire local state (tasks, projects, fences, calendar events, fenced hours, session history, settings) is still serialized into **one AsyncStorage JSON string** on every mutation (debounced 250 ms). Android's SQLite-backed AsyncStorage still enforces the ~2 MB `CursorWindow` limit as history/tasks/events accumulate.
- **Partial mitigation found:** `hydrateAppState()` now quarantines unparseable JSON to a timestamped `fenced.app.corrupt.<timestamp>` key instead of silently discarding it — this is a real improvement over the original "silently resets to defaults" defect, but it does not address the underlying size-limit or atomicity risk.
- **Fix (unchanged):** Migrate to `expo-sqlite` with relational tables (`tasks`, `events`, `outbox`) and atomic transactions, as specified in `docs/04-tech-stack.md`.
- **Correction to prior doc:** `R5: SQLite Storage Migration` is correctly still marked `[ ]` in the roadmap — this matches reality and required no correction.

### 2.3 Sync Protocol — Remaining Concurrency Gaps (P1)
- **Location:** `apps/mobile/src/lib/sync/merge.ts`, `apps/api/src/trpc/routers/task.ts:list`.
- **O6 (delete inference from truncated paged pulls) — still open.** `fetchAllPages()` in `merge.ts` drains an **offset**-paged endpoint (`page(offset, limit)`), capped at `maxPages = 50`. A user with more than 5,000 rows in one collection (50 pages × 100) would still have trailing rows silently inferred as server-deleted. The underlying `task.list` endpoint orders by `(position, id)` with no cursor — offset pagination under concurrent inserts can also skip or repeat rows mid-scan. This is the same class of defect as the original **R6 (Sync Protocol Keyset & Versions)**, which remains unimplemented: no `version` or `deleted_at` tombstone column exists anywhere in `apps/api/src/db/schema.ts` (confirmed by grep — zero matches for `version`/`deleted_at`).
- **O5 (clock-skew LWW) — still open.** `mergeRemote()`'s `remoteUpdatedAt` comparison (`time(existing.updatedAt) > time(o.remoteUpdatedAt(r))`) still compares the **local device clock's** `updatedAt` against the **server's** `updatedAt`. A device with a fast clock can still cause a local edit to appear newer than it is and overwrite a legitimate server-side change on the next pull.
- **O2 (unflushed state kill window) — likely mitigated but not conclusively verified.** `setRemoteId()` triggers the same debounced `schedulePersist()` (250 ms) as any other mutation; `setActiveSession()` and `recordSession()` both explicitly call `void flushAppState()` immediately, but a plain `setRemoteId()` call (e.g. after a task create ack) does not force an immediate flush. An app kill within that 250 ms window can still strand a local entity without its remote id recorded, causing a duplicate create on next sync. This should be explicitly fixed by flushing immediately after every `setRemoteId()` call, not just session-critical ones.
- **Fix:** Replace offset pagination with keyset cursors (`WHERE (updatedAt, id) > ($1, $2) ORDER BY updatedAt, id`); add a monotonic `version` column (or at minimum compare server-assigned sequence numbers instead of wall-clock timestamps) for LWW; add an explicit `flushAppState()` call inside `setRemoteId()`.

### 2.4 AI Runtime — Remaining Gap: No Per-User Quota (P2)
- **Location:** `apps/api/src/trpc/routers/ai.ts`, `packages/ai/src/gate.ts`.
- **Defect confirmed:** No per-user daily token or request quota exists anywhere in the API layer (`grep` for `dailyQuota`/`aiQuota`/`AI_DAILY` returns zero results). Every `aiRouter` mutation (`parseTask`, `adviseReplan`, `weeklyCoach`, `planningChat`) is gated only by `isAiEnabled()` + `assertLlmAccess()` (adult-only), with no rate or cost ceiling per account. The generic `/trpc/*` rate limiter (100 req/min) is far too permissive to serve as a cost control for LLM calls.
- **Correction to prior doc:** the originally reported "unbounded contextual arrays" defect is **fixed** (see §1.7) — only the quota enforcement itself remains open.
- **Fix:** Add a dedicated quota middleware/table (e.g. `ai_usage_daily(userId, date, count)`) and enforce a hard cap (e.g. 30 requests/day for adults) before invoking any provider.

### 2.5 Scheduling Engine — No Wellbeing Daily Caps (P1)
- **Location:** `packages/core/src/schedule/auto-schedule.ts`, `packages/core/src/schedule/time-block.ts`.
- **Defect confirmed:** Grep across `packages/core` for `focusCap`/`dailyFocusCap`/`maxDailyFocus`/age-banded minute constants returns zero results. Neither `proposeTimeBlocks()` nor `autoSchedule()` accepts or enforces any maximum daily scheduled-minutes parameter. A minor's day can still be packed with an unrealistic number of back-to-back focus blocks if enough tasks/estimates exist.
- **Correction to prior doc:** earliest-fit for deadlines and priority/slack-aware sorting **are** implemented (see §1.8) — only the wellbeing cap is missing.
- **Fix:** Add an `ageBand`-aware `maxDailyMinutes` parameter to `AutoScheduleInput` (e.g. Child: 120, Teen: 180, Adult: 300) and stop placing blocks for a day once the day's scheduled total reaches it, routing the remainder to `unplaced` with a new reason code (e.g. `"daily-cap"`).

### 2.6 NLP — Locale Date Ambiguity (P2)
- **Location:** `packages/nlp/src/datetime.ts:findDate()`, the `slashRe` branch.
- **Defect confirmed:** `const slashRe = /\b(\d{1,2})\/(\d{1,2})\b/;` still parses the first captured number as the **month** (`const month = parseInt(slashMatch[1], 10) - 1;`) unconditionally. For a Spanish/Catalan-locale user, `"3/11"` is parsed as March 11th instead of the intended November 3rd (D/M). No locale parameter is threaded into `extractDate`/`findDate` to flip this.
- **Fix:** Thread a `locale: "en" | "es" | "ca"` parameter through `parseTaskInput → extractDate → findDate`, and swap the capture order (`day/month`) for `es`/`ca` locales.

### 2.7 UI/UX & Accessibility — Stale Reduce-Motion Listener (P2)
- **Location:** `apps/mobile/src/components/{ui/AnimatedPressable.tsx, ui/primitives.tsx, session/GateBreather.tsx, fence/FenceLineStreakBanner.tsx, fence/GateLatchSlider.tsx, fence/FenceAssemblyView.tsx}`.
- **Defect confirmed:** All eight call sites use `const reduce = useReducedMotion();` from `react-native-reanimated`, which is a React Native **Appearance**-style hook that reads the OS setting once per render cycle triggered by its own internal subscription. This is actually Reanimated's standard reactive hook and *should* re-render on OS setting change — so the original audit's claim of "read once on mount, never updates" needs re-testing on-device rather than assumed from source alone. **Recommendation:** verify empirically on a physical device (toggle OS "Reduce Motion" while the app is foregrounded) before prioritizing a fix; if confirmed stale, wrap the hook's result in an `AppState`-triggered re-check similar to the `flushAppState` pattern already used elsewhere in the codebase.
- **Fix (contingent on verification):** If confirmed stale, add an `AppState.addEventListener("change", ...)` re-check or migrate to polling `AccessibilityInfo.isReduceMotionEnabled()` with a change listener.

### 2.8 Backend — Google Push Notifications Not Implemented (P2)
- **Location:** `apps/api/src/integrations/calendar-sync.ts`, `render.yaml`.
- **Defect confirmed:** Grep for `events.watch`/`pushChannel`/`channelId` across `apps/api/src` returns zero results. Calendar sync still relies exclusively on the `fenced-cron-calendar-sync` cron job polling every 15 minutes (`render.yaml`). This is a correct, working design, just not the lowest-latency one.
- **Fix:** Implement Google Calendar `events.watch` webhook channel registration and a corresponding `/webhooks/google-calendar` receiver, falling back to the existing polling cron as a safety net for channel renewal/expiry.

---

## 3. Differentiating Product Moat

Fenced's competitive moat relies on uniting three signals that competitors isolate: **Tasks**, **Calendar**, and **App Blocking**. All eight feature modules listed below were confirmed present in source as of this audit (see §1.11); production UI wiring was not independently re-verified screen-by-screen.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             DIFFERENTIATING MOAT FEATURES                                │
├──────┬──────────────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│ #    │ Feature Name         │ Child (<13) │ Teen (13-17)│ Adult (18+) │ Module          │
├──────┼──────────────────────┼─────────────┼─────────────┼─────────────┼────────────────┤
│ F1   │ Load-Aware Fences    │ Guardian min│ Self-chosen │ Full + AI   │ load-score.ts   │
│ F2   │ Deadline Gravity     │ On-device   │ On-device   │ Full + Cal  │ schedule/gravity│
│ F3   │ The Fence Yard       │ Local only  │ Anon export │ Full export │ yard.ts         │
│ F4   │ Co-Focus Circles     │ Family only │ Minor-only  │ Open Circle │ co-focus.ts     │
│ F5   │ Rebuild the Day      │ On-device   │ On-device   │ Full + AI   │ schedule/energy │
│ F6   │ Class Mode           │ Guardian set│ Self-set    │ Meeting Mode│ class-rules.ts  │
│ F7   │ Reach Map            │ Local only  │ Synced self │ Full + Coach│ stats.ts        │
│ F8   │ The Family Pact      │ Primary     │ Ally mode   │ N/A         │ schemas/pact.ts │
└──────┴──────────────────────┴─────────────┴─────────────┴─────────────┴────────────────┘
```

- **F1: Load-Aware Fences** — evaluates task cognitive demand to suggest Rail/Picket/Palisade fence heights.
- **F2: Deadline Gravity** — works backward from deadlines to allocate protected study blocks in real calendar gaps.
- **F3: The Fence Yard** — permanent garden growth for completed focus sessions, with zero decay/shaming mechanics.
- **F4: Co-Focus Circles** — ephemeral 2–8 peer body-doubling via shared gate-latch state, no chat or discovery.
- **F5: Rebuild the Day** — one-tap replanning fitting remaining work into historical peak-energy windows.
- **F6: Class Mode** — calendar-driven automatic app shielding tied to school timetables.
- **F7: Reach Map** — 7×24 non-shaming heatmap of shield reaches (confirmed implemented and unit-tested).
- **F8: The Family Pact** — transparent co-managed guardian/child focus agreement with guaranteed emergency passes.

---

## 4. Prioritised Roadmap & Action Plan

### 4.1 Quick Wins (Q1–Q17) — Re-verified Status

All 17 quick-win items were re-verified by reading the referenced source files directly. **All 17 are confirmed shipped.**

| # | Item | Verified Evidence |
|---|---|---|
| Q1 | Enforce `revokedAt` in consent check | `consent.ts::isConsentActive` requires `!revokedAt` |
| Q2 | Block client-asserted escalation & remove pre-fill | `user.ts::isEscalation` + `activeConsent()` gate |
| Q3 | Fail closed on unknown age bands | `feature-access.ts::canAccess` returns `false` for invalid bands |
| Q4 | Secure cron endpoints | `app.ts::verifyCronAuth` — 503 if unset, `timingSafeEqual` |
| Q5 | Install tRPC error formatter | `init.ts::errorFormatter` masks internal messages |
| Q6 | Fix Google 403 error classification | `google-calendar.ts::isAuthRevoked` scoped to 401 only |
| Q7 | Isolate silent-switch audio mode | `sound-engine.ts::SFX_MODE` vs `FOCUS_MODE` |
| Q8 | Disable streak alerts by default | `local-store.ts::defaultSettings.notifications.streakAlerts = false` |
| Q9 | Eliminate IP spoofing | `rate-limit.ts::clientIp` uses right-most XFF entry |
| Q10 | Make sandbox blocking honest | `index.ts::requestAuthorization` returns `"unavailable"` in sandbox |
| Q11 | Retune spring damping & clamp latch | `motion.ts::springs.latch.overshootClamping = true` |
| Q12 | Fix WCAG contrast failures | `theme.ts::timberInk`/`breachInk` added |
| Q13 | Invert AI enablement gate | `gate.ts::isAiEnabled` requires explicit `AI_ENABLED==="true"` |
| Q14 | Fix NLP tag & estimate regexes | `parser.ts::TAG_RE` is Unicode-aware; time runs before estimate |
| Q15 | Resolve Expo SDK version mix | `package.json` — all `expo-*` packages aligned to SDK 54 |
| Q16 | Disarm outbox 1s hot loop | `engine.ts::armRetryTimer` early-returns when `!canSync()` |
| Q17 | Memoise API client on base URL | `api.tsx::useMemo(..., [baseUrl])` + token via ref |

### 4.2 Core Architectural Refactors (R1–R15) — Re-verified Status

- [x] **R1: Minor Flag & Policy Tri-State** — `isMinor()` + `NEVER_FOR_MINOR` confirmed.
- [x] **R2: VPC Vendor Webhook** — `POST /webhooks/vpc` confirmed with HMAC + replay + dedup.
- [x] **R3: Retention Automation & Cron Definitions** — `render.yaml` cron services + `verifyCronAuth` confirmed.
- [x] **R4: Root SessionRuntime** — `session-runtime.tsx` mounted at `app/_layout.tsx` root confirmed.
- [ ] **R5: SQLite Storage Migration** — **confirmed still open** (§2.2). Local storage is still a single AsyncStorage JSON blob.
- [ ] **R6: Sync Protocol Keyset & Versions** — **confirmed still open** (§2.3). No `version`/`deleted_at` columns exist; pagination is still offset-based.
- [x] **R7: Outbox Merge Race Elimination** — `pendingCreates` map in `merge.ts` confirmed.
- [x] **R8: Idempotent Calendar Push & Lease Locking** — lease lock in `calendar-sync.ts::syncConnection` confirmed. (Note: `singleEvents` deliberately kept `"false"` to preserve RRULE masters — this is an intentional tradeoff, not an oversight.)
- [x] **R9: PKCE-adjacent OAuth Flow & Feed Token Hashing** — `tokenHash` (SHA-256) + signed single-use-nonce `state` confirmed.
- [x] **R10: Database Integrity Hardening** — composite indexes, cycle detection in `setBlockedBy`, bounded zod schemas all confirmed.
- [~] **R11: Multilingual NLP (ES/CA)** — **partially confirmed.** Day/month names, relative dates, and `COUNT` recurrence termination are implemented; the slash-date `D/M` vs `M/D` locale ambiguity remains open (§2.6).
- [~] **R12: Scheduler Optimization** — **partially confirmed.** Earliest-fit for deadlines and slack/priority sorting are implemented; daily wellbeing focus caps by age band are **not** implemented (§2.5).
- [x] **R13: Component Token Audit** — raw `fontSize` literals reduced to a single remaining instance; `Txt` component adoption is near-complete.
- [x] **R14: European PII Redactor v2** — DNI/NIE/IBAN/ES phone/school name redactors confirmed in `redact.ts`.
- [x] **R15: Session Screen Re-render Isolation** — headless `SessionRuntime` decouples the 1 s clock tick from `session.tsx`'s render tree.

### 4.3 Strategic Initiatives (S1–S10) — Re-verified Status

- [ ] **S1: Native Blocking Engine Phase 1** — **CORRECTED from `[x]` to `[ ]`.** No Swift/Kotlin code exists anywhere in the repository; this was falsely marked shipped in the prior revision. This remains the single highest-priority open item in the entire audit.
- [x] **S2: Feature 6 — Class Mode** — `class-rules.ts` confirmed present.
- [x] **S3: Feature 1 — Load-Aware Fences** — `load-score.ts` confirmed present.
- [x] **S4: Feature 2 — Deadline Gravity** — `schedule/gravity.ts` confirmed present.
- [x] **S5: Feature 5 — Rebuild the Day** — `schedule/energy.ts` confirmed present.
- [x] **S6: Feature 7 — Reach Map** — `stats.ts::computeReachMap` confirmed present and unit-tested.
- [x] **S7: Feature 3 — The Fence Yard** — `yard.ts` confirmed present.
- [x] **S8: Feature 8 — The Family Pact** — `schemas/pact.ts` confirmed present.
- [x] **S9: Feature 4 — Co-Focus Circles** — `co-focus.ts` confirmed present.
- [ ] **S10: Google Push Notifications** — confirmed still open (§2.8).

### 4.4 Sequencing & Impact Matrix (Updated)

```
                 LOW EFFORT                               HIGH EFFORT
            ┌─────────────────────────────────────┬─────────────────────────────────────┐
            │  DO IMMEDIATELY                      │  STRATEGIC BETS (Plan & Staff)       │
 HIGH       │  §2.4 AI daily quota                 │  §2.1 S1 Native Blocking Engine      │
 IMPACT     │  §2.3 flushAppState in setRemoteId   │     (Swift FamilyControls +          │
            │  §2.5 Age-banded daily focus caps    │      Kotlin UsageStatsManager)       │
            │                                       │  §2.2 R5 SQLite Storage Migration    │
            ├─────────────────────────────────────┼─────────────────────────────────────┤
            │  FILL-INS                            │  LATER / ITERATIVE                   │
 LOWER      │  §2.6 D/M locale date parsing         │  §2.3 R6 Keyset pagination + version │
 IMPACT     │  §2.7 Verify reduce-motion listener   │  §2.8 S10 Google events.watch push   │
            └─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 5. Code Review Notes — Opportunities Beyond the Original Audit

Observations made while reading the codebase for this audit that fall outside the scope of the prior document's findings:

### 5.1 `native/fenced-blocking` is the single highest-leverage gap
Every other P0/P1 item in this document is a refinement of a working feature. The native blocking engine is the **only item where the core value proposition of the product — actually blocking distracting apps — does not exist outside of a simulated in-app preview.** Given this is a monorepo-wide audit, it is worth stating plainly: shipping Fenced to real users today means shipping a "Shield Sandbox" that blocks nothing. Prioritizing a minimal native module (even iOS-only `ManagedSettingsStore.shield` without the full `DeviceActivityMonitor` extension) ahead of any other roadmap item would most directly close the gap between documented ambition and shipped reality.

### 5.2 `apps/mobile/src/lib/local-store.ts` mixes concerns that complicate the eventual SQLite migration
The file currently combines: (a) the in-memory state shape, (b) hydration/migration logic, (c) persistence scheduling, and (d) ~30 exported mutator functions that both update state and call `enqueue()` for sync. When R5 (SQLite migration) is tackled, this coupling means every mutator will need simultaneous rewriting. **Recommendation:** before starting R5, extract the sync side-effects (`enqueue(...)` calls) out of the state mutators into a separate subscriber (e.g. a listener on `subscribeAppState` that diffs and enqueues), so the SQLite migration only has to replace the persistence layer, not the sync wiring too.

### 5.3 `packages/core/src/schedule/time-block.ts` — `findBestGap` due-date branch has a latent edge case
When a task has a `dueAt` but every available gap starts *after* the due time, the due-date branch's `for` loop finds nothing and falls through to the general best-fit/largest-gap logic below — this is correct behavior (place it late rather than not at all) but is not documented in a comment, and there is no `"past-due-fit"` reason code to surface to the UI that the task was still placed, just not before its deadline. Consider adding a `PlacementReason` variant for this case so the UI can show a softer warning than a hard miss.

### 5.4 `apps/api/src/integrations/calendar-sync.ts` — lease release has a benign but worth-noting gap
`syncConnection`'s `finally` block releases the lease only `WHERE leasedBy = workerId`, which is correct and prevents a slow worker from releasing a lease acquired by a newer one after a timeout. However, if the process crashes between acquiring the lease and the `finally` block (e.g. an OOM kill), the lease simply expires naturally after 120 s — this is already handled correctly by the `leaseUntil < now` check on acquisition, so no action needed; noted here only because it was verified as a deliberate, correct design rather than an oversight.

### 5.5 `apps/mobile/src/lib/sync/engine.ts` — `fullSync()` pull order comment could drift from code
The comment above `fullSync()` says "parents are pulled first ... then local changes go up, then everything else comes down," which matches the code exactly as read. No defect — flagging only because this ordering is load-bearing (it is what makes O1/O3 fixes work) and should get a unit/integration test asserting the call order, since a future refactor could silently reorder these steps without any type system catching it.

### 5.6 Consider adding a `docs/10a-native-blocking-spec.md` companion
Given §2.1 is the largest remaining gap and requires native iOS/Android work outside this TypeScript monorepo's usual change surface, it would help the next engineer to have a dedicated technical spec (entitlements required, `DeviceActivityMonitor` extension target setup, Expo config plugin wiring for `expo-build-properties`) rather than relying on the prose fix description in this document alone.

### 5.7 Test coverage observed to be good where it exists, but asymmetric
Strong unit test coverage was observed for: `vpc-webhook.test.ts`, `rate-limit.test.ts`, `consent.test.ts`, `auto-schedule.test.ts`, `time-block.test.ts`, `moat-features.test.ts`, `stats.test.ts`. No test files were found for `calendar-sync.ts`'s lease-locking logic or `merge.ts`'s `pendingCreates` adoption path — both are exactly the kind of concurrency-sensitive logic most likely to regress silently. Recommend adding targeted tests for: (a) two concurrent `syncConnection()` calls racing for the same lease, (b) a pull arriving mid-flight of a create for the same local entity.
