# Under-16 Compliance

> **Not legal advice.** This document is an engineering and product design specification derived from published regulator and platform guidance. Every item marked **[LEGAL]** needs sign-off from a qualified privacy lawyer before launch. Regulatory thresholds change; the data tables here need an owner.

Supporting under-16 users is a decision that has to be made before the first line of code, because it changes the account model, the onboarding order, the analytics pipeline, the AI architecture, and both store submissions. Retrofitting it means rebuilding all five.

The good news: Fenced is a focus and wellbeing app with no ads, no user-generated content, and no social feed in the MVP. That is close to the easiest possible starting position for youth compliance. The work is real but it is mostly structural rather than restrictive.

---

## Fenced is a "mixed audience" service

This is a formal category, not a description. The amended COPPA Rule added **"mixed audience"** as a defined term, and Google Play has an equivalent concept in its target-audience declaration. It means: a service not primarily directed at children, but which knowingly has child users.

That classification is the whole basis of the design. A mixed-audience service is allowed to serve adults normally *provided* it identifies younger users up front and applies stricter handling to them. So Fenced needs one thing above all others: **an age signal captured before any behavioral data is collected**, and an account model that carries it everywhere.

Consequence for Play: you must declare the target audience in Play Console before publishing, and **Google reserves the right to override your declaration based on your store imagery and terminology.** Marketing Fenced to "students" is exactly the kind of signal that gets an app assessed as including children whether or not you declared it. Since you are choosing to include minors deliberately, declare it accurately and the override risk disappears.

---

## Three age bands

Everything in the product resolves to one of three bands. Use these names in the codebase.

| Band | Ages | Regime |
|---|---|---|
| `child` | Under 13 | COPPA verifiable parental consent required. Strictest handling. |
| `teen` | 13 up to the local adult/consent threshold (13–18 depending on jurisdiction) | GDPR Art. 8 territory in the EU; UK Children's Code applies to all under-18s. |
| `adult` | At or above the local threshold | Standard handling. |

The `teen` band's upper bound is **jurisdiction-dependent and cannot be hardcoded to 16.**

- **GDPR Article 8** sets the default consent age at 16 but lets member states lower it to no less than 13. In practice roughly nine member states stayed at 16 (including Germany, Ireland, Netherlands), six chose 14 (including Spain, Italy, Austria), three chose 15 (including France), and eight chose 13 (including Sweden, Denmark, Finland, Portugal). **[LEGAL]** The authoritative per-country table needs a legal owner and a review cadence; do not copy the approximate grouping above into code.
- **The UK Children's Code applies to everyone under 18**, which is broader than any consent threshold. A 17-year-old UK user can consent for themselves and still gets the Code's protections.

So the data model stores an age band plus the jurisdiction that produced it, and the resolution logic lives in one place with the country table as configuration rather than code.

---

## Age assurance

### iOS 26+: use Apple's Declared Age Range API

Apple shipped exactly the API this problem needs. `DeclaredAgeRange` lets you request an age *range* without ever receiving a birthdate:

```swift
let response = try await requestAgeRange(ageGates: 13, 16, in: viewController)
```

- Add the `com.apple.developer.declared-age-range` entitlement via the Declared Age Range capability in Xcode. Unlike Family Controls, this one is not gated behind manual approval.
- Up to three thresholds per request, producing up to four ranges, each at least two years wide.
- Returns the range, **whether it was self-declared or guardian-declared**, and any active parental control flags.
- For children in a Family Sharing group, the parent or Family Organizer controls sharing: Always Share, Ask First, or Never Share.
- Responses are cached by the system and synced across the user's devices, so you are not re-prompting.
- **The system may override your requested gates based on the user's region and applicable regulations.** This is the important part: Apple absorbs some of the EU threshold patchwork for you.

Two reasons this beats asking for a birthdate. It is stronger evidence — a guardian-declared range from a Family Sharing account is materially better assurance than a self-entered date. And it collects less: under the amended COPPA Rule, birthdates are personal information you then have to protect, retain under policy, and delete on request. A range is not.

Handle `declinedSharing` gracefully. Declining is a legitimate choice and must fall through to the neutral age screen, not a dead end.

### Everywhere else: a neutral age screen

Required on Android, on iOS below 26, and whenever the Declared Age Range request is declined.

**Neutral means neutral.** Play's Families policy is explicit that an age screen must not encourage users to falsify their age. Concretely:

- No pre-filled or pre-selected date, and never one defaulting to an adult age.
- No copy or visual weighting that steers toward the older option.
- No retry loop — do not re-ask because you dislike the answer. Record the result, apply it, and offer correction only through a deliberate settings path with re-verification.
- Ask for month and year of birth, not a full date. It is sufficient to resolve every threshold and collects less.

**[LEGAL]** One narrow but useful point: on 25 February 2026 the FTC issued a Policy Statement limiting COPPA enforcement where a mixed-audience or general-audience operator collects children's data *solely to verify age* without obtaining parental consent first. That is what makes a clean age gate possible at all. It is enforcement discretion rather than a rule change, and it requires you to be compliant "in every other respect," so treat it as permission to run the gate and nothing more.

### Store the outcome, not the input

Persist the derived band, the jurisdiction, the assurance method (`declared-age-range-guardian`, `declared-age-range-self`, `neutral-screen`), and a timestamp. Do not persist the birth month and year after deriving the band — the band is what the application needs, and discarding the raw input is textbook data minimization that you will be glad to be able to demonstrate.

---

## The lawful-basis decision that simplifies everything

**[LEGAL] — this is the single most important item for your lawyer to confirm, because it determines how much consent machinery you build.**

GDPR Article 8's parental consent requirement attaches specifically to **consent** as the lawful basis. Where processing rests on a different basis — such as contractual necessity under Art. 6(1)(b), which is the natural basis for "the user asked us to run a focus session and store their tasks" — Article 8's parental consent requirement is not triggered. The broader duty of care toward children still applies in full, and the UK Children's Code still applies regardless of basis.

That points at a clean architecture:

**For `child` and `teen` users, process only what the core service requires, under contractual necessity, and offer no consent-based processing at all.**

Concretely, minors get: focus sessions, blocking, tasks, calendar, streaks, sync, and their own insights. Minors do not get: product analytics, behavioral profiling, LLM-assisted features, social or leaderboard features, location processing, or marketing communications. Not "off by default" — **not offered**, so there is no consent to obtain.

The payoff is that you avoid building EU parental-consent collection for teens entirely, and the features you switch off for minors are precisely the ones that create the most compliance risk. The cost is that minors get a slightly smaller product, which for a focus app aimed at students is a very acceptable trade.

**COPPA is different and does not have this escape hatch.** For US `child` users (under 13), verifiable parental consent is required before collecting personal information, regardless of your lawful-basis reasoning. There is no contractual-necessity carve-out in the statute. So VPC has to be built — but only for one band in one jurisdiction, which is a far smaller scope than "consent flows for all minors everywhere."

---

## Verifiable parental consent, for under-13s

The amended COPPA Rule has been in **full effect since 22 April 2026**, so this is active enforcement territory rather than a future deadline.

### Flow

1. Age gate returns `child`.
2. Collect a parent or guardian email address — permitted as "online contact information" for the purpose of initiating consent.
3. Send direct notice to the parent describing exactly what is collected, how it is used, that it is never disclosed to third parties for advertising or AI training, and how to review or delete it.
4. Obtain verifiable consent by an approved method.
5. Record the consent event immutably: method, timestamp, parent identifier, scope, and the notice version shown.
6. Until consent is verified, keep the account in a restricted state: local-only operation, no server sync of behavioral data.

### Approved methods, and which to pick

The amended Rule broadened the options. Available methods include a small verifying charge on a payment card, a signed consent form returned by post/fax/scan, a phone or video call with trained personnel, government-ID matching, knowledge-based authentication using dynamic questions, facial-recognition comparison against a photo ID, and text messaging **when coupled with additional verification steps**.

Recommendation: **use a specialist VPC vendor rather than building this.** Government-ID matching and facial recognition both mean processing newly-expanded categories of personal information — the amended Rule explicitly added biometric and government-issued identifiers to the definition of personal information — which is a large liability to take on for a feature used by a small slice of users. A vendor that already runs an FTC-recognized method, ideally under a COPPA Safe Harbor program, is the right call. **[LEGAL]**

### Two amended-Rule details that bite

**Separate consent for third-party disclosure.** A single bundled consent no longer covers both collection and onward disclosure. Crucially, the FTC stated that disclosure for advertising, monetary compensation, or **developing or training artificial intelligence** is *never* integral to a service, so it always needs its own distinct consent.

The clean answer is to make the question moot: **never send minors' data to a third-party model provider.** See the AI section below.

**Retention limits.** You need a written retention policy, retention only as long as necessary for the purpose collected, and no indefinite retention. Publish it and implement it as an actual scheduled deletion job, not a paragraph in a privacy policy.

---

## The UK Children's Code, mapped to Fenced

The Code is 15 standards applying to services likely to be accessed by under-18s. The ones that change Fenced's design:

**Best interests of the child first.** The framing standard. For a focus app this is largely aligned already — helping a student reduce distraction *is* their interest — but it does bear on engagement mechanics, below.

**DPIA is mandatory.** The ICO's Art. 35(4) list includes offering online services directly to children, and Fenced additionally involves profiling-adjacent processing and behavioral data. A DPIA must be completed **before** processing begins and must specifically address profiling, geolocation, and nudge techniques. This is a launch deliverable with a named owner, not a post-launch tidy-up. **[LEGAL]**

**High privacy by default.** Every optional setting ships off for minors. Under the architecture above this is automatic, since optional processing is not offered to minors at all.

**Data minimization.** Collect only what the focus/task/calendar features need.

**Geolocation off by default**, with an obvious indicator while location is active, and any setting that makes a child's location visible to others must reset to off at the end of each session. This directly constrains the location-based focus zones feature — which is already deferred past v1. When it does ship, it must be unavailable to `child`, off by default for `teen`, and show a persistent active-location indicator.

**Profiling off by default.** No behavioral profiling of minors. Aggregate metrics the user asked for (their own focus minutes) are not profiling; cross-user modelling and engagement optimization are.

**No nudge techniques.** Read this standard precisely rather than over-reading it: what is prohibited is using nudges to lead children into **providing unnecessary personal data or weakening their privacy protections.** It is not a ban on streaks. A streak that encourages a student to do focused study is not the target of standard 13.

That said, the best-interests standard means engagement mechanics deserve care for minors. Practical rules: no loss-framed pressure ("you're about to lose your 12-day fence!"), no artificial urgency, no notification pressure to extend sessions, and never use a streak or reward as leverage to obtain data or a permission. Keep streaks descriptive rather than coercive. Document the reasoning in the DPIA, since it explicitly asks about nudge techniques.

**Transparency in child-friendly language.** A separate, plain-language privacy explanation for minors — not the adult policy with a friendlier heading.

**Age-appropriate application.** A risk-based approach to establishing age, with certainty proportionate to the risk. The Declared Age Range API plus a neutral fallback is a defensible position for a no-ads, no-UGC wellbeing app. **[LEGAL]**

---

## Feature availability by band

This table is the specification. It should be enforced server-side from a single policy module, never by client-side checks alone.

| Feature | `child` (<13) | `teen` | `adult` |
|---|---|---|---|
| Focus sessions and blocking | Yes | Yes | Yes |
| Fenced Hours | Yes | Yes | Yes |
| Strict mode (delay) | Yes, capped delay | Yes | Yes |
| Tasks and calendar | Yes | Yes | Yes |
| Streaks and fence line | Yes, no loss framing | Yes, no loss framing | Yes |
| Own insights | Yes | Yes | Yes |
| Cross-device sync | After VPC | Yes | Yes |
| Product analytics / session replay | Never | No | Consent |
| LLM-assisted features | Never | Never | Yes |
| Leaderboards, accountability groups | Never | Off, opt-in, private only | Yes |
| Location zones (post-v1) | Never | Off by default | Off by default |
| Marketing email | Never | Never | Consent |
| Personalized advertising | Never | Never | Never (no ads in Fenced) |
| Data export and deletion | Via guardian | Self + guardian | Self |

Two notes. The strict-mode delay should be capped for `child` users — an unbounded self-imposed lock is a wellbeing risk for a young user, and a 12-year-old choosing an 8-hour delay is a support ticket at best. And leaderboards for `teen` users, when they eventually ship, must be invite-only with no public profiles, no discovery, and no free-text display names.

---

## The AI rule

**No minor's data ever reaches a third-party model provider. No exceptions, no consent path in the MVP.**

This one rule resolves a cluster of problems at once. It removes the COPPA separate-consent requirement for AI training disclosure, since there is no disclosure. It removes the need for zero-retention contractual assurances covering children's data. It keeps profiling away from minors under the Children's Code. And it is trivially auditable: one check at the boundary of the AI service.

Implementation: the natural-language task parser already runs locally first — dates, times, durations, tags, priorities — and that local path is genuinely sufficient for the overwhelming majority of real input. For minors, the local parser is the *only* path; ambiguous input simply asks the user to clarify instead of escalating to a model. When AI auto-scheduling ships post-MVP, note that the scheduler itself is a deterministic solver with no model involved, so **minors can use AI scheduling in full** — only the optional LLM explanation layer is withheld. That is a happy accident of the architecture chosen for other reasons.

**[LEGAL]** For adult users, ensure your model provider agreement includes no-training and appropriate retention terms regardless.

---

## Analytics and third-party SDKs

- **No analytics events from `child` or `teen` accounts.** Not anonymized-and-sent — not sent. The SDK should be initialized with tracking disabled until the band resolves to `adult`, and the band must resolve before any behavioral data exists.
- **No advertising SDKs, ever.** Fenced has no ads, which sidesteps Play's Families Self-Certified Ads SDK requirements entirely. Note that Play treats **users of unknown age** as children for ad-serving purposes, which is another reason to resolve the band early.
- **No advertising identifiers** collected from minors (Android Advertising ID, IDFA).
- **Crash reporting** may run for minors, but scrub it: no user identifiers, no content, no screenshots, no session replay.
- **[LEGAL]** Under GDPR, consider EU data residency for the analytics and product-data stores. Focus and screen-time data is sensitive in substance even where it is not "special category" data in the technical sense.

---

## Guardian-facing surfaces

Supporting under-13s means building for a second user you had not previously designed for. The MVP needs:

- **Consent request screen** — collects guardian email, explains the service plainly.
- **Guardian notice email** — the COPPA direct notice, versioned so you can prove what was shown.
- **Guardian portal** (web, token-authenticated, no account required) — review what is collected, revoke consent, request export, request deletion. Deletion must actually cascade.
- **Consent revoked state** in the app — honest and non-punitive: the account stops syncing and reverts to local-only, and the child is told what happened in plain language rather than being shown an error.

Note that revocation is not a rare edge case; it is a right, and a broken revocation path is the kind of defect that generates regulator attention rather than a bug report.

### iOS parent-managed mode: worth understanding, not worth building yet

Family Controls has two authorization modes. `.individual` is the user authorizing restrictions on their own device. `.child` is a guardian authorizing from a parent device via iCloud Family Sharing, which is the mode the framework was originally designed around.

**Use `.individual` for all users in the MVP, including minors.** The minor authorizes Screen Time on their own device, with COPPA parental consent obtained separately through the flow above. A true parent-managed `.child` experience — parent installs on their device, links a child, configures fences remotely — is a substantially different product with its own onboarding, its own cross-device data flow, and Family Sharing dependencies. It is a strong post-MVP feature and a poor MVP scope decision.

One genuine upside worth noting: deliberately supporting minors and guardians **strengthens your Family Controls distribution entitlement request.** Apple wants to see a clear parental-control or digital-wellbeing use case, and a documented youth-safety design is exactly that. Reference this document in the request.

---

## Store submissions

### Apple

- **Complete the age rating questionnaire** under the current tiers: 4+, 9+, 13+, 16+, 18+. It now includes questions on in-app controls, medical and wellness topics, violence, and **AI chatbots** — answer the AI question accurately for the post-MVP LLM features.
- **Social media capability questions are now part of the questionnaire**, and responses are required for new submissions from **September 2026**. Since Fenced will submit after that date, this applies. A social media capability is defined as the ability to redistribute, amplify, or interact with user-generated content through a social feed or similar discovery mechanism.

  The MVP has none, so this is a clean "no." When leaderboards and accountability groups ship, they plausibly qualify — and there is a concrete design lever: Apple states that if you declare social capabilities **but disable them for anyone under 13**, the app is excluded from the Social Media Time Allowance category for under-13 users. The band-gating in the table above already achieves this.
- **Do not choose "Made for Kids."** It opts you into the Kids Category, whose rules are considerably stricter, and **the selection cannot be changed once App Review approves it.** Fenced is mixed-audience, not child-directed.
- Consider **Override to Higher Age Rating** if you set a minimum-age policy in your terms.
- Contextual awareness: iOS 27 introduces **Time Allowances**, letting parents manage time per app category. An OS-level feature adjacent to your product — worth tracking as both competition and a potential integration story.

### Google Play

- **Declare the target audience** in Play Console before publishing, including the child age groups. Any app with children in its target audience must comply with **Families Policy requirements**.
- **Neutral age screen** is mandatory for mixed audience.
- No ads means the Families Self-Certified Ads SDK requirement does not apply — but confirm no dependency pulls in an ads SDK transitively.
- **Privacy policy required both in the store listing and inside the app**, on an active URL, specific to the app.
- Complete the Data Safety declaration consistently with what you actually collect per band. Inconsistency here is a common rejection cause.
- Note Play's guidance that if your app targets **any** users under 21, you must consider whether they would be children under local law.
- Remove store-listing imagery or terminology that would push Google's own assessment of your target audience somewhere you did not intend.

---

## Data rights, for every user

Building these for minors means building them for everyone, which is the right outcome anyway.

- **Export** — machine-readable, all user data, self-service.
- **Deletion** — real cascading deletion with a stated maximum completion window, not a soft-delete flag.
- **Retention policy** — written, published, and implemented as a scheduled job. Required explicitly by the amended COPPA Rule.
- **Correction** — including a deliberate, re-verified path to correct an age band entered wrongly.
- **Consent and processing record** — immutable log of what was consented to, when, under which notice version.

---

## Build implications summary

What this decision adds to the MVP:

1. **Age assurance before any behavioral data.** Declared Age Range on iOS 26+, neutral screen elsewhere. This is why login moves to the front of onboarding — see [user flows](01-user-flows.md).
2. **Age band on the user record**, with jurisdiction, resolved server-side and enforced by a single policy module.
3. **A feature policy layer** rather than scattered conditionals.
4. **VPC flow for US under-13s**, via a vendor.
5. **Guardian portal** for notice, review, revocation, export, deletion.
6. **Analytics disabled for minors** at the SDK boundary.
7. **A hard boundary keeping minors' data out of LLM calls.**
8. **Data export, deletion, and retention jobs** from day one.
9. **DPIA** completed before launch. **[LEGAL]**
10. **Child-friendly privacy notice** as a distinct document.
11. **Store declarations** for both platforms, done accurately.

What it removes from the MVP, which is not a coincidence: leaderboards and social features, marketing to minors, analytics on minors, and any AI processing of minors' data. Every one of those was going to be complicated for other reasons.

The honest cost estimate is a few weeks of engineering plus a legal engagement, and it lands almost entirely in the account and data layer rather than in the blocking layer where the project's real technical risk lives. Doing it now is dramatically cheaper than retrofitting it after you have a user base whose ages you never established.
