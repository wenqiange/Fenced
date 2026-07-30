# Visual and Brand Direction

## The central idea

**The fence gets built while you focus.**

A session lays pickets one at a time. Completing a session finishes a panel. Consecutive days extend the fence line across the property. Break the streak and the line has a gap in it — visible, but repairable.

This single metaphor does four jobs that competitors need four unrelated mechanics for:

| Job | How the fence does it |
|---|---|
| Session progress | Pickets appear as minutes pass |
| Streak counter | The fence line extends day over day |
| Gamification (later) | Panels, gates, and fence styles unlock with XP |
| Blocking status | A closed gate means the fence is up |

Forest gets enormous mileage from one growing tree, but a tree is a *single-session* metaphor — it maxes out in 25 minutes and cannot express three months of consistency. A fence line is inherently cumulative and directional. It grows sideways forever, it can have gaps, and a long one looks impressive in a way a screenshot of a tree does not. That extensibility is the reason to build the whole visual system on it rather than treating it as decoration.

It also carries the product's exact emotional register. A fence is not a cage. It marks *your* territory, you decide where it goes, and there is a gate. That is precisely the difference between Fenced and a punitive blocker — and it is the argument for why "fence" is a better frame for knowledge workers than "lock."

---

## Positioning and voice

**Fenced builds a boundary around your attention and your calendar.**

The brand is calm, grounded, and physical. It is not a hype product, a hustle product, or a shame product. The competitive set skews two ways — cute and gamified (Forest) or clinical and severe (Opal, Freedom) — and there is open ground between them for something that feels like well-made physical equipment. Think a good notebook or a well-balanced hand tool rather than a video game or a productivity dashboard.

### Voice principles

**Plain, not clever.** "Instagram and 4 more are fenced until 10:25." Not "Your digital sanctuary is now active."

**Never shame the user.** They already feel bad about their phone; that is why they installed this. Shame produces uninstalls, not behavior change.

- Yes: "You reached for a fenced app 14 times today. Last week it was 31."
- No: "You failed to resist 14 times."

**Report, do not moralize.** State the number and let the user draw the conclusion. The data is motivating on its own.

**Honest about limits.** This is a brand position, not just a legal one — see the strict-mode and analytics sections in [platform constraints](05-platform-constraints.md). The iOS privacy line is the best example: "We can't see what you do in your apps. Apple doesn't tell us." It is literally true and no competitor can claim it more strongly.

**Own the exits.** Users can always get out, and pretending otherwise makes a user who discovers the escape hatch feel deceived. "Strict mode makes quitting deliberately hard" is credible. "Unbypassable" is a future one-star review. Since strict mode is a delay the user chose themselves when arming the session, the honest framing is easy: "You set a 30-minute delay. 24 minutes left."

**No pressure, especially not on minors.** Fenced supports under-16 users, which makes this a compliance requirement as well as a brand one. The UK Children's Code applies to everyone under 18 and prohibits nudge techniques that push children into giving up data or weakening privacy protections; the broader best-interests standard also bears on manipulative engagement design.

Read that precisely: **streaks are not prohibited.** A streak that encourages a student to study is not what the standard targets. What is out of bounds:

- Loss-framed pressure. "You're about to lose your 12-day fence!" becomes "Your fence line is 12 days long."
- Manufactured urgency, countdowns to nothing, or notification pressure to extend a session.
- Any use of a streak, badge, or reward as leverage to obtain data or a permission. Never "unlock a badge by turning on location."

Keep progress language descriptive rather than coercive and this costs the brand nothing — it is already the calm, non-shaming register described above. Document the reasoning in the DPIA, which explicitly asks about nudge techniques. See [youth compliance](06-youth-compliance.md).

### The shield screen deserves its own voice

This is the screen a user sees when they are mildly annoyed at your product — the highest-stakes copy surface in the app, and the one most teams leave as a default string.

Get it right: state the fact, state the time remaining, offer the honest exit. Do not lecture, do not congratulate, do not use an exclamation mark.

- "Fenced until 10:25. 18 minutes left."
- Secondary, quiet: "End session early"

Never: "Get back to work!" or "Was this really that important?"

---

## Color

A grounded palette drawn from timber, pine, and daylight. Deliberately avoids the purple-to-blue gradient that reads as generic SaaS, and avoids the neon-on-black look that reads as a gaming app.

### Core

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Pine | `#1F3D30` | Brand, headers, primary buttons, fence structure |
| Primary light | Pine 600 | `#2E5A46` | Hover, secondary fills |
| Accent | Timber | `#C08A4E` | Fence pickets, active session, streak |
| Accent light | Sand | `#E8D5BA` | Backgrounds of fence elements, empty pickets |
| Surface | Paper | `#FAF7F2` | App background, light mode |
| Surface raised | `#FFFFFF` | Cards |
| Text | Ink | `#171A18` | Primary text |
| Text muted | Slate | `#5C6560` | Secondary text |

### Semantic

| Role | Hex | Use — and only this use |
|---|---|---|
| **Breach** | `#D4761F` | Shield hits, early exits, broken streaks. Nothing else. |
| Success | `#2E7D5B` | Completed sessions, finished tasks |
| Error | `#B3402E` | Destructive actions, failures |
| Info | `#3A6E8F` | Neutral system messages |

**Breach amber is the most important rule in the palette.** It is reserved exclusively for boundary events — the user bumped into a fence, quit early, or broke a streak. Because it appears nowhere else, it acquires meaning: over a few weeks users learn that amber means *you pushed against your own boundary*, and it becomes legible at a glance in the Insights heatmap without a legend. Spend it anywhere else and you lose that for free.

Note it is distinct from Timber, which is the fence's own material color and appears constantly. Amber is hotter and more saturated. Verify they are distinguishable for users with color vision deficiency, and never rely on the difference alone — pair breach states with an icon or label.

### Dark mode is the primary mode for focus surfaces

The active session screen, shield screen, and Fenced Hours screens are dark by default regardless of system setting. A bright white screen during deep work is hostile, and dark focus surfaces create a clear felt boundary between "in a session" and "not in a session."

| Role | Hex |
|---|---|
| Background | `#121714` |
| Surface | `#1B231E` |
| Fence structure | `#2E5A46` |
| Picket (filled) | `#C08A4E` |
| Picket (empty) | `#2A332C` |
| Text | `#F2F0EB` |
| Text muted | `#98A29B` |

Everything else follows the system setting.

Contrast: all body text meets WCAG AA (4.5:1); large text and UI elements meet 3:1. Timber on Paper is the risky pair — check it, and darken to `#A8732F` for text use where needed.

---

## Typography

**UI:** a geometric sans with slightly squared terminals — the letterforms should feel constructed rather than organic, echoing posts and rails. Good candidates: **Geist**, **Inter Tight**, or **Söhne**. Geist is free, variable, and its squared quality fits the concept.

**Wordmark:** something heavier and more architectural than the UI face. A condensed or extra-bold grotesque, with the option of a custom `F` (see below).

**Numerals:** tabular in all timers, counters, and stats. A countdown where the digits shift width is a visible defect.

**Scale** (mobile, in points):

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| Display | 40 / 44 | 700 | Session timer |
| Title 1 | 28 / 34 | 700 | Screen titles |
| Title 2 | 22 / 28 | 600 | Section headers |
| Headline | 17 / 22 | 600 | Card titles, list emphasis |
| Body | 16 / 24 | 400 | Default |
| Callout | 15 / 20 | 400 | Secondary |
| Caption | 13 / 18 | 500 | Labels, metadata |
| Micro | 11 / 14 | 600 | Tags, badges, uppercase with tracking |

The session timer is the app's largest type and should be set in the display size with tabular figures, generous tracking, and nothing competing with it on screen.

Support Dynamic Type and Android font scaling. The timer and the shield screen must remain legible at the largest accessibility sizes — test them specifically, since both have tight vertical layouts.

---

## Logo and marks

### Wordmark

`FENCED` set in the heavy architectural face, with tracking opened slightly so the letters read as separated posts. Optional refinement: the crossbars of the `E`s aligned to a shared horizontal so they scan as fence rails running through the word. Subtle enough not to be a gimmick, deliberate enough to notice on the second look.

### App icon

An `F` constructed from fence geometry: two vertical posts and two horizontal rails, where the rails are the `F`'s arms. Timber on Pine.

Construction constraints:

- Legible at 16px (favicon) and 1024px (store listing)
- Works in solid monochrome for the Android adaptive monochrome layer and the iOS tinted variant
- No gradients, no shadows, no text
- Distinguishable in a folder next to Forest, Opal, and Todoist — the Pine-and-Timber pair is warmer than any of them, which is the differentiator at thumbnail size

Provide the Android adaptive set (background, foreground, monochrome) with the `F` centered inside the 66dp safe zone, since aggressive circular masking will clip a corner-anchored mark.

### The fence system

Beyond the logo, the fence is a reusable component with defined parts:

- **Post** — vertical structural member, Pine
- **Picket** — the progress unit, Timber when filled, muted when empty
- **Rail** — horizontal connector between posts
- **Panel** — one complete session's worth of pickets
- **Gate** — the session state indicator: closed means fenced, open means free
- **Line** — the accumulated run of panels, one per day

These names should appear in the codebase too. A shared vocabulary between design and engineering prevents the fence from being reimplemented three different ways on three screens.

---

## Motion

**Everything latches.** The governing feel is a mechanism engaging — a gate catch, a bolt sliding home. Snappy and decisive, never soft and floaty. Prefer short durations with a slight overshoot-and-settle rather than long springs.

| Interaction | Duration | Feel |
|---|---|---|
| Session start (gate closes) | 400ms | Swing, then hard catch with overshoot |
| Picket placement | 180ms | Drops in and settles |
| Panel completion | 600ms | Rails connect, subtle warm glow |
| Session end (gate opens) | 350ms | Releases and swings wide |
| Shield appears | 150ms | Fast, opaque, decisive |
| Streak extends | 500ms | New panel slides in from the right |
| Tab change | 200ms | Standard crossfade, no fence involved |

### Specific moments worth building properly

**Session start** is the app's signature interaction and deserves disproportionate polish. The gate swings shut, catches with an audible latch, and the fence line settles. Haptic thump synchronized to the catch, not to the tap. Users will trigger this several times a day for months.

**Picket placement during a session** is the only motion on an otherwise static screen. It must reward a glance and never invite a stare — a single picket dropping in every few minutes, no continuous animation, nothing that pulses or breathes. Anything hypnotic defeats the screen's purpose.

**Android shield entrance** should be fast and fully opaque. Because Android polls at roughly 800ms, the user glimpses their feed before the overlay lands; a quick decisive entrance reads as interception, while a slow fade reads as arriving late. This is a case where motion design compensates for a platform constraint.

**Early exit gets a deliberately unrewarding animation.** The gate opens partway and stops. No fanfare, no completion glow, and the panel stays visibly unfinished. Not punitive, just plainly incomplete — the absence of reward is the feedback.

Respect Reduce Motion: replace all fence animation with instant state changes, keep haptics and sound. Never make animation load-bearing for comprehension.

---

## Sound and haptics

Sound is off by default except during focus sessions, and every cue has a haptic equivalent for silent use.

| Event | Sound | Haptic |
|---|---|---|
| Session start | Wooden latch click | Sharp single thump |
| Panel complete | Warm two-note resolve | Double light tap |
| Shield hit | Soft muted knock | Light single tap |
| Session complete | Longer resolving chime | Success pattern |
| Early exit | Latch releasing, unresolved | Single soft tap |

The palette is wood and mechanism — clicks, catches, knocks — not bells, chimes, or synths. The shield-hit knock is worth care: it should register as "you bumped into something" rather than as an error or an alarm. This is the sound of the boundary working correctly.

Focus audio (white noise, brown noise, rain, café) is a separate first-party system, not part of this palette. It ships in the MVP; Spotify integration is a documented future addition rather than a v1 feature, since playback control requires the user to have Spotify Premium while first-party audio works offline for everyone.

---

## Illustration and imagery

- **Fence-derived geometry over stock illustration.** Empty states, onboarding, and achievements all draw from posts, rails, pickets, and gates.
- **Flat with a single light source.** Slight warmth, no gradients beyond a subtle vertical wash, no 3D renders.
- **No mascot.** A character pushes the brand toward Forest's territory and undercuts the grounded, adult register that differentiates it.
- **No photography of people at desks.** Every productivity app uses it and it says nothing.
- **Achievement badges** (later) are fence styles and gate types — picket, rail, lattice, stone, iron — which scales naturally as a long unlock ladder without inventing unrelated iconography.

---

## Themes (later)

Themes reskin the fence material rather than recoloring the whole UI, which keeps the app's structure recognizable and makes each theme a genuinely distinct object.

Pine (default), Oak, Slate, Iron, Bamboo, Whitewash, plus a high-contrast accessibility theme. If themes ever become a paid feature, the accessibility theme stays available to everyone — charging for accessibility is not defensible.

Each theme defines only the fence material colors, the accent, and the focus-surface background. Semantic colors — especially breach amber — stay constant across all themes, because their meaning depends on being consistent.

---

## Naming conventions

Get these right and the product explains itself.

| Concept | Term | Not |
|---|---|---|
| A set of blocked apps | **a fence** | blocklist, blacklist |
| Blocking is active | **fenced** | locked, blocked |
| A focus period | **a session** | a sprint, a pomodoro |
| Scheduled sessions | **Fenced Hours** | auto-lock, schedules |
| Bumping into a block | **a shield hit** | violation, failure, attempt |
| Consecutive days | **your fence line** | streak (in UI; "streak" is fine in marketing) |
| The strict-mode wait | **your delay** | punishment, lockout, penalty |
| Location triggers (later) | **zones** | geofences |
| Ending early | **leaving early** | quitting, failing, giving up |

Three of these are load-bearing. **"Fenced," never "locked"** — the app cannot lock a phone on iOS, so "locked" is both inaccurate and a source of one-star reviews from users expecting a dark screen. **"Shield hit," never "failure"** — it is the app's most-shown metric, and if the word carries judgment then the single most motivating number in the product becomes something users avoid looking at. And **"your delay," never "penalty"** — the user chose that number themselves when arming the session, so the possessive is accurate and it keeps the feature framed as self-commitment rather than punishment inflicted by the app.
