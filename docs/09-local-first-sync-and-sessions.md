# Local-first sync, sessions and the shield

How the mobile app keeps data on-device first, syncs it safely, and runs
sessions that survive restarts. Read with `08-theming-and-calendar-sync.md`.

## Store (`apps/mobile/src/lib/local-store.ts`)

- One in-memory state object, persisted to AsyncStorage key `fenced.app.v3`
  (migrates `v2`/`v1` on hydrate). Writes are debounced (250 ms) and
  serialized; `flushAppState()` runs when the app leaves the foreground and
  right after a session starts/ends.
- Components read through `useAppSelector(selector, isEqual?)`
  (`useSyncExternalStore`), so they re-render only when their slice changes.
  `useAppState()` still exists for screens that need everything.
- Progress numbers (week focus, shield hits, fence line, streak) are **derived**
  from `sessionHistory` in `src/lib/stats.ts`, never stored. The old stored
  counters never reset weekly and streaks never decayed.

## Outbox (`src/lib/sync/outbox*.ts`, `engine.ts`)

Every store mutation of a synced entity (task, project, fence, calendar event,
fenced hour, session) calls `enqueue(entity, localId, "upsert" | "delete")`.
Screens never call the API to save data, so a screen can't forget to sync
(that was the cause of the zombie-task and toggle bugs).

- **Coalescing:** one op per entity. An upsert carries no payload; it pushes
  whatever the row looks like at flush time.
- **Idempotency:** each op owns a `clientId` UUID that is sent as the server
  `id` on create (`create` endpoints accept an optional `id` and use
  `ON CONFLICT DO NOTHING`). A retried create can't duplicate. Deleting an
  un-acked create targets that `clientId`; `NOT_FOUND` on delete is success.
- **In-flight edits:** `seq` increments on every enqueue, so a completion
  for an older `seq` leaves the op queued instead of dropping the newer edit.
- **Order and retry:** parents flush first (fence → project → task → event →
  hour → session). Backoff runs 2 s → 15 min with jitter.
  `UNAUTHORIZED` / guardian-pending pause the queue, 4xx drops the op
  (reported), anything else retries.
- **Pull merge** (`merge.ts`): rows with pending upserts win, pending deletes
  never resurrect, a newer local `updatedAt` wins and is pushed back, and
  only rows inside the pulled window are treated as deleted remotely.
  Tasks and sessions are paged until exhausted (no 100-row truncation).
- `fullSync()` pulls fences and projects first, so a second device adopts the
  server's default fence instead of creating a duplicate. It then flushes,
  pulls everything else, and flushes again.

## COPPA gate

`syncAllowed()` in `sync/bootstrap.tsx` is the only switch: signed in, age
band known, and `needsGuardianConsent === false`. Until then nothing leaves the
device and edits stay queued locally. The server enforces the same rule:
`authedProcedure` rejects every non-`user.*` route for consent-pending
accounts, and `needsGuardianConsent` is **derived server-side** (never trusted
from the client). Every `child` account needs consent, in every jurisdiction
(`requiresParentalConsent`); this is stricter than §06, by product decision.
Birth month/year are used once on-device and never stored, locally or
remotely (`migrate-v3.mjs` drops the columns).

## Sessions (`session-engine.ts`, `session-actions.ts`)

- `activeSession` is persisted. All timing is wall-clock (`endsAt`,
  `phaseStartedAt`), so a killed app resumes exactly. `advance()` walks past
  every phase boundary crossed while closed (waves: focus/break cycles).
- Strict mode: `strictUnlockRequestedAt` is set once and never moved, so the
  delay can't be restarted or shortened. The Gate Breather shows the
  countdown, and "Leave early" only enables at 00:00.
- Emergency pass: N per ISO week (default 2), lowers the shield for exactly
  180 s, then the native layer re-arms it.
- Shield hits are not shown while the timer runs; they appear only in the
  post-session summary and in Insights.
- Sessions are recorded on finish and pushed via `create → start → complete |
  abandon` with the real client timestamps (server clamps to ±14 days; all
  steps are idempotent).

## Shield (`native/fenced-blocking`)

`getCapabilities().mode` is `"native"` when the Expo module
(`globalThis.expo.modules.FencedBlocking`) is linked; otherwise `"sandbox"`.
Sandbox mode shows a realistic category/app picker (`SANDBOX_CATALOG`) and
`simulateDistraction()`, which drives the in-app Shield Overlay, so the full
flow can be demonstrated in Expo Go. The native contract is the
`NativeFencedBlocking` interface (FamilyControls/ManagedSettings on iOS,
UsageStatsManager on Android, with an `onShieldHit` event).

## Server migration

Run `pnpm --filter @fenced/api db:migrate-v3` (idempotent) or `db:push`. It
drops `users.birth_month/birth_year`, and adds `tasks.checklist`,
`fenced_hours.label` and `fenced_hours.skipped_dates`.
