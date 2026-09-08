# Theming and Calendar Interop

Covers three features that landed together: a real dark mode, two-way Google
Calendar sync, and calendar export to other services.

> **Scope note.** [README](README.md) and [Platform Constraints](05-platform-constraints.md)
> originally placed two-way calendar sync *outside* the MVP, on the grounds that
> recurrence expansion, timezones, tombstones and conflict resolution make it a
> project rather than a feature. That call has been reversed by product
> decision, and this document is where those four problems are answered. The
> warning behind the original decision still stands: **a sync bug that
> double-writes a real meeting is unforgivable.** Read the [Conflict model](#conflict-model)
> before changing anything in `calendar-sync.ts`.

---

## 1. Theming

### The problem with the old setup

`profile/appearance.tsx` already offered Paper / Slate / System and persisted
the choice to `settings.theme` — and nothing read it. Every screen imported
`PINE`, `PAPER`, `INK`, `SLATE`, `SAND`, `TIMBER` from `src/lib/theme.ts` and
hard-coded roughly 150 more hex literals inline. The setting was decoration.

### Semantic roles, not brand names

`packages/ui/src/tokens/theme.ts` defines a `ThemeColors` interface of
*semantic roles* and two palettes that satisfy it. Screens consume roles;
nothing outside that file names a brand colour.

The role split that matters most:

| Role | Meaning | Light | Dark |
|---|---|---|---|
| `accent` | ink on a neutral surface — icons, links, emphasis | pine | pale sage |
| `primary` | a *filled* surface | pine | deep pine |
| `onPrimary` | ink on top of `primary` | white | white |

In light mode `accent` and `primary` are the same pine, which is exactly why a
naive migration breaks: substituting one token for both looks correct until you
switch to dark, where pine on near-black fails contrast. So `accent` lifts to a
pale sage while `primary` stays a deep pine that white text still sits on.

The same trap applies to `#FFFFFF`, which was doing two jobs: a card background
(`surface`) and ink on a pine button (`onPrimary`). The migration disambiguated
both by CSS property — a fill property gets the fill role, a colour property
gets the ink role.

Dark values derive from the existing immersive session palette (`colors.focus`)
so a dark-mode app and an in-session screen read as the same product.

### Consuming it

```tsx
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/lib/theme";

export default function Screen() {
  const t = useThemeColors();                        // inline props
  const styles = useThemedStyles(createStyles);      // stylesheet
  return <Ionicons name="moon" color={t.accent} />;
}

// Module scope — a factory recreated per render would miss the sheet cache.
const createStyles = (t: ThemeColors) =>
  StyleSheet.create({ container: { backgroundColor: t.bg } });
```

`ThemeProvider` (in `_layout.tsx`, inside `ApiProvider`) resolves
`settings.theme` against `useColorScheme()` and publishes the palette.
`useThemedStyles` memoises `StyleSheet.create` per `(factory, scheme)`, so
flipping the theme reuses sheets rather than allocating a new one per render.

The default preference is now **`system`**, changed from `paper`. A new
dark-mode feature that ignores the device setting until you find the screen is
the wrong default.

### Two deliberate exceptions

- **`app/session.tsx`** keeps importing `colors.focus` directly. The immersive
  session screen is always dark by design; it is not theme-dependent.
- **`onPrimaryMuted`** exists for the one card that sits on `primary` in both
  schemes and needs a secondary ink that works on pine either way.

---

## 2. Google Calendar sync

### Shape

```
mobile  ──tRPC──▶  API  ──REST──▶  Google Calendar v3
   │                │
   │                └── calendar_connections (encrypted tokens, sync cursor)
   │                    calendar_events      (source + external_id + etag)
   │                    calendar_sync_tombstones
   │
   └── AsyncStorage local store  ◀── sync/calendar.ts mirrors API → device
```

Server-side OAuth rather than device-native calendar access, so a link works
identically on iOS, Android and a future web client, and so incremental sync
tokens live somewhere durable. There is no `googleapis` dependency — six
endpoints over `fetch` in `integrations/google-calendar.ts`.

Note the last hop: the Calendar tab reads the **local** store, not the API. A
provider pull that stops at the server is invisible in the app, so
`src/lib/sync/calendar.ts` mirrors API events into the local store on bootstrap
and after any manual sync.

### Setup

1. Google Cloud console → enable the **Google Calendar API**.
2. Credentials → **OAuth client ID** → type *Web application*.
3. Add the redirect URI exactly: `$API_PUBLIC_URL/oauth/google/calendar/callback`
4. Fill in `.env` (see `.env.example` for the full block):
   - `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `API_PUBLIC_URL` — must be reachable by Google, so not `localhost` in production
   - `CALENDAR_TOKEN_KEY` — 32 bytes; the server **refuses to store tokens without it**
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
   - `APP_OAUTH_RETURN_URL` — must match the app's `openAuthSessionAsync` return
     URL. Expo Go needs the `exp://…/--/calendar-connected` form.
5. Apply the schema: `pnpm -C apps/api db:push`
6. Schedule `POST /api/cron/calendar-sync` (Bearer `CRON_SECRET`) — hourly is fine.

**Verification lead time.** Calendar scopes are *sensitive*, so Google requires
OAuth verification plus brand review before the consent screen leaves testing
mode — weeks, per [Platform Constraints](05-platform-constraints.md#google-calendar).
Unverified clients work for a handful of test users. Start verification early.

### Conflict model

Two-way sync without vector clocks needs an ownership rule that is stated
rather than emergent. Ours:

- **`source = 'google'`** — the provider owns it. Pulled in, never written back.
- **`source = 'local'`** — Fenced owns it. Pushed out; `external_id` records
  where it was mirrored.

That asymmetry is what stops the two directions echoing each other. On push we
stamp `extendedProperties.private.fencedEventId` on the Google event; on pull,
an event carrying that stamp is recognised as an echo of our own write and is
applied **only if Google's `updated` is newer than our `updated_at`** —
last-write-wins by timestamp, so a stale echo cannot revert a local edit.

Four failure modes and their answers:

| Problem | Answer |
|---|---|
| **Deletions** | A local delete destroys the only row holding the provider id. `calendar_sync_tombstones` records it first; the next push deletes it at Google, then clears the tombstone. A provider-side delete arrives as `status: cancelled` (hence `showDeleted=true`). |
| **Expired cursor** | Google answers **410 GONE** when a `syncToken` is too old. The pull clears the token and restarts once from a full window, rather than failing. |
| **Timezones / DST** | All-day bounds are stored in Google's own **exclusive-end** form. Recurring Fenced Hours are exported as *floating* times (no `Z`, no `TZID`) so `14:00 weekdays` stays 14:00 across a DST change without shipping a `VTIMEZONE`. |
| **Idempotency** | A partial unique index on `(connection_id, external_id)` makes a replayed page an upsert, not a duplicate. Deleting an already-gone event treats 404/410 as success. |

**Recurring events** are pulled with `singleEvents=false`, so a series arrives
as one row with its `RRULE` rather than hundreds of instances. Rows whose shape
cannot be parsed are skipped rather than stored half-formed.

### What is not synced to Google

**Fenced Hours.** They are recurring schedules in a separate table and pushing
them would need a second set of external-id bookkeeping. They *are* published
through the ICS feed, where a read-only feed needs no bookkeeping at all. If
they should be pushed to Google later, the `RRULE` builder already exists in
`@fenced/ical` (`weeklyRule`) — the work is the id tracking, not the recurrence.

### Security

- **Tokens encrypted at rest** with AES-256-GCM (`integrations/token-crypto.ts`).
  GCM, not CBC, because tamper detection matters: a swapped ciphertext must fail
  to open, not decrypt to attacker-chosen bytes. A missing `CALENDAR_TOKEN_KEY`
  is fatal in *every* environment — a silent plaintext fallback would make a dev
  misconfiguration indistinguishable from a working setup until it shipped.
- **Signed OAuth `state`** (HMAC-SHA256, 10-minute TTL) instead of a
  pending-flow table. Without a signature, anyone could complete a flow against
  another user's id.
- **Tokens never leave the server.** Every procedure returning a connection
  projects an explicit column list; `publicConnectionColumns` omits
  `access_token_enc`, `refresh_token_enc` and `sync_token`. Do not replace it
  with `select()`.
- **Ownership on every mutation** — `ownedConnection()` filters by `userId`, so
  a guessed connection id cannot be operated on across accounts.
- **Revoked grants pause themselves.** A 401/403 sets `sync_enabled = false`, so
  the cron stops hammering Google and the broken state becomes visible in
  settings.
- **Disconnect deletes pulled events** and clears provider ids from local ones,
  so nothing of the user's Google calendar lingers in Fenced afterwards.

### Age banding

See [Under-16 Compliance](06-youth-compliance.md). Two new features in
`@fenced/policy`:

| Feature | child | teen | adult | Why |
|---|---|---|---|---|
| `external-calendar-sync` | ✗ | ✓ | ✓ | Linking a provider account moves a child's schedule off-device — the processing COPPA puts behind verifiable parental consent. A teen's own account is theirs to link. |
| `calendar-feed-publish` | ✗ | ✗ | ✓ | A feed URL is a capability anyone can hold, disclosing where someone is expected to be all week. The UK Children's Code covers every under-18. |

The one-off `.ics` export stays available to **every** band under `data-export`:
portability is a right, and the file goes to the user rather than to the internet.

Enforcement is server-side and **re-checked on every run**, not only at connect
time, because an age band can be corrected downward after a link exists:

- `calendarSync.googleAuthUrl` and `.syncNow` gate per request.
- `syncAllCalendars()` (the unattended cron) joins `users` and skips ineligible
  connections — this is the one that matters most.
- The public feed endpoint re-checks the band on **every fetch**, and answers
  404 (identical to an unknown token) when it fails.

Hidden UI is a convenience, not a control.

---

## 3. Export to other services

### `@fenced/ical`

A dependency-free RFC 5545 generator. The parts worth knowing:

- **CRLF everywhere**, including a trailing one — the spec mandates it.
- **Folding at 75 *octets*, not characters**, backing off so a fold never splits
  a UTF-8 sequence. Accented titles and emoji otherwise produce lines that are
  legal in length but rejected by strict parsers.
- **Three timing forms**, deliberately not interchangeable — picking the wrong
  one is how exports drift by an hour twice a year:
  - `instant` → UTC, for a fixed point in time.
  - `allDay` → `VALUE=DATE` with an **exclusive** `DTEND` (a single-day event
    ends on the following day; the same day would render as zero-length).
  - `floating` → no `Z`, no `TZID`, for wall-clock commitments that should stay
    put in any zone.
- **Stable UIDs** derived from the row id. A churning UID reads to a subscribed
  client as "everything was deleted and recreated" on every refresh.

24 unit tests in `packages/ical/src/__tests__/`.

### Two delivery modes

**Subscribable feed** — `GET /calendar/feed/<token>.ics`, unauthenticated by
necessity: Google, Outlook and Apple fetch a URL and cannot carry a bearer
token. The path token *is* the credential, so it is treated as one:

- 32 bytes of entropy, base64url.
- Rate limited to 30/min (clients poll hourly; brute force needs far more).
- **Redacted from logs** — `redactPath()` in `index.ts` exists for this. Keep it
  when adding routes that carry secrets in the path.
- Rotatable, which is the revocation mechanism.
- Unknown, rotated-away and age-blocked tokens all return an identical 404.
- Errors return 503 with no query text or stack frames.
- `Cache-Control: private` so a shared proxy cannot serve one user's calendar to
  another.

Feed contents are user-selectable: events, Fenced Hours, task due dates. Task
due dates are `TRANSPARENT` — a deadline is a day, and it should not make the
whole day read as busy.

**One-off `.ics`** — `calendar.exportIcs` returns the body inline over the
caller's own session (no token involved); the app writes it to the cache
directory and hands it to the share sheet.

---

## Files

| Path | Role |
|---|---|
| `packages/ui/src/tokens/theme.ts` | `ThemeColors`, light + dark palettes, `resolveTheme` |
| `apps/mobile/src/lib/theme.tsx` | `ThemeProvider`, `useThemeColors`, `useThemedStyles` |
| `packages/ical/` | RFC 5545 generator + recurrence helpers |
| `apps/api/src/integrations/google-calendar.ts` | Google Calendar v3 client |
| `apps/api/src/integrations/calendar-sync.ts` | Pull, push, conflict resolution, cron entrypoint |
| `apps/api/src/integrations/calendar-feed.ts` | DB rows → ICS |
| `apps/api/src/integrations/token-crypto.ts` | AES-256-GCM token sealing |
| `apps/api/src/integrations/oauth-state.ts` | Signed OAuth `state` |
| `apps/api/src/trpc/age-gate.ts` | Server-side age-band enforcement |
| `apps/api/src/trpc/routers/calendar-sync.ts` | Connection management procedures |
| `apps/mobile/src/lib/sync/calendar.ts` | API ⇄ local store mirroring |
| `apps/mobile/app/profile/calendar-sync.tsx` | Connect / direction / sync now |
| `apps/mobile/app/profile/calendar-export.tsx` | Feed link + `.ics` export |
