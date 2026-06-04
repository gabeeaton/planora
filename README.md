# Planora — AI Student Planner

**What it is:** An AI-powered academic execution system for college students. Not a to-do list — a system that tells students when to study, ranks what matters most, and helps them stay ahead of deadlines before the stress hits.

**Who built it:** Gabe Eaton, college student, solo founder.

**Primary goal:** $10k MRR. iOS App Store launch targeting August/September 2026 (orientation week). Android shortly after.

**Current status:** App Store submission rejected (May 2026). Addressing three issues: IAP products not submitted, paywall pricing hierarchy, EULA link missing. Resubmission in progress. `BETA_PRO_UNLOCKED: false`. RevenueCat production key needed before resubmission.

---

## What the App Does

Students open Planora when they're overwhelmed and don't know where to start. The app solves that specific problem — not just "here's your list" but "here's what to do right now and when to do the rest."

### The core loop
1. Student imports their entire semester from Canvas/ICS in one tap (or adds tasks manually)
2. AI reads all tasks, grades, and behavioral patterns → ranks priority by deadline, grade weight, class performance, and past behavior
3. AI generates a day-by-day study schedule (Study Plan) — "Monday: 2hrs CHEM, Tuesday: 1hr HIST essay outline"
4. Smart notifications fire at exactly the right time — 24h and 2h before due, avoidance nudge when a task is being ignored
5. Student completes tasks → patterns improve → Tally's coaching gets more accurate over time

### Why students pay
The moment the app says something true about their behavior they didn't tell it — "You tend to finish assignments the day before they're due" or "You've been avoiding this paper for 4 days" — it stops feeling like a tool and starts feeling like a coach. That's the conversion moment.

---

## Every Feature in Detail

### Dashboard
- Task list with AI priority badges (HIGH / MEDIUM / LOW) — updated dynamically as deadlines approach
- Tally's Brief — AI-generated daily coaching message based on tasks, deadlines, and behavioral patterns
- Tally's Picks — AI picks 2–3 tasks to focus on right now, sorted by urgency × importance score
- Behavioral insight strip — surfaces patterns: "You have 3 things due Thursday and you usually finish the day before"
- Avoidance indicator on task cards — shows "Xd untouched" when a task is being avoided (free)
- ICS re-sync banner — appears after a semester switch, prompts user to re-sync their calendar feed
- Streak tracker — consecutive days with at least one task completed
- Stats strip — today / pending / done counts always visible above scroll content
- Sync button in header — quick access to calendar import from anywhere

### Study Plan (flagship Scholar feature)
- Student sets available study hours per day of the week
- AI distributes work across available time based on deadlines, estimated effort, and class grade stakes
- Sessions are specific: "CHEM 101 — Midterm prep — 90 min — Wednesday"
- Task type pre-classification (EXAM, ESSAY, DISCUSSION, etc.) applied before AI call for more reliable session rules
- Same-class daily cap — max 2 sessions per class per day unless deadline within 2 days
- Rest day logic — AI only schedules rest days when all deadlines are 6+ days away
- Plan streak tracking — consecutive days completing at least one scheduled session
- Export to Calendar — exports all sessions to Google Calendar, Apple Calendar, or Outlook with provider picker
- Notifications fire for each scheduled session
- Plan cached to avoid regenerating on every open
- Missed sessions detected and surfaced at top of plan
- No direct competitor does this

### AI Coach (Tally)
- GPT-4o-mini with full context: tasks, classes, grades, deadlines, behavioral patterns from history
- Can take actions: create tasks, reschedule, log grades, break assignments into subtasks, mark complete
- Free users: 5 messages/day. Scholar: unlimited, Firestore-backed history synced across devices
- Prompt suggestions on empty state

### Avoidance Alerts (Scholar only)
- Push notification when a task has been ignored relative to its urgency
- "You've been putting off [task] for 3 days — it's due Friday"
- Avoidance score = days since last touched × urgency multiplier based on days until due
- Avoidance chip on task cards is free — push notification is Scholar only

### Grade Tracking
- Grades logged per class (letter grade + credit hours) via Profile
- Completion patterns tracked per class — fed to Tally as context
- Classes with struggling grades flagged in AI priority logic ("⚠️ PRIORITIZE — struggling grade")
- Grade context included in all AI chat prompts and Study Plan generation

### Notifications (smarter than every competitor)
- 24h reminder before every task due date (free)
- 2h warning before tasks with a specific due time (free — meaningful differentiator)
- Overdue nudge if task passes due date uncompleted (free)
- Avoidance alert push notification (Scholar only)
- Weekly digest every Sunday: what's coming up this week (free)
- Study Plan session reminders (Scholar)
- Streak reminder — fires at the student's peak productive time based on history

### Stats Screen
- Semester progress bar (% through current term)
- Completion rate, streak, overdue count, remaining tasks
- Per-class breakdown: health rating (On track / Okay / Behind / At risk), completion %, overdue count
- Daily activity chart (completions per day, last 2 weeks)
- Behavioral patterns surfaced (lateness profile, productive time of day)
- Semester filter — view any semester's data independently

### Canvas / ICS Import
- Supports Canvas, Brightspace, Blackboard, Moodle
- Student pastes calendar feed URL — app fetches and parses the ICS file
- All assignments imported with due dates and class names
- URL saved for one-tap re-sync when Canvas updates mid-semester
- .ics file upload as fallback for any calendar export
- Re-sync banner on Dashboard prompts users after a semester switch

### Focus Mode
- Pomodoro timer (25/5 min default)
- Tied to a specific task
- Completion triggers haptic feedback and animation

### Profile
- Name, school, semester, school system (semester/quarter)
- Classes list with credit hours and current grade per class
- Class schedule with days and times
- Hardest class designation (flagged to Tally for extra coaching focus)
- Work time preference (morning/afternoon/evening/night)
- Learning style self-report (on top / procrastinator / needs structure)
- Calendar sync row — quick access to re-sync ICS feed
- Theme + dark/light mode preferences
- Semester switching with options: clear tasks + classes / clear tasks only / just switch
- Progress stats link

### Onboarding
- Collects: name, school, semester, classes (name + credit hours + current grade)
- ICS import available inline during onboarding
- Notification permissions with "explain before you ask" approach
- Walkthrough overlay on first dashboard open highlights key features
- Paywall offered after onboarding completes for non-subscriber users

---

## Subscription Model

| Plan | Price | Billed |
|---|---|---|
| Free | $0 | — |
| Scholar Monthly | $4.99/mo | Monthly |
| Scholar Annual | $29.99/yr · **Best Value** | $2.50/mo equivalent |
| Scholar Lifetime | $199.99 | One-time, forever |

Paywall order: Annual → Lifetime → Monthly. Annual is default selected.

7-day free trial on Monthly and Annual. No trial on Lifetime (App Store rules prohibit trials on non-consumables).

Managed via RevenueCat. Entitlement ID: `Planora Pro`.

The Lifetime tier exists as a pricing anchor — $199.99 makes $29.99/year feel like an obvious deal — and captures long-term users (a sophomore using through graduation gets more value than the subscription total).

### Free vs. Scholar

**Free (permanently useful):**
- Canvas/ICS import
- Unlimited task creation
- AI priority ranking (5 AI chat messages/day)
- 24h and 2h deadline reminders
- Avoidance indicator on task cards
- Basic stats (completion rate, streak, overdue count, per-class health)
- Focus Mode (25/5 Pomodoro)
- Calendar view
- Semester progress tracking
- Weekly digest notification

**Scholar — the adaptive layer:**
- Study Plan generation (no direct competitor)
- Plan streak tracking
- Export sessions to calendar (Google, Apple, Outlook)
- Unlimited AI Coach + persistent cross-device chat history
- Avoidance alert push notifications
- Study Plan session reminders
- Syllabus scanner — PDF/photo → tasks (P1)
- Proactive Tally check-ins (P1)
- Custom Focus Mode intervals (P1)
- Pre-exam cram notifications (P1)
- Color accent themes (P1)

**Add-ons (post $1k MRR):**
- SMS reminders — $0.99/month via Twilio
- Parent visibility dashboard — $4.99/month separate purchase
- Extra AI message pack — 50 messages for $0.99 one-time consumable

---

## The Business

### Stage
Pre-revenue. Zero paying users. App Store submission rejected, resubmission in progress. PostHog and Sentry active.

### Primary goal
$10k MRR. Path: ~2,000 paying users at $4.99/mo or ~1,000 annual subscribers at $29.99/yr. Requires 20,000–40,000 active users at 5–10% conversion. 12–18 month target from launch.

### Conversion strategy
Freemium acquisition → 7-day trial experience → milestone paywall.

Paywall fires at peak value moments:
- Immediately after Canvas import success
- When a free user hits their 5-message daily chat limit
- At 7-day streak ("You're on a roll — Scholar keeps the momentum going")
- After trial ends, a one-time 20% discount offer expires in 24 hours

### Why this converts
AI-powered apps convert free users to paid 52% more effectively than non-AI apps. Planora is AI-first which is a structural conversion advantage. The behavioral tracking (avoidance scores, productive time, lateness profile) gets more accurate the longer a student uses the app — leaving means losing that learned data.

### Realistic Year 1 forecast (organic only)
- Sep launch: ~$75/mo MRR
- Oct midterms: ~$175/mo
- Nov/Dec finals: ~$325–400/mo
- Jan new semester: ~$500/mo
- End of Year 1: ~$700–900/mo MRR

One viral TikTok from a creator with 100k+ followers compresses this timeline by 6–9 months.

### What's strong
- Canvas import removes the biggest onboarding friction point
- 2h warnings are free — a real differentiator no competitor offers in the free tier
- Study Plan has no direct competitor
- Behavioral data improves with use — actual retention mechanic
- Design is premium for the category

### What's not solved yet
- Study Plan is manually triggered — not yet a living document. Students have to remember to open and regenerate. Auto-rebuild when sessions are missed is the most important missing piece.
- Tally's coaching is only as good as its context. Without assignment-level grade weights (coming via Syllabus Scanner), Tally is smart-sounding deadline sorting.
- No viral loop beyond completion share cards
- Paywall timing not yet optimized to fire at peak value moments

---

## Go-To-Market: Fall 2026

### Target launch date
August 20 – September 1, 2026 — orientation week at US universities.

### Marketing channels (priority order)

**1. TikTok / Instagram Reels (highest ceiling)**
Find 10–20 student creators, 5k–80k followers, in the "study with me" / "college productivity" niche. DM: "I'm a college student who built an AI study planner — happy to give you free Scholar. If you like it and want to make a video, no pressure." Budget: $0.
Best content: "This AI built my entire study schedule" — Study Plan walkthrough.

**2. Campus partner program**
Recruit 3–5 students across different schools as campus reps during orientation week. Free Scholar + unique referral link + $25–50 bonus at 20 signups.

**3. Reddit**
Contribute genuinely to r/college (3.5M), r/GetStudying (500k), r/productivity (1M). Answer "what app do you use?" threads.

**4. App Store optimization**
- Title: "Planora – AI Student Planner"
- Subtitle: "Manage Classes, Track Grades"
- Keywords: `student,planner,homework,canvas,assignment,tracker,college,study,ai,grade,scheduler`
- Screenshots: lead with outcome, not feature list

### Team
- **Founder**: Gabe Eaton (engineering, product, marketing)
- **Summer 2026**: 1 content creator intern (college student, study content on TikTok/Instagram)
- **Campus reps**: 3–5 students at different schools (free Scholar + referral link + small stipend)

### Semester calendar
| Window | Action |
|---|---|
| Aug 15 – Sep 1, 2026 | Launch: campus reps active, TikTok push, App Store live |
| Oct 15 – Nov 1 | Midterms: in-app upsell push |
| Nov 15 – Dec 5 | Finals: highest conversion window |
| Jan 1 – Jan 15 | New semester spike |
| Jun – Aug | Build, don't market |

---

## Competitive Landscape

| App | Their gap | Planora's edge |
|---|---|---|
| Notion | Too complex, not deadline-focused | Student-specific, AI reminders, Study Plan |
| Todoist | No academic context, no grades | Grade tracking, AI priority, Canvas import |
| MyStudyLife | Schedule-only, bad UI, no AI | Better design, Study Plan, behavioral coaching |
| Structured | Beautiful but no AI, no LMS | AI study schedule, Canvas import, Tally chat |
| Motion | No student/academic awareness | Grade-aware prioritization, Canvas import, free tier |
| Canvas (built-in) | Students hate planning inside Canvas | Layers on top, makes Canvas data useful |

**Positioning:** "The Canvas companion" — students use Canvas because they have to. They use Planora because they want to.

**Building toward a moat:**
- Behavioral data per student improves with use — leaving means losing it
- Grade + task completion correlation — no competitor tracks both
- Study Plan generation — unique, no direct competitor
- Long-term: Canvas OAuth integration gives Tally assignment-level grade weights and submission status

---

## The User

**Primary:** US college student, 18–22, iPhone user, taking 4–5 classes, using Canvas or similar LMS, feeling overwhelmed by deadlines.

**Not the user:** Working professionals, K-12 students, people without structured academic deadlines.

**Their situation at download:** "I keep missing things and I don't know how to fix it." They've tried Apple Reminders, Google Calendar, Notion. All failed because none of them understand academic workload.

**What makes them stay:** When the app names a pattern they recognize ("You've been avoiding this paper for 4 days — it's due Friday"), it stops being a planner and starts being a coach.

**What makes them pay:** Hitting the 5-message chat limit. Discovering Study Plan is locked. Seeing the 2h warning work and wanting more.

---

## Analytics and Monitoring

**PostHog** — event tracking, active. Key events:
- `onboarding_completed` (class count, whether ICS imported)
- `import_completed` (task count)
- `paywall_viewed`
- `subscription_started` (plan type)
- `task_completed` (AI priority level)

**Sentry** — crash reporting and performance. Configured with environment tag, user context on login, 20% transaction sampling.

### Key metrics to watch

| Metric | Target |
|---|---|
| Onboarding completion | > 65% |
| Day 1 retention | > 60% |
| Day 7 retention | > 35% |
| Day 30 retention | > 20% |
| Free → Scholar conversion | > 5% of active users |
| Monthly churn | < 8% |
| Avg tasks per user | > 8 |

---

## Product Roadmap

### Before resubmission (blocking App Store approval)
- [ ] Create IAP products in App Store Connect: `com.planoraapp.monthly`, `com.planoraapp.annual`, `com.planoraapp.lifetime`
- [ ] Add EULA link to App Description (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`)
- [ ] Verify `https://planoraapp.net/privacy` and `https://planoraapp.net/terms` are live
- [ ] Swap RevenueCat sandbox key → production key in EAS secrets
- [ ] Build and submit new binary via `eas build --platform ios` + `eas submit`
- [ ] Reply to Apple review message confirming all three issues addressed

### Before launch (highest ROI)
1. **Surgical AI rebuild** — when sessions are missed, rebuild only the affected task's sessions instead of full plan regeneration. ~70% cheaper per adjustment, makes plan feel alive.
2. **Paywall timing** — fire after Canvas import success and after first chat limit hit. Not at app open.
3. **Streak-based paywall trigger** — at 7-day streak: "You're on a roll. Scholar keeps the momentum going."
4. **Post-trial dismissal discount** — 20% off Annual for 24 hours after trial ends.
5. **In-app review prompt** — after completing all tasks for the day, or at 14-day streak. Never randomly.
6. **Monday summary notification** — Monday 8am push with the week's sessions and first deadline. Drives habitual weekly open.
7. **Session momentum screen** — brief celebration overlay when completing a study session. Shows progress and plan streak.
8. **Completion ring** — circular progress ring in Study Plan showing sessions done vs total.
9. **Verify all feature flags** are `false` in `src/config.js` before production build.

### P1 — First 2 months post-launch
10. **Syllabus scanner** — camera or PDF upload, GPT-4o Vision extracts assignments, due dates, grade weights. Scholar only. ~3 days.
11. **Proactive Tally check-ins** — if next 7 days contain 3+ assignments or any exam, Tally proactively surfaces: "Heavy week coming. Want me to build your study schedule?"
12. **Custom Focus Mode intervals** — free users get 25/5 only. Scholar sets any interval.
13. **Pre-exam cram notification** — night before any exam: "Your CHEM 201 midterm is tomorrow. You've completed 4 of 6 prep sessions."
14. **Scholar color accent themes** — Scholar-exclusive accent colors beyond the default.
15. **Referral program** — "Give a friend 1 week free, get 1 week free." After first 500 users.
16. **Progress prediction** — "At your current pace, CHEM sessions will be 2 days late." Surfaces in Study Plan.

### P2 — 3–6 months post-launch
17. **Canvas OAuth via Chrome extension** — pulls assignment-level grade weights, submission status, and rubric details. The data Tally needs to say genuinely non-obvious things.
18. **Google Calendar two-way sync** — tasks with due dates appear in Google Calendar, events pull into Planora schedule. Scholar only.
19. **Android launch** — ~4 days technical work, 7–14 days Play review.
20. **AI flashcard generation** — upload notes or PDF, Tally generates flashcards. Scholar only.
21. **Semester comparison stats** — "Your completion rate is 23% higher than last semester." Needs one full semester of history.

---

## Tech Stack

- **React Native + Expo** (bare workflow, SDK 54)
- **Firebase** — Firestore (tasks, profiles, chat history), Auth (email/password)
- **RevenueCat** — subscriptions (`react-native-purchases ^9.15.2`). iOS key configured, Android key needed for Android launch.
- **OpenAI GPT-4o** — Study Plan generation (proxied via Vercel)
- **OpenAI GPT-4o-mini** — AI priority ranking, Tally chat, Tally Brief (proxied via Vercel)
- **Vercel** — serverless API proxy, keeps OpenAI key server-side
- **expo-notifications** — push notifications
- **expo-calendar** — read calendar events, write study sessions to device calendar
- **expo-haptics** — haptic feedback throughout
- **PostHog** — product analytics
- **Sentry** — crash reporting (`@sentry/react-native`)
- **Outfit** font family (5 weights via `@expo-google-fonts/outfit`)
- **date-fns** — date arithmetic
- **EAS** — builds and App Store submission (projectId: `b06573e3-d986-4a3f-9fc5-704de3962c20`)

---

## Running the App

```bash
npm install
cp .env.example .env   # fill in values
npx expo start
```

Required `.env` variables:
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_VERCEL_API_URL=
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_POSTHOG_KEY=
```

Feature flags in `src/config.js`:
```js
BETA_PRO_UNLOCKED:     false  // true = everyone gets Scholar
FORCE_ONBOARDING:      false  // run onboarding every launch
FORCE_WALKTHROUGH:     false  // run walkthrough every launch
FORCE_SEMESTER_PROMPT: false  // show new-semester prompt every launch
DEMO_MODE:             false  // canned data for App Store screenshots
DEV_SCHOLAR_OVERRIDE:  false  // Scholar toggle in Profile (dev only)
```

To suppress Sentry source map upload errors during local builds:
```
SENTRY_DISABLE_AUTO_UPLOAD=true
```

For device testing without USB (after initial pairing):
- Run `npx expo start --tunnel` for Metro bundler over hotspot
- `npx expo run:ios --device` requires USB or same WiFi network as device
