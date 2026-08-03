# Fenced — Design Documentation

Fenced builds a fence around your focus and your time. It combines distraction blocking, task management, and calendar scheduling — three things competitors split across separate apps — into one app.

**Target user:** students, freelancers, and knowledge workers currently juggling Forest, Opal, Todoist, and Fantastical who want one tool. Students explicitly includes minors, which is a committed design requirement rather than an accident.

---

## Locked decisions

These are settled. The documents reflect them throughout.

| Decision | Choice |
|---|---|
| **Tiering** | None in the MVP. Every user gets every shipped feature. Monetization is designed but deferred. |
| **Login** | Required, and it comes early in onboarding. |
| **Under-16 users** | Supported, with full compliance built into the MVP. |
| **Strict mode** | A delay the user chooses when arming a session. No passphrase in v1. |
| **Apple Calendar** | On-device `EventKit` sync only, iOS only. CalDAV rejected. |
| **Spotify** | Documented as a future addition. Not in v1. First-party audio ships instead. |
| **Client stack** | React Native via Expo, TypeScript. API on Hono + tRPC. |
| **Launch scope** | iOS and Android together. |

---

## Documents

| # | Document | What it covers |
|---|---|---|
| 1 | [User Flows](01-user-flows.md) | Onboarding with age assurance and login, starting a session, capturing a task; monetization flows preserved as post-MVP |
| 2 | [Information Architecture](02-information-architecture.md) | Five-tab shell, screen inventory marked MVP or later, deep links |
| 3 | [Brand Direction](03-brand-direction.md) | The fence metaphor, color, typography, logo, motion, sound, naming conventions |
| 4 | [Tech Stack](04-tech-stack.md) | Expo monorepo, native blocking, the policy layer, backend, sync, AI, six-phase build order |
| 5 | [Platform Constraints](05-platform-constraints.md) | What the platforms will and will not allow, feature by feature |
| 6 | [Under-16 Compliance](06-youth-compliance.md) | Age bands, age assurance, parental consent, feature restrictions by band, store declarations, DPIA |
| 7 | [Post-MVP Roadmap](07-roadmap.md) | Expansion backlog ranked by wave, effort, platform parity and age band; monetization boundary |

**Read 5 and 6 first.** They constrain the other five.

---

## Three findings that changed the original spec

Verified against current Apple and Google documentation and 2026 developer reports. Covered in full in [Platform Constraints](05-platform-constraints.md).

### 1. "Phone lock" does not exist on iOS

No third-party app can lock an iPhone. The only mechanism is Apple's Screen Time API, which shields individual apps you are never allowed to identify. Functionally it is what users mean by "locked," but the naming over-promises and invites one-star reviews from people expecting a dark screen. Use "fenced" everywhere.

The real consequence is scheduling: **the Family Controls entitlement gates the entire app.** Apple approves it manually, per bundle ID *including every app extension* (Fenced needs four), on a timeline that ran from days to several weeks in 2026 — with documented cases where the main app was approved, the extensions were not, and the product was unshippable with testers waiting. Development builds work without it, which is why teams discover the problem on submission day.

One upside of supporting minors: it **strengthens** this request, because Apple wants to see a genuine parental-control or digital-wellbeing use case.

### 2. Per-app analytics cannot be built on iOS — not "is hard," is deliberately closed

App identity arrives as an opaque token with no name and no bundle ID, resolvable only inside a SwiftUI `Label` where your code cannot read the result. The one place iOS does resolve identity — the `DeviceActivityReport` extension — runs in a sandbox that silently blocks every output channel: App Group writes, files, network, notifications, pasteboard, iCloud. Apple has confirmed on the record that this is intentional and architectural.

So "most-blocked apps" can never reach your server or your dashboard on iOS. Analytics is instead built on signals you generate yourself, and **shield hits** — how often the user reached for a fenced app — is arguably a better headline metric than app names would have been. It is cross-platform, syncable, and more actionable. Per-app names appear on Android only; iOS gets an optional native Screen Time embed.

### 3. Android blocking must avoid AccessibilityService

Google Play permits accessibility APIs only for apps whose core purpose is disability support, reviewers reject focus apps over it, and Android 17.2 blocks non-accessibility apps from the API outright under Advanced Protection Mode. The compliant path is `UsageStatsManager` polling at ~800ms plus a `specialUse` foreground service plus an overlay.

Accept the tradeoffs: roughly one second of latency, a permission with no runtime dialog that users must toggle themselves in Settings, and enforcement any user can revoke. A speed bump, not a wall — do not market it as parental-control-grade.

---

## What supporting under-16 users changes

This decision reshapes the account model, the onboarding order, the analytics pipeline, and both store submissions. It has to be built in from the start; retrofitting it means rebuilding all four.

Fenced is a **mixed-audience** service — a formal category under both the amended COPPA Rule and Google Play's target-audience policy. It needs an age signal captured before any behavioral data, carried on the user record everywhere.

**Three age bands** drive everything: `child` (under 13), `teen` (13 to the local threshold, which ranges 13–16 across EU member states and cannot be hardcoded), and `adult`. Note the UK Children's Code applies to *all* under-18s regardless of consent age.

**The most useful finding:** Apple's iOS 26 `DeclaredAgeRange` API returns an age *range* without a birthdate, often guardian-declared via Family Sharing, and adjusts thresholds to local regulation automatically. It is better assurance and less data collection than asking for a date of birth. A neutral age screen covers Android and older iOS.

**The design lever that avoids most consent machinery:** GDPR Article 8's parental-consent requirement attaches to *consent* as a lawful basis. If minors get only core-service processing under contractual necessity — and no analytics, no LLM features, no social features, no location, no marketing — there is no consent to obtain in the EU. Not "off by default," but *not offered*. COPPA still requires verifiable parental consent for US under-13s, which is one band in one jurisdiction and a much smaller scope. **This needs legal sign-off**, and it is the single most valuable question to put to a lawyer.

The features withheld from minors are, not coincidentally, exactly the ones that carry the most compliance risk anyway. One rule does a lot of work: **no minor's data ever reaches a third-party model provider.** Because the eventual AI scheduler is a deterministic solver rather than a model, minors can still use AI auto-scheduling in full — only the optional explanation layer is withheld.

Practical cost: a few weeks of engineering plus a legal engagement, landing almost entirely in the account and data layer rather than the blocking layer where the real technical risk lives.

---

## MVP scope

**In:** login with age assurance; iOS and Android app blocking; Fenced Hours; strict mode with an arm-time delay; streaks; tasks with subtasks, tags, priorities, recurrence and local natural-language quick add; local calendar with reminders; first-party insights; first-party focus audio; cross-device sync; data export and deletion.

**Out, and documented for later:** two-way calendar sync, AI auto-scheduling, voice-to-task, kanban, habits, gamification, leaderboards, teams and family, location zones, web dashboard, browser extension, widgets, Slack, Notion/Trello, Spotify, and the entire monetization layer.

The MVP task manager is deliberately complete rather than deliberately basic. A task list too weak to hold someone's real work means they keep Todoist open, and a user who never migrates never becomes a real user.

---

## The shortest version

About 80% of the original feature set is buildable as written. The blocking layer carries the real risk and almost none of it is code risk — it is an entitlement approval with a multi-week lead time and two store policy reviews. The under-16 decision adds a compliance foundation that must precede any data collection. Everything else is conventional application work.

The build order in [Tech Stack](04-tech-stack.md) front-loads exactly that: request the entitlement and start the legal engagement before writing product code, prove a shield goes up and comes down on both platforms, build the account and compliance foundation, and only then build the product. Phase 1 contains all the unknowns — protect it.

**This week:** request the Family Controls distribution entitlement for all four bundle IDs, and open the legal engagement for the items marked **[LEGAL]** in [Under-16 Compliance](06-youth-compliance.md).
