# Graph Report - Fenced  (2026-11-04)

## Corpus Check
- 223 files · ~101,105 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .example 1, (none) 1)

## Summary
- 1745 nodes · 5094 edges · 103 communities (84 shown, 19 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 90 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102

## God Nodes (most connected - your core abstractions)
1. `useThemeColors()` - 106 edges
2. `useThemedStyles()` - 86 edges
3. `Txt()` - 68 edges
4. `react` - 53 edges
5. `SessionBody()` - 49 edges
6. `AnimatedPressable` - 47 edges
7. `useAppSelector()` - 44 edges
8. `useAuth()` - 44 edges
9. `getAppState()` - 44 edges
10. `expo-router` - 42 edges

## Surprising Connections (you probably didn't know these)
- `syncAllCalendars()` --calls--> `canAccess()`  [EXTRACTED]
  apps/api/src/integrations/calendar-sync.ts → packages/policy/src/feature-access.ts
- `consentPending()` --calls--> `requiresParentalConsent()`  [EXTRACTED]
  apps/api/src/trpc/routers/user.ts → packages/policy/src/feature-access.ts
- `TasksScreen()` --calls--> `describeRrule()`  [EXTRACTED]
  apps/mobile/app/(tabs)/tasks.tsx → packages/nlp/src/describe.ts
- `TasksScreen()` --calls--> `parseTaskInput()`  [EXTRACTED]
  apps/mobile/app/(tabs)/tasks.tsx → packages/nlp/src/parser.ts
- `askAi()` --calls--> `parseTaskInput()`  [EXTRACTED]
  apps/mobile/app/(tabs)/tasks.tsx → packages/nlp/src/parser.ts

## Import Cycles
- None detected.

## Communities (103 total, 19 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (78): getAiRuntime(), googleApiKey(), openaiApiKey(), resolveProvider(), ageBandFromCtx(), aiRouter, mapAiError(), OnboardingState (+70 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (54): createStyles(), PlanningChatScreen(), applyProposeTool(), blockTitle(), createStyles(), TimeBlockScreen(), accept(), requestAdvice() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (62): createStyles(), DAY_LABELS, FenceHubScreen(), addStudyBlock(), localId(), uuidv4(), addCalendarEvents(), addFence() (+54 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (39): createStyles(), Index(), createStyles(), GuardianStep(), createStyles(), HookScreen(), Msg, AppearanceScreen() (+31 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (35): fencedHours, fences, projects, sessions, streaks, taskDependencies, tasks, authedProcedure (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (35): buildUserCalendar(), dateKey(), eventToIcs(), FeedOptions, fencedHourToIcs(), shiftDateKey(), taskToIcs(), buildCalendar() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (31): FenceAssemblyView, FenceAssemblyViewProps, FenceState, Panel(), Picket, DayPanel, FenceLineStreakBanner, richness() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (31): captureException(), armRetryTimer(), configureSync(), drainOnce(), flushOutbox(), HANDLERS, scheduleFlush(), SyncConfig (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (31): createStyles(), ExplainerScreen(), grant(), skip(), createStyles(), PrivacyScreen(), useOnboarding(), defaults (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (29): createStyles(), FirstSessionScreen(), skip(), createStyles(), IntentScreen(), choose(), ORDER, createStyles() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (27): createStyles(), FocusSoundsScreen(), ICONS, ToggleRow(), VOLUMES, BREAKS, IconName, Mode (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (29): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, projectId, com.apple.developer.declared-age-range, com.apple.developer.family-controls (+21 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (25): applySyncedState(), getAppState(), pullCalendarEvents(), RemoteEvent, Client, localIdOf(), PushHandler, toIso() (+17 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (16): @hono/node-server@^1.14.0, app, VpcWebhookPayload, decodeJwtSub(), resolveAuth(), db, consentEvents, users (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (28): dependencies, ai@^4.3.0, @fenced/core@workspace:*, @fenced/policy@workspace:*, zod@^3.25.0, devDependencies, tsx@^4.19.0, @types/node@^22.0.0 (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (23): AgendaItem, createStyles(), greeting(), TaskLine(), timeOf(), TodayScreen(), atHour(), EveningRitualSheet() (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (17): callApi(), exchangeCode(), fetchAccountEmail(), GOOGLE_SCOPES, GoogleApiError, GoogleCalendarSummary, GoogleEvent, GoogleEventTime (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (24): AmbientId, binaural(), brownNoise(), encodeWav(), env(), normalize(), pinkNoise(), prng() (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (23): start(), getDefaultFence(), getTaskById(), recordEmergencyPassUse(), toggleTask(), beginSession(), markTaskDone(), passesLeft() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (21): createStyles(), dayFrom(), dependentsOf(), ESTIMATES, nextMonday(), PRIORITIES, TaskDetailScreen(), TIMES (+13 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (19): baseline, baselineHash, baselineSql, journal, migrationsDir, sql, recordEventDeletion(), decryptOptional() (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (23): calendarConnections, calendarEvents, accessTokenFor(), addDays(), applyPulledPage(), CalendarEventRow, Connection, dateKey() (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (21): Bootstrap(), createStyles(), RootLayout(), ThemedRoot(), ApiContext, ApiProvider(), Client, AuthContext (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (23): dependencies, date-fns@^4.1.0, @fenced/core@workspace:*, devDependencies, tsx@^4.19.0, @types/node@^22.0.0, typescript@~5.8.0, exports (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (19): AgeScreen(), next(), Cell(), COUNTRIES, countryName(), createStyles(), DECADES, detectCountry() (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (18): generateCoach(), completed(), computeReachMap(), currentStreak(), fenceLine(), FenceLineDay, HistorySession, HourBucket (+10 more)

### Community 26 - "Community 26"
Cohesion: 0.09
Nodes (12): AuthorizationStatus, BlockingMode, FencedBlocking, Listener, NativeFencedBlocking, PlatformCapabilities, SANDBOX_CATALOG, SandboxApp (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (21): dependencies, zod@^3.25.0, devDependencies, tsx@^4.19.0, @types/node@^22.0.0, typescript@~5.8.0, exports, tsx (+13 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (21): ADVERB_FREQ, buildRrule(), DAY_CODES, DAY_ORDER, DAY_WORDS, dayCode(), ExtractedRecurrence, extractRecurrence() (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (21): dependencies, @fenced/core@workspace:*, devDependencies, tsx@^4.19.0, @types/node@^22.0.0, typescript@~5.8.0, exports, @fenced/core (+13 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (18): setRemoteId(), pushCalendarEvent(), Collection, deleteRemote(), DependencyPending, findLocal(), remoteFenceId(), remoteIdOf() (+10 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (20): dependencies, @fenced/api@workspace:*, superjson@^2.2.0, @trpc/client@^11.0.0, devDependencies, @types/node@^22.0.0, typescript@~5.8.0, superjson (+12 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (19): ageBandEnum, assuranceMethodEnum, calendarConnectionsRelations, calendarEventsRelations, calendarFeedsRelations, calendarProviderEnum, calendarSourceEnum, calendarSyncTombstonesRelations (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (18): CalendarScreen(), createStyles(), fmtTime(), sameDay(), startOfWeek(), ViewMode, WEEKDAYS, WeekView() (+10 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (20): dependencies, @clerk/expo@^3.7.8, expo-clipboard@~8.0.8, expo-file-system@~19.0.24, expo-haptics@~14.1.0, expo-linking@~8.0.12, expo-router@~5.1.11, expo-sharing@~14.0.8 (+12 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (19): devDependencies, tsx@^4.19.0, turbo@latest, @types/node@^22.0.0, typescript@~5.8.0, tsx, @types/node, typescript (+11 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (18): devDependencies, tsx@^4.19.0, @types/node@^22.0.0, typescript@~5.8.0, exports, tsx, @types/node, typescript (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.17
Nodes (15): activeConsent(), ConsentEventState, isConsentActive(), Database, calendarFeeds, calendarSyncTombstones, BAND_RANK, CategorySchema (+7 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+8 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (16): dependencies, ai@^4.3.0, @ai-sdk/google@^1.2.22, @ai-sdk/openai@^1.3.0, drizzle-orm@^0.44.0, @fenced/ai@workspace:*, @fenced/policy@workspace:*, hono@^4.7.0 (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (14): CalendarExportScreen(), createStyles(), Feed, FEED_OPTIONS, FeedOptionKey, googleSubscribeUrl(), createStyles(), ExportDataScreen() (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (12): CoFocusCircle, CoFocusMember, summarizeCirclePresence(), FreeGap, GravityPlacement, planDeadlineGravity(), PlanGravityOptions, FamilyPact (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (15): dependsOn, outputs, cache, cache, persistent, $schema, tasks, build (+7 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (7): ageBandFromCtx(), featureAllowed(), requireFeature(), analytics, AnalyticsService, EventName, canAccess()

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (14): SessionBody(), cycleSound(), finishOnboarding(), leaveEarly(), openLeave(), toggleMute(), hapticRelease(), setUnacknowledgedCompletedSession() (+6 more)

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (12): submitTask(), RemoteTask, Priority, extractTime(), findDanglingTemporal(), formatDay(), parseTaskInput(), Ambiguity (+4 more)

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (14): expo-audio@~1.1.1, expo-secure-store@~14.2.4, @fenced/ai@workspace:*, react-native-screens@~4.11.0, react-native-web@^0.20.0, @fenced/ai, main, name (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (13): AuthScreen(), ClerkAuthScreen(), handleSignIn(), handleSignUp(), handleVerify(), pickErrorMessage(), createStyles(), DevAuthScreen() (+5 more)

### Community 49 - "Community 49"
Cohesion: 0.21
Nodes (11): AnimatedPressableProps, ButtonKind, buttonStyles(), cardStyles(), chipStyles(), IconName, TextTone, TextVariant (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.16
Nodes (13): devDependencies, react-native@0.79.6, typescript@~5.8.0, react-native, typescript, main, name, private (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (12): @fenced/core@workspace:*, @fenced/ical@workspace:*, exports, ./router, @fenced/core, main, name, private (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.21
Nodes (6): defaultStore, MemoryRateLimitStore, rateLimit(), RateLimitHit, RateLimitStore, appWith()

### Community 53 - "Community 53"
Cohesion: 0.28
Nodes (10): SessionScreen(), SessionSummary(), Stat(), styles(), ActiveSessionBanner(), useNow(), SessionHistoryEntry, formatClock() (+2 more)

### Community 54 - "Community 54"
Cohesion: 0.27
Nodes (12): aiToParsedTask(), applyClarification(), createStyles(), Filter, FILTERS, fmtDue(), Meta(), PRIORITY_TONE (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (13): devDependencies, @bacons/apple-targets@^5.0.0, expo-build-properties@~0.13.0, tsx@^4.19.0, @types/node@^22.0.0, @types/react@~19.0.0, typescript@~5.8.0, tsx (+5 more)

### Community 56 - "Community 56"
Cohesion: 0.18
Nodes (4): base, L, R, day

### Community 57 - "Community 57"
Cohesion: 0.18
Nodes (11): devDependencies, typescript@~5.8.0, typescript, main, name, private, scripts, lint (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (8): dotenv@^16.5.0, postgres@^3.4.7, drizzle-kit@^0.31.0, sql, sql, dotenv, drizzle-kit, postgres

### Community 59 - "Community 59"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:migrate-v3, db:migrate-v4, db:push, db:studio (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (8): consumedNonces, createOAuthState(), secret(), sign(), StatePayload, sweepExpiredNonces(), verifyOAuthState(), KEY

### Community 61 - "Community 61"
Cohesion: 0.20
Nodes (9): compilerOptions, module, moduleResolution, outDir, rootDir, target, extends, include (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.24
Nodes (9): CalendarSyncScreen(), Connection, createStyles(), DIRECTIONS, formatSyncTime(), GoogleCalendar, Status, SyncDirection (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (9): createStyles(), hourLabel(), InsightsScreen(), fenceWeakHour(), Legend(), pad(), Stat(), Badge() (+1 more)

### Community 64 - "Community 64"
Cohesion: 0.20
Nodes (10): scripts, android, build:android, build:ios, dev, ios, lint, prebuild (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.24
Nodes (9): applyTime(), DAY_NAMES, extractDate(), ExtractedDate, ExtractedTime, findDate(), MONTH_NAMES, monthDayDate() (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.22
Nodes (9): devDependencies, tsup@^8.4.0, tsx@^4.19.0, @types/node@^22.0.0, typescript@~5.8.0, tsx, @types/node, typescript (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.56
Nodes (8): setActiveSession(), finishSession(), resumeShield(), setBreakShield(), advance(), isShieldPaused(), SessionRuntime(), tick()

### Community 68 - "Community 68"
Cohesion: 0.33
Nodes (7): DAY_LABELS, describeDays(), describeMonthDay(), describeRrule(), parseUntil(), PLAIN_LABELS, UNIT_LABELS

### Community 69 - "Community 69"
Cohesion: 0.42
Nodes (7): allOccurrences(), dayIndex(), daysInMonth(), nextOccurrence(), parseRrule(), parseUntil(), WEEKDAY_CODES

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, paths, strict, extends, include, expo/tsconfig.base.json

### Community 71 - "Community 71"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (7): Chronotype, computeEnergyCurve(), EnergyProfile, EnergyTaskInput, rebuildDay(), RebuiltDaySlot, SessionRecord

### Community 73 - "Community 73"
Cohesion: 0.38
Nodes (5): layoutDay(), MonthCell, monthMatrix(), PlacedItem, TimedItem

### Community 74 - "Community 74"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 75 - "Community 75"
Cohesion: 0.33
Nodes (4): config, { getDefaultConfig }, expo@~54.0.36, expo

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 77 - "Community 77"
Cohesion: 0.33
Nodes (5): calculateLoadScore(), DEEP_TAGS, FenceRecommendation, LoadScoreResult, TaskLoadInput

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 79 - "Community 79"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, extends, include, ../../tsconfig.base.json

### Community 83 - "Community 83"
Cohesion: 0.40
Nodes (4): ClassModeSchedule, ClassModeStatus, evaluateClassMode(), TimetablePeriod

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (3): computeYardProgression(), YardGardenState, YardTier

## Knowledge Gaps
- **21 isolated node(s):** `../../tsconfig.base.json`, `RFC-4122`, `expo/tsconfig.base.json`, `../../tsconfig.base.json`, `../../tsconfig.base.json` (+16 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 524 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useThemeColors()` connect `Community 3` to `Community 1`, `Community 2`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 15`, `Community 19`, `Community 22`, `Community 24`, `Community 33`, `Community 41`, `Community 45`, `Community 48`, `Community 49`, `Community 53`, `Community 54`, `Community 62`, `Community 63`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `../../tsconfig.base.json`, `RFC-4122`, `expo/tsconfig.base.json` to the rest of the system?**
  _21 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0526111434672879 - nodes in this community are weakly interconnected._
- **Why does `date-fns` connect `Community 23` to `Community 65`, `Community 28`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05706760316066725 - nodes in this community are weakly interconnected._
- **Why does `@trpc/client` connect `Community 31` to `Community 4`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06634615384615385 - nodes in this community are weakly interconnected._