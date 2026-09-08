# Platform Constraints

Read this document first. It constrains everything in the others.

The short version: roughly 80% of the Fenced feature set is buildable as specified. Three features are not, and the reasons are structural rather than difficult — Apple has deliberately closed the door, and no amount of engineering opens it. A fourth carries enough store-review risk that it should not sit on the launch critical path.

Every item below is tagged:

- **MVP** — in the first release.
- **LATER** — deferred by decision, and documented so the design work is not lost.
- **RE-SPEC** — the user-facing promise has to change. The underlying value is usually still deliverable in a different shape.

Youth compliance has its own document — see [Under-16 Compliance](06-youth-compliance.md) — because supporting minors changes the account model and both store submissions.

---

## Finding 1: "Phone lock" does not exist on iOS — RE-SPEC, MVP

**The claim in the original spec:** a "phone-lock focus session."

**The reality:** no third-party iOS app can lock an iPhone. There is no API for it, and there will not be one — the capability is reserved for MDM-supervised devices and Apple's own Screen Time. Guided Access is user-initiated only and cannot be triggered programmatically.

What you can do is shield individual apps using Apple's Screen Time framework suite:

- **FamilyControls** — requests authorization, provides the system app picker, returns opaque tokens.
- **ManagedSettings** — the enforcer. Applying tokens to a `ManagedSettingsStore` shield makes the OS intercept app launches.
- **DeviceActivity** — schedules when shields apply and fires callbacks into your app extension.

When a user taps a shielded app, the app opens and is immediately covered by a system-drawn shield screen. It is instant and reliable, and functionally it is exactly what users mean by "locked." The problem is purely one of naming.

### The entitlement is your critical path

Apple gates these frameworks behind `com.apple.developer.family-controls`, and the distribution version requires manual human approval:

- Development builds work immediately with the development entitlement. This is why teams do not discover the problem until submission day.
- App Store and TestFlight builds **fail to sign** without the distribution entitlement. Not "get rejected in review" — fail at the signing step, before upload.
- Request it at https://developer.apple.com/contact/request/family-controls-distribution
- Approval is manual, with 2026 reports ranging from four business days to several weeks.
- **You must request it for every bundle ID, including each app extension.** Fenced needs four: the main app, `DeviceActivityMonitor`, `ShieldConfiguration`, and `ShieldAction`.

That last point has burned real shipping products. There are multiple documented 2026 cases on the Apple Developer Forums where the main app was approved, the extensions were not, and the app was unshippable for weeks with testers waiting — with no recourse beyond support tickets that went unanswered. Apple support has stated in at least one reply that approval is scoped to the team once granted, but developers report otherwise for extension bundle IDs, so do not rely on it.

**Action, before writing product code:**

1. Register all four App IDs with Family Controls and App Groups capabilities.
2. Submit the distribution entitlement request listing **all four bundle IDs explicitly** in one request.
3. Reference the [youth compliance design](06-youth-compliance.md) in the request. Apple wants a clear parental-control or digital-wellbeing use case, and a documented under-16 safety design is exactly that — supporting minors makes this request stronger, not weaker.
4. Write down the case number and follow up weekly.
5. Build against the development entitlement while waiting.

Treat this as a hard dependency with a multi-week lead time, like a hardware order.

### Authorization mode: `.individual` for MVP

Family Controls has two modes. `.individual` is a user authorizing restrictions on their own device. `.child` is a guardian authorizing from a parent device via iCloud Family Sharing.

**Use `.individual` for everyone in the MVP, including minors.** Parent-managed remote configuration is a materially different product — separate onboarding, cross-device data flow, Family Sharing dependencies — and belongs post-MVP. Parental consent for under-13s is handled separately in-app, not through `.child` authorization.

### How to talk about it

Drop "phone lock" from all copy. It over-promises and invites one-star reviews from users expecting a dark screen.

- Instead of "lock your phone": **"Fence off your distractions."**
- Instead of "phone locked for 25 minutes": **"Instagram, TikTok and 4 more are fenced until 10:25."**

This is more honest and it is better positioning — a scalpel rather than a sledgehammer, which is what a knowledge worker who still needs Slack actually wants.

---

## Finding 2: Per-app analytics is impossible on iOS — RE-SPEC, MVP

**The claim in the original spec:** "Analytics dashboard (focus time, most-blocked apps, trends)."

**The reality:** "most-blocked apps" cannot be built on iOS. This is not a hard problem; it is a closed door, and Apple has confirmed on the record that closing it was the point.

Two independent walls stand in the way.

### Wall 1: tokens carry no identity

`ApplicationToken`, `ActivityCategoryToken`, and `WebDomainToken` are opaque blobs with no display name, no bundle identifier, and no human-readable metadata. The only way to turn one back into something recognizable is to pass it into a SwiftUI `Label`, which the system resolves to the real icon and name *at render time*, inside the view, where your code cannot read the result.

Consequences:

- You cannot log which apps a user blocked. Debug logs and crash reports about blocked-app state are off the table.
- You cannot persist tokens server-side. They are scoped to your App Group and device context and do not travel.
- You cannot share a token across apps or teams — a token minted in one authorization context is meaningless in another.

Your app can *show* users their blocked apps and can never *know* what they are.

### Wall 2: the report extension sandbox blocks every exit

There is one place where iOS does resolve app identity: inside a `DeviceActivityReport` extension, `Application.bundleIdentifier` returns a real value. It is nil everywhere else — main app and `DeviceActivityMonitor` included.

This looks like a loophole. It is not. The report extension runs in a sandbox that silently blocks every output channel, as documented by developers testing each one systematically in 2026:

| Channel | Result |
|---|---|
| App Group `UserDefaults` | Reads succeed, **writes silently dropped** |
| App Group file writes | Fail silently or throw |
| HTTP requests | Network blocked entirely |
| Local notifications | "Couldn't communicate with a helper application" |
| `UIPasteboard` | Writes silently fail |
| iCloud key-value store | `synchronize()` returns false |

Failures are *silent*. Writes appear to succeed and the data simply never arrives, which is why teams lose days before understanding what they are fighting.

Asked directly whether this was intentional, Apple's answer was unambiguous: yes, by design, to preserve user privacy. A follow-up reply spelled out the reasoning — detailed usage data is treated as highly sensitive both legally and technically, and the framework intentionally forces it to remain on the device where it was generated. Apple describes this as "a fundamental, deliberate architectural decision," not a gap awaiting a future SDK.

So data computed in the report extension can be rendered in that extension's own SwiftUI view and nowhere else. Not your app. Not your server. Not your web dashboard.

### What to build instead

Stop trying to read the OS's data and start generating your own. You control the shield, so you control the telemetry around it — and your own events are exportable, cross-platform, and consistent.

**Tier 1 — first-party metrics (cross-platform, syncable, the actual product):** MVP

- Focus minutes: per day, week, month, by preset, by time of day.
- Sessions: started, completed, abandoned, completion rate.
- Shield hits: how many times the user bumped into a fence. Collected via the `ShieldAction` extension, which — unlike the report extension — *can* write to App Groups.
- Early-exit attempts and strict-mode friction events.
- Streaks, longest streak, consistency by weekday.
- Tasks completed during sessions, and estimate-vs-actual accuracy.
- Fenced Hours adherence.

Shield hits deserve emphasis. "You reached for a fenced app 14 times on Tuesday, down from 31 last week" is a genuinely excellent insight, it is unambiguously yours to collect, and it works identically on both platforms. It may be a better headline metric than app names ever would have been.

**Tier 2 — category-level breakdown (iOS, degraded):** MVP. If users select `ActivityCategoryToken`s (Social, Games, Entertainment) rather than individual apps, categories are known quantities. You can honestly report "62% of your fenced time was Social" without naming an app. Worth nudging users toward category selection during onboarding for exactly this reason.

**Tier 3 — per-app names:** Android only. `UsageStatsManager` gives you package names freely, so full per-app analytics are real there. On iOS, offer an optional native "Screen Time report" screen embedding a `DeviceActivityReport` view — the user sees rich per-app data rendered by the system and you never receive it.

### Design implications you cannot dodge

- **The web dashboard shows Tier 1 only**, on every platform.
- **Analytics screens diverge by platform.** Android gets an "Apps" section; iOS gets a native "Screen Time" embed. Plan navigation for this rather than discovering it late.
- **Marketing copy must be platform-aware.** "See your most-blocked apps" is false advertising on iOS.

---

## Finding 3: Android blocking must avoid AccessibilityService — MVP, with a specific approach

**The tempting approach:** an `AccessibilityService` gets instant foreground-app change events with sub-100ms latency. Nearly every Android blocking tutorial uses it.

**Do not use it.** Google Play has effectively closed this path for focus apps, on three fronts:

1. **Policy.** Only services designed to help people with disabilities may declare `isAccessibilityTool=true`. Everything else must complete a Play Console accessibility declaration, provide prominent in-app disclosure, obtain affirmative consent, submit a demo video, and justify that no narrower API achieves the same result. That last requirement is fatal: `UsageStatsManager` demonstrably does achieve it, so the justification cannot be made honestly.
2. **Enforcement.** Reviewers reject blockers over this. Published 2026 accounts describe developers adding disclosure screens, updating store copy, and still being rejected repeatedly.
3. **Platform.** Android 17.2 prevents apps from enabling accessibility services at all when Advanced Protection Mode is on, unless accessibility is the app's core purpose. Even an approved app would silently lose the feature for security-conscious users.

There is also an operational trap. Play Console detects the permission in *any active artifact across any track*, and the accessibility declaration cannot be removed while an active release still contains it. One developer's rejection loop only broke after creating a clean release in every track — including forgotten internal and closed-testing tracks — to purge the permission. If you ever ship an accessibility service, expect a painful extraction.

### The compliant architecture

Poll the foreground app instead:

- **`UsageStatsManager`** with the `PACKAGE_USAGE_STATS` special permission, polled every ~800ms from a foreground service. Compare against the user's blocked set, launch a full-screen overlay on a match.
- **Foreground service type.** Android 14+ requires a declared type. App blocking fits none of the specific ones, so it is `specialUse`, which requires a property explaining yourself to the reviewer:

```xml
<service android:name=".fence.FenceMonitorService"
    android:exported="false"
    android:foregroundServiceType="specialUse">
    <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="Enforces user-selected app blocking during a focus session by detecting the foreground app via usage access"/>
</service>
```

- Start with `startForegroundService`, call `startForeground` with `FOREGROUND_SERVICE_TYPE_SPECIAL_USE` on API 34+, return `START_STICKY` so the OS restores monitoring if it kills you mid-session.
- **`SYSTEM_ALERT_WINDOW`** for the block screen, or a full-screen activity. Android 12+ will not let you overlay the Settings app, so the revoke path is always reachable.

### Accept these tradeoffs explicitly

- **~1 second of latency.** The user sees their feed briefly, then the fence appears. In practice this is fine — the interruption lands before the scroll begins — but it is not iOS's instant interception, and the platforms will feel subtly different.
- **No grant dialog.** `PACKAGE_USAGE_STATS` cannot be requested with a runtime prompt. You send the user to `ACTION_USAGE_ACCESS_SETTINGS` and they must find your app in a system list. This is the single largest onboarding drop-off point on Android and deserves a purpose-built explainer screen with a screenshot of the toggle.
- **Enforcement is a speed bump, not a wall.** Anyone can revoke usage access in Settings and blocking stops. This is not parental-control-grade and must not be sold as such. The honest design goal is to make bypassing cost about thirty seconds of deliberate effort — usually longer than the urge to open Instagram survives.
- **OEM process killers.** Xiaomi, Samsung, Huawei and others aggressively kill foreground services. You need `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, OEM-specific autostart guidance surfaced to the user, and session-state recovery on restart. Budget real time; this is the leading cause of "the app just stopped working" reviews in this category.
- **`QUERY_ALL_PACKAGES`** is restricted on Android 11+ and needs justification. Prefer `getInstalledApplications` with a launcher-intent filter to build the picker.

---

## Finding 4: Website blocking is far narrower than it sounds — RE-SPEC, LATER

**The claim in the original spec:** "Full app/website-level blocking during focus sessions."

### iOS: Safari only

`ManagedSettings` offers `WebContentSettings.blockedByFilter`, with limits worth knowing before designing the UI:

- **Safari only.** It filters Safari and WebKit traffic. Chrome, Firefox, Brave and Edge on iOS are not filtered by it.
- **50 domains maximum**, plus up to 50 exceptions, at once.
- **Setting any filter policy disables Safari private browsing.** Users will notice. Disclose it.

The obvious workaround — a `NetworkExtension` content filter for system-wide coverage — does not work for a consumer app. Per-app content filtering exists for *managed* apps since iOS 16 via `ContentFilterUUID`, which requires MDM. Developers who tested it also found browser traffic arrives as socket flows rather than `NEFilterBrowserFlow`, so you can drop connections but cannot present a branded block page. iOS 26 introduces a system-wide URL Filter API worth tracking, but it remains supervised/MDM-scoped and is not a consumer path today.

**The practical answer:** filter domains in Safari, and shield third-party browsers as apps. If a user fences Chrome and Firefox, they cannot reach the site through them. Easy to explain: "We'll block these sites in Safari and fence off your other browsers."

### Android: do not use VpnService

A local `VpnService` doing DNS filtering is the standard cross-browser trick, and a poor bet on Play:

- VpnService is restricted to apps where VPN functionality is the **core purpose** — security, parental control, network tools, operator services. A focus app is not positioned that way, and rejections turn on positioning rather than implementation quality.
- Requires the Play Console declaration, documented use in the store listing, and a demo video of 90 seconds or less showing the prominent disclosure.
- Requires encrypting data from the device to **the VPN tunnel endpoint** — which local-only filtering structurally cannot satisfy, because there is no endpoint.
- Only one VPN can be active at a time, so you would break any user running a real one.

**The practical answer:** same as iOS. Block browsers as apps. Ship the browser extension for genuine per-site blocking on desktop, where MV3 `declarativeNetRequest` makes it straightforward.

### Honest positioning

Sell it as: **"Block distracting sites in your browser, and fence off browsers entirely during deep work."** Do not promise per-site blocking inside third-party mobile browsers.

---

## Calendar sync: Apple is device-only — RE-SPEC

**Decision:** Apple Calendar uses on-device `EventKit` sync only, on iOS only. CalDAV is rejected.

- **Google Calendar** — **SHIPPED** (pulled forward from post-MVP). Server-side API with incremental sync tokens; push channels are still future work, so freshness comes from an hourly cron plus a manual "Sync now". Calendar scopes are *sensitive*, so OAuth verification plus brand review is required (weeks, no CASA assessment) before the consent screen leaves testing mode — **this is now the blocker on public availability, not the code**. Implementation and conflict model: [Theming and Calendar Interop](08-theming-and-calendar-sync.md).
- **Microsoft Outlook** — LATER. Microsoft Graph with delta queries and webhook subscriptions. Cleanest of the three.
- **Apple Calendar** — LATER, and fundamentally different in kind. There is **no server-side API**; access is `EventKit` on-device only. Your backend can never talk to a user's Apple calendar.

So Apple sync happens on the device, only while the app is installed, only on iOS. A user whose calendar lives in Apple Calendar gets no sync from the web dashboard or from Android. Mirror the events into your backend so other surfaces can display them read-only, clearly labelled as iOS-device-dependent.

CalDAV with app-specific passwords would give server-side access but requires asking users for Apple credentials — a trust and support burden not worth carrying. Rejected by decision.

`EventKit` on iOS 17+ splits write-only from full access. Full access needs justification in review; request write-only where you can.

Two-way sync is deceptively hard regardless of provider — recurring event expansion and `RRULE` edge cases, timezone and DST transitions, tombstones for deletions, ETag conflict resolution, and idempotency so a retry does not duplicate a user's meeting. Budget for it as a project, not a feature, and never let a sync bug write to a user's real calendar twice. This is the main reason two-way sync sits outside the MVP: the MVP calendar is local with reminders, and read-only external connections come first.

---

## Strict mode: a user-chosen delay — MVP

**Decision:** strict mode is a timer. The user chooses how long the delay is. No passphrase in the MVP.

The mechanism: when arming a session, the user picks a delay — say 5, 15, 30, or 60 minutes, or a custom value. If they try to end the session early, they must wait out that delay before the fence lifts.

**The critical design detail: the delay is chosen when arming the session, never when trying to escape it.** If the user can set or change the delay at exit time, the feature is decorative. The value comes entirely from a past self binding a future self, so the delay must be immutable for the duration of the session. This makes it a genuine commitment device rather than a speed bump.

Implementation notes:

- Persist the delay server-side and in the App Group at arm time, so it survives app restart, force-quit, and device reboot.
- Show the countdown honestly once triggered. The user should see exactly how long is left.
- Cap the delay for `child` accounts — an unbounded self-imposed lock is a wellbeing risk for a young user. See [youth compliance](06-youth-compliance.md).
- A passphrase variant is a reasonable post-MVP addition for users who want more friction, but the delay covers the core need with far less UI.

**What you cannot do, on either platform: stop the user from deleting Fenced.** iOS has no anti-uninstall capability for consumer apps. Android's only real mechanisms are Device Owner provisioning (enterprise-only, requires factory reset) and accessibility-based uninstall interception, which you are not using. On Android the user can also simply revoke usage access, which is faster than uninstalling.

This is fine. Strict mode's job is raising the cost of an impulse above the impulse's half-life, and a 30-minute delay does that well. What matters is honesty:

- Do say: "Strict mode makes quitting early deliberately difficult."
- Do not say: "unbypassable," "cannot be disabled," or "locked until the timer ends."

A user who discovers the escape hatch after being told it did not exist writes a much worse review than one who was told the truth.

---

## Location-based focus zones — LATER (post-MVP)

Buildable, but it drags launch-blocking review risk onto the critical path for a feature most users will not touch in week one.

- **iOS:** `CLLocationManager` region monitoring, hard limit of **20 regions per app**, requires *Always* location authorization. Always-authorization draws App Review scrutiny and a scary system prompt, and background wake-ups are reliable but not instant.
- **Android:** the Geofencing API requires `ACCESS_BACKGROUND_LOCATION`, which triggers a Play Console declaration and review. Background location is permitted only for features central to the app's core purpose, with explicit consent, and never for analytics. Approval typically wants a demo video. Play's 2026 guidance pushes toward coarse and foreground-only wherever possible.
- **Youth constraint:** the UK Children's Code requires geolocation off by default for minors, an obvious indicator while location is active, and any setting making a child's location visible to others must reset to off at session end. Zones must be unavailable to `child` accounts entirely.

Two distrusted prompts, two review processes, and a youth-compliance surface, on a nice-to-have. Ship v1 without it, then add zones once you have usage data to justify the permission in your declaration — which also makes the declaration easier to write.

---

## Monetization — LATER

**Decision:** there is no free/premium split in the MVP. Every user gets every shipped feature. Tiering, paywalls, and trials come later.

This removes a meaningful amount of MVP scope — no RevenueCat integration, no paywall screens, no entitlement resolution, no trial state machine, no store subscription products — and it removes the risk of designing tier boundaries before you know which features users actually value. The paywall design work is preserved in [user flows](01-user-flows.md) as a post-MVP section rather than discarded.

The constraints still apply when you do build it, and they are worth knowing now because two of them affect architecture:

- **Consumer subscriptions.** Apple and Google require their IAP for digital goods (30% standard, 15% under the Small Business Program and on year-two renewals). RevenueCat handles receipt validation, cross-platform entitlement, and the subscription state machine. Do not build this yourself.
- **Team/Family plans do not fit Apple IAP.** There is no seat-based model: no per-seat quantity, no proration, no admin reassignment. Team plans must be sold on the web via Stripe with in-app redemption at sign-in. Apple restricts how you may link to external purchasing from inside the app; recent US regulatory changes have loosened link-out rules, so verify current requirements before designing that screen.
- **Free trials** should use platform introductory offers. Both stores mandate clear disclosure of price, duration, and renewal terms on the paywall itself.
- **Minors and payments.** If you eventually charge, purchases by minors need care — parental consent for payment, and no purchase pressure aimed at children.

One architectural note worth acting on during the MVP: put feature access behind a **single server-side policy module** from the start. The MVP answer is "everything on, subject to age band," but having one place where access is decided means adding a plan dimension later is a change to one module rather than a hunt through the codebase.

---

## Other integrations

- **Slack status sync** — LATER. `users.profile:write` and `dnd:write` are exactly the right scopes. Clean fit, low risk.
- **Notion / Trello import** — LATER. Straightforward APIs; one-way import avoids all sync complexity.
- **Spotify** — LATER, explicitly a future implementation and not in v1. Playback control requires the user to have Spotify Premium, and the Web API cannot stream audio (you need the mobile SDKs). First-party white-noise and ambient audio has none of these constraints, works offline, and works for every user.
- **First-party focus audio** — MVP. Ship your own ambient audio; it is the primary offering and Spotify is only ever an optional extra.
- **Browser extension** — LATER. MV3 `declarativeNetRequest`, Chrome/Edge/Firefox from one codebase. Safari requires a separate build shipped inside a macOS app; defer that further.

---

## Store deadlines and review gates

**Apple**

- Family Controls distribution entitlement for four bundle IDs. The critical path.
- Age rating questionnaire under the current tiers (4+, 9+, 13+, 16+, 18+), including questions on in-app controls, wellness topics, and AI chatbots.
- **Social media capability questions are required for new submissions from September 2026.** Fenced will submit after that date. The MVP has no social features, so this is a clean "no" — but it changes when leaderboards ship. See [youth compliance](06-youth-compliance.md).
- Do **not** select "Made for Kids" — it opts you into the Kids Category irreversibly once approved.
- `EventKit` and any location usage-description justifications.
- Context worth tracking: iOS 27 introduces **Time Allowances**, letting parents manage time per app category — an OS-level feature adjacent to your product.

**Google Play**

- All apps must meet the latest target API level by **31 August 2026** — an annual recurring deadline.
- `specialUse` foreground service justification.
- Target audience declaration including child age groups, which triggers Families Policy requirements.
- Background location declaration if and when zones ship.
- Privacy policy in both the store listing and the app.

---

## Privacy and compliance

Focus and screen-time data is sensitive personal data. Under GDPR you need a lawful basis, real data minimization, export, and deletion. A useful side effect of Finding 2 is that iOS makes over-collection impossible by construction.

Two specific traps:

- **App Privacy and tracking consent are different systems.** The most common mistake in this category is conflating them and either over-declaring or leaving App Privacy entries empty. Fill out App Privacy accurately for what you actually collect (your own session metrics), and do not add tracking declarations you do not need.
- **Under-16 support is a committed requirement**, not an open question. It changes the account model, onboarding order, analytics pipeline, and AI architecture. It is specified in full in [Under-16 Compliance](06-youth-compliance.md) and must be built into the MVP rather than retrofitted.

Never send blocked-app identity to analytics. On iOS you cannot; on Android you must choose not to.

---

## Summary

**MVP:** iOS app shielding and Android blocking, Fenced Hours, strict mode as a user-chosen delay, tasks with subtasks/tags/priorities/recurrence and local natural-language quick add, local calendar with reminders, first-party insights, streaks, login with age assurance, cross-device sync, first-party focus audio, data export and deletion.

**RE-SPEC (already reflected above):** phone lock becomes app shielding; per-app analytics becomes first-party metrics with app names on Android only; website blocking becomes Safari filtering plus browser shielding plus a desktop extension; Apple Calendar becomes on-device iOS-only sync; strict mode is framed as honest friction.

**LATER:** two-way calendar sync (Google, Outlook, Apple on-device), AI auto-scheduling, voice-to-task, kanban, habits, gamification, leaderboards, teams and family, location zones, web dashboard, browser extension, widgets, Slack, Notion/Trello, Spotify, and the entire monetization layer.

**The one thing to do this week:** request the Family Controls distribution entitlement for all four bundle IDs. Everything else can proceed in parallel; nothing ships without it.
