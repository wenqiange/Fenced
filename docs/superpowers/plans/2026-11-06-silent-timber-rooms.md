# Silent Timber Rooms (Co-Focus Circles & Silent Body Doubling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Silent Timber Rooms brings silent, minor-safe virtual study rooms (Body Doubling) to Fenced. Users can create or join study rooms (e.g. "Selectividad 2026", "Silent University Library") using simple invite codes, seeing who is studying what in real-time with zero harassment vectors (no open chat, no direct messages, no video cameras).

---

## File Structure

```
apps/api/
  src/db/schema.ts                          # Add coFocusCircles, circleMembers tables + relations
  src/trpc/routers/circle.ts                # New circleRouter with list, get, create, join, leave, setPresence
  src/trpc/routers/index.ts                 # Register circleRouter in appRouter
  src/__tests__/circle-router.test.ts       # Backend tests for circle operations and presence privacy

apps/mobile/
  app/profile/circles.tsx                   # Study rooms hub (list, join modal, create modal, global library)
  app/circle/[id].tsx                       # Live Study Room view (study desks, live subjects, collective focus timer)
  app/(tabs)/you.tsx                        # Menu entry for Silent Timber Rooms
  app/_layout.tsx                           # Register circle/[id] and profile/circles routes
  src/lib/local-store.ts                    # Add local circle cache and activeCircleId to session runtime
  src/lib/session-runtime.tsx               # Automatically sync circle presence on session start/complete
```

---

## Tasks

### Task 1: Database Schema for Co-Focus Circles
- [x] Add `coFocusCircles` and `circleMembers` tables in `apps/api/src/db/schema.ts` with Drizzle ORM.
- [x] Add relations for `users`, `coFocusCircles`, and `circleMembers`.
- [x] Export TypeScript types for database rows.

### Task 2: Backend tRPC Router (`circleRouter`) & Unit Tests
- [x] Implement `apps/api/src/trpc/routers/circle.ts` with procedures:
  - `list`: Get user's joined circles with live presence summary via `summarizeCirclePresence`.
  - `get`: Get a single circle with member list (minor-safe fields only).
  - `create`: Create a circle, generate invite code `TIMBER-XXXX`, and add creator.
  - `join`: Join circle by invite code.
  - `leave`: Leave circle.
  - `setPresence`: Broadcast live focus state (`isFocusing`, `currentSubject`, `activeSessionEndsAt`).
- [x] Register `circle` router in `apps/api/src/trpc/routers/index.ts`.
- [x] Create `apps/api/src/__tests__/circle-router.test.ts` testing create, join, presence update, and zero-DM privacy.
- [x] Run `pnpm --filter @fenced/api test` to verify.

### Task 3: Mobile Store Integration & Session Sync
- [x] Update `apps/mobile/src/lib/local-store.ts` to support cached circles and `activeCircleId` in `ActiveSession`.
- [x] In `session-runtime.tsx` / `session.tsx`, broadcast presence to the active circle when a session starts, pauses, or finishes.

### Task 4: Mobile UI - Circles Hub & Live Silent Study Room
- [x] Create `apps/mobile/app/profile/circles.tsx` (Circles Hub):
  - List user's circles.
  - Featured "Fenced Global Library" so solo users always have active peers.
  - "Join with Code" and "Create Circle" modals/sheets.
- [x] Create `apps/mobile/app/circle/[id].tsx` (Live Study Hall):
  - Visual grid of study desks with member avatars and current subject badges.
  - Live pulse indicators for members currently in focus.
  - One-tap "Focus with this Circle" button opening session setup.
- [x] Register routes in `apps/mobile/app/_layout.tsx` and add link in `apps/mobile/app/(tabs)/you.tsx`.

### Task 5: Verification & End-to-End Typecheck
- [x] Run `pnpm --filter @fenced/mobile typecheck` and `pnpm --filter @fenced/api typecheck`.
- [x] Run monorepo test suite `pnpm test`.
- [x] Commit and push to `origin/master`.
