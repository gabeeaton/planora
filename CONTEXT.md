# Planora — Full App Context

## What it is
AI-powered academic execution system for US college students. Not a to-do list — a system that tells students when to study, ranks what matters most, and catches them when they're falling behind. Built by Gabe Eaton, solo founder, college student.

**AI coach name:** Tally (pencil mascot, friendly/casual tone)
**Primary goal:** $10k MRR. iOS App Store launch August/September 2026 (orientation week).
**Current status:** App Store submission rejected May 2026. Addressing 3 issues (IAP products not submitted, paywall pricing hierarchy, EULA link). Resubmission in progress.

---

## Tech Stack
- React Native + Expo SDK 54 (bare workflow)
- Firebase — Firestore (tasks, profiles, chat history), Auth (email/password)
- RevenueCat — subscriptions. Entitlement ID: `Planora Pro`. **iOS key is still sandbox (`test_ALnfmCuADwhSpHSVMQEzKOaPDMM`) — needs production key before resubmission.**
- OpenAI GPT-4o — Study Plan generation
- OpenAI GPT-4o-mini — AI priority ranking, Tally chat, Tally Brief
- Vercel — serverless proxy (OpenAI key never touches client)
- expo-notifications — push notifications
- expo-calendar — read calendar events + write study sessions to device calendar
- PostHog — analytics (active)
- Sentry — crash reporting (active)
- Outfit font family (5 weights)
- EAS — builds + App Store submission (projectId: `b06573e3-d986-4a3f-9fc5-704de3962c20`)

---

## Key Files
- `src/screens/DashboardScreen.js` — main task list, Tally Brief, Tally's Picks, behavioral insight strip
- `src/screens/StudyPlanScreen.js` — AI study plan, availability picker, calendar export, plan streak
- `src/screens/StatsScreen.js` — GPA calculator, class health, activity chart, term countdown
- `src/screens/ChatScreen.js` — Tally AI coach chat (GPT-4o-mini)
- `src/screens/ProfileScreen.js` — classes, term, work time, theme picker, dev Scholar toggle
- `src/screens/PaywallScreen.js` — Annual → Lifetime → Monthly, 7-day trial on Annual/Monthly
- `src/screens/OnboardingScreen.js` — 4-step: term → import → classes → work time
- `src/screens/CalendarScreen.js` — calendar events view
- `src/services/openai.js` — AI logic: study plan generation, Tally chat, priority ranking, focus card
- `src/services/notifications.js` — 24h/2h reminders, avoidance alerts, weekly digest, study plan reminders
- `src/services/purchases.js` — RevenueCat wrapper
- `src/services/firebase.js` — Firestore CRUD
- `src/hooks/useTasks.js` — task CRUD, streak, behavioral patterns
- `src/hooks/useSubscription.js` — RevenueCat + Firestore isPro check. DEV: `__DEV__` guards the Firestore sync so sandbox key doesn't nuke isPro.
- `src/hooks/useCalendarEvents.js` — expo-calendar read hook
- `src/components/TodayFocusCard.js` — Tally's Picks card (AI-selected tasks, sorted by urgency × priority score)
- `src/components/Mascot.js` — animated pencil mascot (variants: alive, writing, bounce, tap, etc.)
- `src/components/TaskCard.js` — individual task row with priority badge, avoidance chip, class tag
- `src/utils/streakHelpers.js` — task streak + plan streak logic (with rest day carry-forward)
- `src/utils/theme.js` — colors, typography, spacing, radius, shadows
- `src/utils/patternAnalysis.js` — avoidance scores, lateness profile, productive time detection
- `src/config.js` — feature flags

---

## Feature Flags (`src/config.js`)
```js
BETA_PRO_UNLOCKED:     false  // true = everyone gets Scholar
FORCE_ONBOARDING:      false
FORCE_WALKTHROUGH:     false
FORCE_SEMESTER_PROMPT: false
DEMO_MODE:             false  // canned data for App Store screenshots
DEV_SCHOLAR_OVERRIDE:  false  // Scholar toggle in Profile (dev only)
```

---

## Subscription Model
**Plans:** Annual ($29.99/yr, Best Value) → Lifetime ($199.99 one-time, anchor) → Monthly ($4.99/mo)
**Paywall default:** Annual selected. Order is intentional — Lifetime anchors Annual.
**Trials:** 7-day free trial on Monthly and Annual. No trial on Lifetime (App Store rules).
**IAP product IDs:**
- `com.planoraapp.monthly` — Auto-Renewable Subscription
- `com.planoraapp.annual` — Auto-Renewable Subscription
- `com.planoraapp.lifetime` — Non-Consumable

### Free vs Scholar

**Free (permanently useful):**
- Canvas/ICS import (Canvas, Brightspace, Blackboard, Moodle)
- Unlimited task creation + AI priority ranking (5 AI calls/day)
- 24h AND 2h deadline reminders (both free — differentiator)
- Avoidance indicator on task cards ("4d untouched")
- Tally's Picks (AI daily focus card)
- Tally's Brief (AI daily coaching message)
- Stats: completion rate, streak, overdue count, per-class health
- Focus Mode (25/5 Pomodoro)
- Calendar view
- Weekly digest notification (Sundays)
- Task streak

**Scholar only:**
- Study Plan generation (AI day-by-day session schedule — no competitor has this)
- Plan streak tracking
- Export study sessions to Google/Apple/Outlook calendar
- Unlimited Tally chat + persistent cross-device history
- Avoidance alert push notifications
- Study Plan session reminders

**Add-ons (post $1k MRR):**
- SMS reminders — $0.99/month
- Parent dashboard — $4.99/month
- Extra AI message pack — $0.99 for 50 messages

---

## Core Features in Detail

### Study Plan
- Student sets available hours per day (0–6h presets)
- AI (GPT-4o) generates sessions distributed across the week respecting deadlines, class schedule, calendar events
- Task types pre-classified client-side (EXAM, ESSAY, DISCUSSION, HOMEWORK, etc.) before API call
- Rules: same-class daily cap (max 2 sessions/class/day), rest day only if all deadlines 6+ days away, no sessions during class time
- Sessions include: title, date, duration, specific activity (2 sentences), tip
- Missed sessions detected on load (yesterday's uncompleted sessions show as missed)
- Plan cached to AsyncStorage, triggers `studyPlanUpdated` event on save
- Export to Calendar: groups available calendars by provider (Google Calendar, Apple Calendar, Outlook), adds sessions at 8AM with 30-min reminder

### Tally's Picks (TodayFocusCard)
- AI selects 2–3 task IDs to focus on today
- Displayed sorted by composite score: urgency × priority (not date alone)
  - urgency: overdue=10, today=8, tomorrow=5, 2 days=3, ≤4 days=2, else=1
  - priority: HIGH=3, MEDIUM=2, LOW=1
- Falls back to top 3 by score if AI call fails or returns nothing
- Cached with 30-min TTL in openai.js

### Tally Brief (aceCard in DashboardScreen)
- Client-side daily brief built from tasks, patterns, streak data
- No API call — pure JS logic in `polishAceBrief` / brief generation in DashboardScreen
- Updates based on: overdue tasks, due today, streaks, avoidance, lateness profile, productive time

### Behavioral Patterns (patternAnalysis.js)
- **Lateness profile**: early / on time / last minute / often late (from task completion history)
- **Productive time**: morning / afternoon / evening / night (from when tasks are completed)
- **Avoidance scores**: tasks untouched 3+ days within 7 days of deadline flagged as being avoided
- **Per-class patterns**: completion rate, late rate, grade per class
- All fed into AI prompts for Study Plan and Tally chat

### Streak System
- **Task streak**: consecutive days with at least one task completed. Grace period: if no tasks were due during a gap, streak carries forward. Resets if tasks were due and missed.
- **Plan streak**: consecutive days completing at least one scheduled study session. Rest days (no sessions scheduled) carry forward. Breaks if sessions were scheduled and missed.
- Both stored in AsyncStorage per user UID.

### Notifications
- `scheduleBatchReminders` — schedules 24h and 2h reminders for all pending tasks with due dates
- `checkAndScheduleAvoidanceAlerts` — Scholar only, fires when avoidance score triggers
- `scheduleWeeklySummary` — Sunday 7pm recap
- `scheduleStudyPlanReminders` — Scholar only, per-session reminders
- `scheduleStreakReminder` — fires at user's productive time

### Dashboard — Task System
- Tasks displayed in three tabs: **Today** (due today), **All** (all pending), **Done** (completed)
- Tasks sorted by due date within each tab
- Task buckets: Overdue, Today, Upcoming — with section headers
- Each task card shows: title, class tag (color-coded), due date, AI priority badge (HIGH/MEDIUM/LOW), avoidance chip ("Xd untouched"), recurring badge if applicable
- Tap task → edit sheet. Long press → delete.
- Swipe or tap check → complete with animation + haptic
- Task creation: manual (+ button), via ICS import, via Tally chat (AI creates tasks from conversation)
- AI priority runs in background on task changes — updates badges without user action
- Stats strip pinned above scroll: today count / pending count / done count

### Dashboard — Behavioral Insight Strip
- Shows one contextual insight below Tally's Picks
- Generated client-side, no API call
- Examples: "You have 3 things due Thursday — you usually finish the day before", "You've been avoiding this paper for 4 days", "Nothing due today — you're clear"
- Rotates through: overdue warnings, cluster warnings, avoidance callouts, streak acknowledgments, behavioral pattern observations, productive time reminders

### Tally Chat (ChatScreen)
- GPT-4o-mini with full system context: all tasks, classes, grades, deadlines, behavioral patterns, calendar events, streak, study plan sessions
- **Actions Tally can take** (parsed from `%%ACTION%%` blocks in response):
  - Create task
  - Mark task complete
  - Reschedule task (update due date)
  - Log grade for a class
  - Break assignment into subtasks
- Free: 5 messages/day, stored in AsyncStorage only (lost on reinstall)
- Scholar: unlimited, Firestore-backed history synced across devices
- Empty state shows suggested prompts
- Chat history displayed per-session with timestamps

### Canvas / ICS Import
- Student pastes their LMS calendar feed URL (Canvas, Brightspace, Blackboard, Moodle)
- App fetches the .ics file, parses all VEVENT entries
- Imports: task title, due date, class name (from SUMMARY field)
- Deduplicates against existing tasks
- URL saved to Firestore for one-tap re-sync
- Re-sync banner appears on Dashboard after semester switch
- .ics file upload supported as fallback (for downloaded calendar files)
- ICS import also available during onboarding

### Stats Screen
- **Semester progress bar** — % through current term based on start/end dates
- **Summary stats** — completion rate, current streak, overdue count, remaining tasks
- **GPA calculator** — letter grade per class × credit hours → weighted GPA. Shows term GPA + cumulative GPA (if prior record entered)
- **Per-class health cards** — one per class: health label (On Track / Okay / Behind / At Risk), completion %, overdue count, current grade
- **Activity chart** — bar chart of task completions per day, last 14 days
- **Behavioral patterns** — lateness profile (early / on time / last minute / often late), productive time of day
- **Semester filter** — view stats for any past semester independently

### Focus Mode
- Pomodoro timer: 25 min work / 5 min break (default)
- Tied to a specific task selected before starting
- Visual countdown with progress ring
- Haptic feedback on session complete
- Break prompt between sessions
- Session history tracked (used in behavioral pattern analysis)

### Profile & Settings
- **Personal**: name, school, semester (Fall/Spring/Summer + year), school system (semester/quarter)
- **Classes**: list with name, credit hours, current letter grade, designated "hardest class"
- **Class schedule**: per-class days (M/Tu/W/Th/F/Sa/Su) + start/end times — used by Study Plan to avoid scheduling during class
- **Work time preference**: morning / afternoon / evening / night — informs Tally's coaching
- **Learning style**: on top / procrastinator / needs structure — fed to AI
- **Calendar sync**: one-tap ICS re-sync row
- **Themes**: light / dark mode toggle + 5 color accent themes (default purple)
- **Semester switching**: clears tasks+classes / tasks only / just switch

### Semester System
- Students set term (e.g. Fall 2026) with start and end dates
- App tracks % through semester for stats
- On semester switch: prompt to clear old data or carry forward
- ICS re-sync banner appears after switch
- Quarter and semester both supported

### Onboarding (4 steps)
1. **Term** — select semester + school system
2. **Import** — ICS import (optional, can skip)
3. **Classes** — add classes with name, credits, current grade
4. **Work time** — morning / afternoon / evening / night preference
- Notification permission requested with explanation screen before the system prompt
- Walkthrough overlay fires on first Dashboard open, highlights key UI elements
- Paywall shown after onboarding completes

### Theme System
- Light and dark mode (follows system or manual toggle)
- 5 color accent themes — all free currently (Scholar-exclusive themes planned P1)
- Colors defined in `src/utils/theme.js` via `makeColors(accent, isDark)`
- Used throughout via `useTheme()` hook
- Card style: no borders in light mode (shadows only), borders in dark mode

### Mascot
- Two PNG assets: `mascot.png` (eyes open) and `mascot-closed.png` (eyes closed, blink)
- Located at `src/assets/mascot-rn/assets/`
- Component at `src/components/Mascot.js`
- Variants: alive (float+breathe+sway), writing, bounce, jump, wiggle, wave, tap (interactive)
- Blinks every ~5 seconds on all variants
- Used in: Tally's Picks header, ChatScreen header, loading screens

---

## App Navigation
- Tab 1: **Home** (DashboardScreen) — task list, Tally's Picks, Tally's Brief
- Tab 2: **Progress** (StatsScreen) — completion stats, class health, activity chart
- Tab 3: **Coach** (ChatScreen) — Tally AI chat
- Tab 4: **Profile** (ProfileScreen) — settings, classes, themes
- Modal: **Study Plan** (StudyPlanScreen) — pushed from Home tab header or nav
- Modal: **Calendar** (CalendarScreen) — pushed from Dashboard header calendar button
- Modal: **Paywall** (PaywallScreen) — triggered at conversion moments

---

## App Store Rejection (May 2026)
Three issues from Apple:

1. **2.1(b) App Completeness** — IAP products not submitted. Must create all three products in App Store Connect and submit with binary.

2. **3.1.2(c) Pricing Display** — billed amount not most prominent. Fixed in code: plan cards now show `$29.99/yr` as large number, `$2.50/mo` as small subordinate text.

3. **3.1.2(c) EULA** — no Terms of Use link. Must add to App Description: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`

---

## Known Issues / Pending
- RevenueCat sandbox key must be swapped to production before App Store build
- `useSubscription.js`: sync effect that writes `isPro: false` to Firestore is guarded with `__DEV__` — only runs in production builds to prevent sandbox key nuking real Scholar status
- Surgical AI rebuild — built (`adjustTaskSessions` in openai.js, "Ask Tally to reschedule" in missed sessions section)
- Monday summary notification — built (`scheduleMondaySummary` in notifications.js, called on plan generation)
- Session momentum screen — built (slide-up overlay on session complete, auto-dismisses 2.8s)
- Completion ring — built (SVG ring at top of Study Plan, live updates)
- Tally plan comment — built (client-side message after generation, no API call)
- Paywall timing — built (after import success in SyllabusParserScreen, after chat limit in ChatScreen)
- Streak paywall trigger — built (7-day streak, once per user)
- Post-trial discount — built (24h window via RC CustomerInfo expiry, banner in PaywallScreen)
- In-app review — built (5 completions in useTasks.js + 14-day streak in DashboardScreen)
- iPad layout not designed for — Apple reviewed on iPad Air M3 during rejection

---

## What's NOT in the App Yet
- "Where Should I Start?" one-tap recommendation (planned P1)
- Syllabus scanner / PDF import (planned P1)
- Progress prediction ("at current pace you'll miss X")
- Weekly reflection loop
- Custom Focus Mode intervals (planned P1)
- Pre-exam cram notification (planned P1)
- Auto plan rebuild when sessions missed (surgical rebuild — planned pre-launch)
- Widget
- Android build
- Canvas OAuth / Chrome extension
