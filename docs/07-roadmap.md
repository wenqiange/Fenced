# Post-MVP Roadmap

This document ranks the expansion backlog. It does not restate the MVP — for that see [Tech Stack](04-tech-stack.md), which defines Phases 0–6. Everything here lands in **Phase 5 (expansion)** or **Phase 6 (monetization and teams)**, and the phase numbers below refer to that scheme.

Three documents constrain every line of this one and win any disagreement: [Platform Constraints](05-platform-constraints.md), [Under-16 Compliance](06-youth-compliance.md), and the band table in that second document, which is the specification for who gets what.

---

## How items are scored

| Column | Meaning |
|---|---|
| **Effort** | S = days, M = 1–2 weeks, L = 3–6 weeks, XL = a quarter or more, usually because of an external dependency |
| **Platform** | Whether the feature behaves identically on both platforms, or is degraded/absent on one |
| **Bands** | Availability by age band. `All` means child, teen and adult. Anything narrower is a compliance constraint, not a product choice |
| **Wave** | 5a → 5b → 5c → 6. Within a wave, order is flexible |

Two rules apply throughout and are worth stating once rather than repeating in every row:

**Minors get their own data, never other people's.** A user's own heatmap, their own best hours, their own export — available to every band. Anything that compares users, ranks them, or shows one user's activity to another is `adult`-only, with a private invite-only variant possible for `teen`.

**Product analytics is not insights.** "Insights" is aggregation of the user's own sessions, computed for them. "Product analytics" is behavioral telemetry sent to PostHog for us. The first is available to all bands; the second is never sent from a minor's account. Do not let a shared aggregation pipeline blur this.

---

## Priority order

| # | Feature | Wave | Effort | Platform | Bands |
|---|---|---|---|---|---|
| 1 | Natural-language recurrence in the parser | 5a | M | Identical | All |
| 2 | Weekly/monthly focus reports with hour × weekday heatmap | 5a | M | Identical | All |
| 3 | "Your best focus hours" derived insights | 5a | S | Identical | All |
| 4 | CSV export of tasks, sessions and insights | 5a | S | Identical | All |
| 5 | Time-blocking generated from the task list | 5a | M | Identical | All |
| 6 | Contextual blocking profiles (work, study, sleep) | 5a | M | Identical | All |
| 7 | Auto-scheduling — deterministic solver | 5b | L | Identical | All |
| 8 | Google Calendar two-way sync | 5b | L + XL wait | Identical once shipped | All |
| 9 | Task dependencies | 5b | M | Identical | All |
| 10 | Streak freeze and streak recovery | 5b | S | Identical | All, no loss framing for minors |
| 11 | Website blocking beyond app shielding | 5b | L | **Degraded on iOS** | All |
| 12 | Configurable widgets | 5b | M | Identical | All |
| 13 | Outlook Calendar two-way sync | 5c | M after Google | Identical | All |
| 14 | Premium themes and alternate app icons | 5c | S | Identical | All |
| 15 | Custom lock-screen messages and quotes | 5c | S | Identical | All |
| 16 | Weekly challenges with cosmetic rewards | 5c | M | Identical | All, no loss framing for minors |
| 17 | Slack / Discord status during sessions | 5c | S | Identical | `adult` |
| 18 | Notion / Google Sheets export targets | 5c | M | Identical | `adult` |
| 19 | Anonymous comparative stats ("top 10% this week") | 5c | M | Identical | `adult`; `teen` private opt-in |
| 20 | Virtual co-working — synchronised sessions with friends | 6 | L | Identical | `adult`; `teen` invite-only, private |
| 21 | Webhooks and Zapier/IFTTT | 6 | M | Identical | `adult` |
| 22 | Location-triggered blocking and reminders | 6 | L + XL review | Identical, both gated by review | Never for `child`; off by default otherwise |
| 23 | Spotify / Apple Music integration | 6 | M | Identical | `adult` |

Ambient sounds and white noise are absent from this table because they ship in the MVP as first-party focus audio (Phase 3). Spotify at #23 is the optional extra layered on top, not the feature itself.

---

## Tasks and calendar

This is the block to build first. It is the largest source of daily-use value, it has no entitlement exposure, and — unlike the analytics block — it behaves identically on both platforms.

### Natural-language recurrence — Wave 5a, M — **shipped**

`packages/nlp` parses "every Monday", "weekdays at 9", "the first of each month" and "every two weeks until June" into RRULE strings. The grammar covers frequencies and adverbs (`daily`, `quarterly`), intervals as digits or words including "every other", weekday lists, weekday/weekend spans, days of the month including "the last day", and `UNTIL` / `COUNT` end conditions. `describeRrule` renders a rule back into a phrase for the task list and detail screens. The rule travels through `LocalTask.rrule` into the existing `rrule` column, so no storage change was needed.

The compliance angle matters here. Per the AI rule, minors use the **local parser only** — ambiguous input asks the user to clarify rather than escalating to a model. The parser therefore returns a structured `ambiguities` list instead of a bare boolean: a bare hour ("at 9") offers AM/PM as tappable options, an unfinished date ("send the invoice on") and a month-only end date ("until June") are surfaced as questions. The adult-only LLM path, if it ships at all, hangs off the same signal as a fallback for input the grammar rejects.

### Time-blocking from the task list — Wave 5a, M — **shipped**

`proposeTimeBlocks` in `@fenced/core` is a deterministic packer: it builds free gaps from the day's work windows (Fenced Hours when present, otherwise 09:00–18:00), subtracts existing calendar events, and places open tasks by due date → priority → estimate size. Tasks that do not fit a single gap are split across gaps; leftovers shorter than 15 minutes are reported as unmet rather than invented. Buffer between blocks defaults to 5 minutes.

The Tasks tab opens a review sheet (`/time-block`) that shows the proposal with toggles, split labels, and an "could not fit" list. Accepting writes local calendar events (`source: "time-block"`, linked to the task) which the day/week/month calendar views render alongside Fenced Hours. This is the human-in-the-loop precursor to auto-scheduling — the same gap model, still no model.

### Auto-scheduling — Wave 5b, L — **shipped (solver; LLM explanation deferred)**

`autoSchedule` in `@fenced/core` walks a horizon day by day on top of `proposeTimeBlocks`. It carries remaining estimates forward, subtracts minutes already on the calendar, skips tasks whose `blockedBy` dependencies are incomplete, and stamps each block with a structured reason (`on-time`, `spillover`, `after-due`) — no model, so every age band can use it. The optional natural-language explanation layer stays deferred and adult-only.

The Tasks **Schedule** sheet offers Today or Next 7 days, groups blocks by day, surfaces reasons and blocked/unplaced tasks, and writes accepted blocks as local calendar events.

### Task dependencies — Wave 5b, M — **shipped**

`LocalTask.blockedByTaskIds` stores "can't start B until A is done." The task detail screen toggles blockers; deleting a task clears reverse references. The auto-scheduler treats incomplete blockers as a hard constraint (`reason: "blocked"`).

Server-side, `task_dependencies` is a dedicated join table (not `parentTaskId`), with `task.setBlockedBy` replacing the blocker set and `task.list` returning `blockedByTaskIds` per row. Mobile sync maps local ids ↔ remote UUIDs on pull/push so dependencies survive sign-in across devices.

### Google Calendar two-way sync — Wave 5b, L of work behind an XL wait

Server-side, incremental sync tokens, push channels. The work itself is well-understood; the schedule risk is entirely external. **Calendar scopes are sensitive, so OAuth verification plus brand review is required, and it takes weeks with no CASA assessment to shortcut.** Start the verification the moment this feature is committed to, not when the code is ready — the same lesson Phase 0 teaches about the Family Controls entitlement.

Outlook follows the same architecture and should be much cheaper once the sync reconciliation layer exists.

Apple Calendar is a different kind of thing and is not in this block. There is no server-side API; it is `EventKit` on-device, iOS only, while the app is installed. Mirror those events into the backend so other surfaces can display them **read-only and clearly labelled as iOS-device-dependent**.

### Smart location-based reminders — Wave 6

Deferred with the rest of the location work, for the same reasons. See #22 below.

---

## Analytics and insights

The highest perceived value per unit of effort in the backlog, and the block most likely to justify a price. It is also the block where the original framing needs correcting.

**Per-app breakdowns are not available on iOS, and this is architectural rather than difficult.** App identity arrives as an opaque token; the one context that resolves it — the `DeviceActivityReport` extension — runs in a sandbox that silently blocks App Group writes, files, network, notifications, pasteboard and iCloud. Data computed there can be rendered in that extension's own SwiftUI view and nowhere else. Not the app, not the server, not a dashboard.

So the reports are built on signals Fenced generates itself:

- Session start, duration, completion and abandonment
- **Shield hits** — how many times the user bumped into a fence, collected via the `ShieldAction` extension, which unlike the report extension *can* write to App Groups
- Task completions and estimate accuracy
- Fenced Hours adherence

That is enough for the hour × weekday heatmap, the best-focus-hours insight, and the focus-versus-distraction trend. App names appear on Android only, and iOS can offer an optional native Screen Time embed for users who want the per-app view.

**"Time recovered" needs a defensible baseline.** A before/after comparison implies we measured "before", which we cannot do on iOS and should not do by asking a minor to self-report their habits. The honest version is a within-app trend: focused minutes and shield hits over time, week on week, plus the first-week-versus-current comparison for users who have been around long enough. Anything framed as "you saved N hours versus people who don't use Fenced" is a marketing claim without data behind it.

**CSV export ships early and cheaply** — the export machinery already exists from Phase 2, where data export and deletion are compliance deliverables. Adding tasks, sessions and aggregated insights to that payload is small work. Notion and Google Sheets are integrations rather than exports and belong in 5c, adults only.

---

## Advanced focus

**Contextual profiles** (work, study, sleep) are the cheapest high-value item in this block: a profile is a named fence plus a preset plus a Fenced Hours schedule, and all three already exist as entities. This is mostly UI and a grouping table.

**Website blocking is degraded on iOS and must be described honestly.** On iOS the mechanism is a content filter that covers **Safari and WebKit only** — Chrome, Firefox, Brave and Edge are not filtered — and **setting any filter policy disables Safari private browsing**, which users will notice and which must be disclosed before they enable it. The workable framing on both platforms is: filter domains in Safari, shield other browsers as apps, and ship the MV3 browser extension for genuine per-site blocking on desktop.

**Virtual co-working is a social feature and inherits every social constraint.** Never for `child`. For `teen`, invite-only, no public profiles, no discovery, no free-text display names. Its position in Wave 6 reflects that it needs an account-linking model, a presence service, and a moderation story — it is a product in its own right, not a screen.

**Location-triggered blocking is correctly last.** iOS needs `CLLocationManager` region monitoring with a hard limit of 20 regions and *Always* authorization, which draws App Review scrutiny and a alarming system prompt. Android needs `ACCESS_BACKGROUND_LOCATION`, a Play Console declaration, a review that typically wants a demo video, and permission is granted only for features central to the app's core purpose. On top of that, the Children's Code requires geolocation off by default for minors, a visible indicator while location is active, and unavailability to `child` accounts entirely. Ship it in Phase 6 when usage data can justify the declaration — which is exactly what the tech-stack phasing already says.

---

## Habits and gamification

Streaks are already in the MVP. This block deepens them.

The Children's Code's "no nudge techniques" standard is narrower than it first reads: what it prohibits is nudging children into **providing unnecessary personal data or weakening their privacy protections**. It is not a ban on streaks, and a streak that encourages a student to study is not its target. So streak freeze, recovery and weekly challenges are all available to minors.

The constraint that does apply is framing: **no loss framing for minors.** "Your fence line grew to 12 days" rather than "don't lose your 12-day streak!" This is already the MVP rule for streaks and it extends unchanged to challenges and rewards.

Comparative statistics are the exception, because they involve other users' data. `adult` by default; a private, opt-in variant is possible for `teen` under the same invite-only rules as leaderboards; never for `child`.

---

## Personalisation

Themes, alternate app icons, configurable widgets and custom lock-screen messages. Low effort, no compliance surface, no platform asymmetry beyond the usual widget plumbing, and historically the easiest thing to attach a price to.

One caveat on lock-screen messages: the shield UI on iOS is rendered by the `ShieldConfiguration` extension, so custom text has to reach that extension through an App Group. That is a supported path — the constraint is the report extension, not this one — but it means custom messages are not purely a client-side preference.

---

## Integrations

**Slack and Discord status** are the cleanest wins here. `users.profile:write` and `dnd:write` are exactly the right Slack scopes, the fit is natural, and the risk is low. Adults only, since it publishes the user's activity to a third-party service.

**Spotify is an optional extra, never the audio strategy.** Playback control requires the user to have Premium, and the Web API cannot stream audio — that needs the mobile SDKs. First-party ambient audio has none of these constraints, works offline, and works for every user, which is why it ships in the MVP and Spotify sits in Phase 6.

**Webhooks and Zapier/IFTTT** are a power-user feature and a reasonable top-tier hook. They require a stable public API surface, so they follow rather than lead.

---

## What this implies for monetisation

Monetisation is Phase 6 and there is **no tiering in the MVP** — every user gets every shipped feature, subject only to age band. That decision is locked. When tiering does arrive, this backlog suggests the natural boundary:

The free product keeps everything that makes Fenced work: sessions, blocking, Fenced Hours, tasks, calendar, streaks, and the user's own basic insights. Charging for the core loop of a focus app aimed at students is both bad positioning and, for minors, an awkward conversation.

The paid product is depth: full historical reports and heatmaps, auto-scheduling, external calendar sync, contextual profiles, integrations, themes and widgets. Every one of those is genuinely more expensive to run or maintain, which makes the price defensible rather than arbitrary.

**Minors complicate any tier that bundles adult-only features.** A `teen` account cannot use LLM explanations, integrations, or comparative stats no matter what it pays. Either the paid tier is priced on the features a minor can actually receive, or there is a separate presentation for minor accounts. This needs deciding before the paywall is designed, not after. **[LEGAL]** — in-app purchase flows aimed at minors carry their own requirements in both stores.

---

## Open questions

1. Does the paid tier show minors a reduced feature list, or a reduced price, or both? Blocks paywall design.
2. Is "time recovered" defensible with a first-week baseline, or does it need to be reframed entirely as a trend? Blocks the reports UI copy.
3. Do co-working sessions require mutual consent per session, or is a standing friend link enough? Blocks the presence model.
4. Outlook: confirm the scope-review path before committing it to 5c. Google's sensitive-scope verification is the known quantity; Microsoft's is not yet assessed here.
