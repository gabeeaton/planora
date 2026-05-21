# Planora — AI Student Planner

**What it is:** An AI-powered academic performance system for college students. Not a to-do list — a system that tells students *when* to study, ranks what matters most, and tracks whether their effort is translating into grades.

**Who built it:** Gabe Eaton, 22-year-old college student, solo founder. No business background. Building and learning at the same time.

**Primary goal:** $10k MRR. Financial freedom. iOS App Store launch targeting August/September 2026 (orientation week). Android launch shortly after.

**Current status:** Pre-revenue, pre-launch. Not yet on App Store or Google Play. Active development with dev flags enabled for testing. `BETA_PRO_UNLOCKED: false`. No analytics installed yet — PostHog needed before launch.

---

## What the App Does (The Full Picture)

Students open Planora when they're overwhelmed and don't know where to start. The app solves that specific problem — not just "here's your list" but "here's what to do today and when to do it."

### The core loop
1. Student imports their entire semester from Canvas/ICS in one tap (or adds tasks manually)
2. AI reads all tasks and grades → ranks priority considering deadline, grade weight, task type, and past behavior
3. AI generates a day-by-day study schedule (Study Plan) — "Monday: 2hrs CHEM, Tuesday: 1hr HIST essay outline"
4. Smart notifications fire at exactly the right time — 24h before due, 2h warning for high-priority, nudge when avoiding a task
5. Student completes tasks → grades improve → they can see the correlation over time

### Every feature in detail

**Dashboard**
- Task list with AI priority badges (HIGH/MEDIUM/LOW) — ranks change as deadlines approach
- "Focus today" card — AI picks the 2–3 tasks to tackle right now, explains why
- Behavioral insight strip — notices patterns: "You have 3 things due Thursday and you usually finish the day before"
- Week calendar view — visual layout of all deadlines
- Streak tracker — consecutive days of completing tasks
- Stats bar — today's tasks, pending count, completed count

**Study Plan (flagship Scholar feature)**
- Student sets available study hours for each day of the week
- AI generates a day-by-day schedule distributing work based on deadlines, estimated time, and free time
- Sessions are specific: "CHEM 101 — Midterm prep — 90 min — Wednesday afternoon"
- Notifications fire for each scheduled session
- Plan cached so it doesn't regenerate on every open
- No direct competitor does this

**Focus Mode**
- Pomodoro timer (25/5 min default, customizable)
- Tied to a specific task — marks progress on completion
- Session history tracked
- Completion triggers haptic + animation

**AI Coach (chat)**
- GPT-4o-mini with full context: student's tasks, classes, grades, deadlines, behavioral patterns
- Can take actions: create tasks, reschedule tasks, log grades, break assignments into subtasks, mark complete
- Free users: 3 messages/day. Scholar: unlimited
- Prompt suggestions on empty state: "Break down my term paper", "What's due this week?", "I'm overwhelmed — what do I do?"

**"Where Should I Start?"**
- One-tap AI recommendation for what to work on right now
- Scholar-only
- Button on the dashboard

**Avoidance Alerts (Scholar only)**
- App detects when a task has been ignored relative to its urgency
- Fires a push notification: "You've been putting off [task] for 3 days — it's due Friday"
- Based on avoidance scores computed from task age vs. deadline proximity

**Grade Tracking**
- Student logs grades per assignment per class via task edit (no auto-prompt on completion)
- GPA calculated — term GPA + cumulative GPA
- Completion patterns per class tracked
- Grade context fed to AI so coach knows if student is struggling in a specific subject
- Recently completed tasks (last 14 days, with or without grades) included in AI chat context
- *(GPA card on Stats screen is currently commented out — code is written and ready, needs to be re-enabled before launch)*

**Notifications (smarter than every competitor)**
- 24h reminder before every task due date
- 2h warning for HIGH priority tasks (exact time, not approximate)
- Overdue nudge if task passes due date uncompleted
- Avoidance alert (Scholar only)
- Weekly digest every Sunday: summary of the week ahead
- Study Plan session reminders

**Stats Screen**
- Semester progress bar (% through current semester)
- Completion rate, streak, overdue count, remaining tasks
- Per-class breakdown: health rating (On track / Okay / Behind / At risk), completion %, overdue
- Daily activity chart (completions per day, last 2 weeks)
- Behavioral patterns surfaced (lateness profile, best productive time)

**Canvas / ICS Import**
- Supports Canvas, Brightspace, Blackboard, Moodle
- Student pastes calendar feed URL — app fetches and parses the ICS file
- All assignments imported with due dates and class names
- URL saved for one-tap re-sync when Canvas updates
- Works for any .ics calendar file

**Onboarding**
- Collects: name, school, semester, classes (name + credit hours + grade weight + current grade)
- ICS import available during onboarding
- Notification permissions with "explain before you ask" approach (improves grant rate)
- Walkthrough overlay on first dashboard open — highlights key features

---

## Subscription Model

| Plan | Price | What you get |
|---|---|---|
| Free | $0 | Tasks, AI priority (5/day), notifications, import, basic stats |
| Scholar Monthly | $4.99/mo | Everything: Study Plan, unlimited AI, avoidance alerts, grade analytics |
| Scholar 6-Month | $17.99 | Same (~$3/mo effective) — aligns with a semester |
| Scholar Annual | $29.99/yr | Same (~$2.50/mo effective) |

7-day free trial on all paid plans. Managed via RevenueCat. Entitlement ID: "Planora Pro".

Default plan selected on paywall: Annual (best value, reduces churn).

### Why students pay
The moment the app says something true about their behavior they didn't tell it — "You tend to finish assignments the day before they're due" or "You've been avoiding this paper for 4 days" — it stops feeling like a tool and starts feeling like a coach. That's the conversion moment.

### What's free vs. paid
Free tier has no hard task cap (Canvas import can bring 40+ tasks immediately — a cap would break the experience). The gate is on AI capabilities: Study Plan generation, "Where Should I Start?", unlimited chat, avoidance push alerts. Free users feel the app is useful. Scholar users feel it's indispensable.

---

## The Business

### Stage
Pre-revenue. Zero paying users. `BETA_PRO_UNLOCKED: false`. No analytics SDK installed. App Store launch is the immediate next milestone.

### Primary goal
$10k MRR. Path: ~2,000 paying users at $4.99/mo or ~1,000 annual subscribers. Requires 20,000–40,000 active users at 5–10% conversion. This is a 12–18 month target from launch.

### Realistic Year 1 forecast (organic only, no viral event)
- Sep launch: ~$75/mo MRR
- Oct midterms: ~$175/mo
- Nov/Dec finals: ~$325–400/mo
- Jan new semester: ~$500/mo
- End of Year 1: ~$700–900/mo MRR

One viral TikTok from a creator with 100k+ followers can compress this timeline by 6–9 months. That's the upside scenario. Plan survives without it.

### What's actually strong
- Design is premium — better than every competitor in the category
- Canvas/ICS import removes the biggest onboarding friction point
- AI priority ranking updates over time as deadlines approach — actually useful, not gimmicky
- Notification system is smarter than competitors (2h warning, avoidance detection)
- Study Plan has no direct competitor — completely differentiated feature
- Behavioral pattern tracking (lateness profile, avoidance scores, productive time) gets more accurate the longer the user stays

### What's not working yet
- Free tier is too complete — students get significant value without paying
- No analytics — zero visibility into where users drop off or what's working
- No viral loop — completion share card exists but share sheet only triggers at streak 3+ (removed streak-1 trigger intentionally)
- Paywall only fires reactively when hitting a gate, not at peak desire moments
- Stats screen shows counts but doesn't tell a narrative story
- GPA card is built but commented out — major value prop feature that's invisible to users

---

## Go-To-Market: Fall 2025

### Target launch date
August 20 – September 1, 2026 — orientation week at US universities. Highest new-user intent of the year for student apps.

### Marketing channels (priority order)

**1. TikTok/Instagram Reels (highest ceiling)**
Find 10–20 student creators, 5k–80k followers, in "study with me" / "college productivity" niche. DM them directly: "I'm a college student who built an AI study planner — happy to give you free premium. If you like it and want to make a video, great, no pressure." Authentic beats paid. Budget: $0. Best video concept: "This AI built my entire study schedule" — Study Plan demo. One authentic video from a real student outperforms any paid post.

**2. Campus partner program**
Recruit 3–5 students across different schools as campus reps. They tell their study group during orientation week and post 1–2x/month. Give them: free Scholar, unique referral link, caption templates, $25–50 bonus at 20 signups. Orientation week is the deployment window.

**3. Reddit**
Contribute genuinely to r/college (3.5M members), r/GetStudying (500k), r/productivity (1M). Answer "what app do you use?" threads authentically. Never promotional. One upvoted comment can drive 300–800 App Store page visits.

**4. App Store optimization (free)**
- Title: "Planora – AI Student Planner"
- Subtitle: "Manage Classes, Track Grades"
- Keywords: `student,planner,homework,canvas,assignment,tracker,gpa,college,study,ai,grade,scheduler`
- Screenshots: lead with outcome ("Never miss a deadline again"), not feature list

### Team
- **Founder**: Gabe Eaton (engineering, product)
- **Summer 2026**: 1 content creator intern (current college student, already makes study content on TikTok/Instagram — this is the highest-leverage non-engineering hire before launch)
- **Campus growth partners**: 3–5 student reps at different schools (not employees — free Scholar + referral link + small stipend)
- **Graphic design**: one-time freelance contract for App Store screenshot frames and social templates (Fiverr/Upwork); not a recurring hire at this stage

### Content pillars for social
1. Study smarter tips (no Planora mention — builds audience trust)
2. Product walkthroughs (honest screen recordings, not ads)
3. Student wins and results (hardest to get, most powerful)

### Semester calendar
| Window | Action |
|---|---|
| Aug 15 – Sep 1, 2026 | Launch: campus reps active, TikTok push, App Store update live |
| Oct 15 – Nov 1 | Midterms: in-app upsell push, "Finals are coming" messaging |
| Nov 15 – Dec 5 | Finals: highest conversion window. Stress = motivation to pay |
| Jan 1 – Jan 15 | New semester spike. "New semester, new GPA" campaign |
| Jun–Aug | Worst time to market. Use summer to build, not acquire |

---

## Competitive Landscape

| App | Their gap | Planora advantage |
|---|---|---|
| Notion | Too complex, not deadline-focused | Student-specific, AI reminders, Study Plan |
| Todoist | No academic context, no grades | Grade tracking, AI priority, Canvas import |
| MyStudyLife | Schedule-focused, bad UI, no AI | Better design, Study Plan, AI coach |
| Structured | Beautiful but no AI, no LMS | AI study schedule, Canvas import |
| Canvas (built-in) | Students hate using Canvas for planning | Layer on top, not competing |

**Positioning:** "The Canvas companion" — students use Canvas because they have to. They use Planora because they want to. Additive, not competitive with institutional software.

**Building toward a moat:**
- Behavioral data per student (lateness profile, avoidance, productive time) gets more accurate with use
- Grade + task completion correlation — no competitor tracks both
- Study Plan generation — unique, no direct competitor

---

## The User

**Primary:** US college student, 18–22, iPhone user, taking 4–5 classes, using Canvas or similar LMS, feeling overwhelmed by deadlines.

**Not the user:** Working professionals, K-12 students, people without structured academic deadlines.

**Their situation when they download:** "I keep missing things and I don't know how to fix it." They've tried Apple Reminders, Google Calendar, Notion. All failed because none of them understand academic workload — everything is equal priority, nothing tells you when to work on it.

**What makes them stay:** The behavioral insights. When the app notices their patterns and names them out loud, it feels like a coach, not a tool.

**What makes them pay:** Hitting a deadline and realizing the app helped them not miss it. Study Plan generating a schedule they actually follow. The AI coach knowing their exact situation.

---

## Metrics to Track (None Currently Installed)

| Metric | Target |
|---|---|
| Onboarding completion | > 65% |
| Day 1 retention | > 60% |
| Day 7 retention | > 35% |
| Day 30 retention | > 20% |
| Free → Scholar conversion | > 5% of active users |
| Monthly churn | < 8% |
| Average tasks per user | > 8 |

Analytics (PostHog or Mixpanel) must be installed before launch. Currently zero visibility.

---

## Product Roadmap

### P0 — Before launch
1. Install analytics (PostHog free tier)
2. Flip `DEMO_MODE` and `FORCE_ONBOARDING` to `false` before App Store submission
3. Re-enable GPA card in StatsScreen (commented out at line ~1349, code is complete)
4. Update App Store metadata (title, keywords, screenshots)
5. Add student testimonial quote to paywall
6. Completion share card already built — verify it works end-to-end

### P1 — First 2 months post-launch
7. Show productive time of day explicitly on dashboard (already computed, never displayed to user)
8. Give free users one avoidance insight per day in-app (currently 100% Scholar-gated)
9. Milestone celebration moments — "50 tasks completed", "30-day streak"
10. Weekly performance card in-app (currently push-notification only)
11. Grade impact math — "Skipping this lab (15% of grade) could drop your grade from B+ to B"
12. Make chat actions more discoverable — students don't know it can create tasks, reschedule, log grades

### P2 — Later
13. Android launch (technical work ~4 days; Google Play review takes 2–3 weeks)
14. Referral program — "give a friend 1 month, get 1 month free"
15. Canvas OAuth two-way sync
16. Parent plan ($9.99/mo) — parents pay for academic tools; no competitor has this
17. AI study guides — "Based on your CHEM tasks, here are 5 key review topics"

---

## Tech Stack

- **React Native + Expo** (managed workflow, SDK 54)
- **Firebase** — Firestore (tasks, profiles, grades), Auth (email/password)
- **RevenueCat** — subscriptions (react-native-purchases ^9.15.2). iOS key configured. Android key needed for Android launch.
- **OpenAI GPT-4o-mini** — AI priority ranking, Study Plan generation, chat (proxied via Vercel)
- **Vercel** — serverless API proxy (keeps OpenAI key server-side)
- **expo-notifications** — push notifications (Android channels already configured)
- **expo-haptics** — haptic feedback (81 call sites across the app)
- **Sentry** — crash reporting
- **Outfit** font family (5 weights via @expo-google-fonts/outfit)
- **date-fns** — date math
- **EAS** — builds and App Store submission (projectId: b06573e3-d986-4a3f-9fc5-704de3962c20)

---

## Running the App

```bash
npm install
cp .env.example .env
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
EXPO_PUBLIC_REVENUECAT_API_KEY=          # iOS
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=  # Android (when Android launches)
```

Feature flags in `src/config.js`:
```js
BETA_PRO_UNLOCKED: false  // flip to true to give everyone Scholar (TestFlight soft launch)
FORCE_ONBOARDING:  false  // run onboarding every launch (dev testing)
FORCE_WALKTHROUGH: false  // run walkthrough every launch (dev testing)
DEMO_MODE:         false  // canned data, skip real API/notification/email calls (App Store screenshots)
```

Add to `.env` to suppress Sentry source map upload errors during local builds:
```
SENTRY_DISABLE_AUTO_UPLOAD=true
```

---

## Pre-Launch Checklist

### Code / Config — must do before any production build
- [ ] `src/config.js`: Flip `FORCE_ONBOARDING` → `false`
- [ ] `src/config.js`: Flip `FORCE_WALKTHROUGH` → `false`
- [ ] `src/config.js`: Verify `DEMO_MODE` → `false` and `BETA_PRO_UNLOCKED` → `false`
- [ ] Re-enable GPA card in StatsScreen (commented out, line ~1349 — code is complete)
- [ ] Swap RevenueCat test key → production key in `.env`
- [ ] Install analytics — PostHog free tier is the fastest path

### App Store Connect (iOS)
- [ ] Create app listing in App Store Connect
- [ ] Create subscription products: `com.planoraapp.monthly` ($4.99), `com.planoraapp.semester` ($17.99), `com.planoraapp.annual` ($29.99)
- [ ] Enable 7-day free trial on all three products
- [ ] App icon: 1024×1024 PNG, no transparency, no rounded corners (Apple applies them)
- [ ] Screenshots: 6.7" iPhone (required), 6.5" fallback, 5.5" fallback — 3–10 per size — lead with outcome not UI
- [ ] App title: "Planora – AI Student Planner"
- [ ] Subtitle (30 chars): "Manage Classes, Track Grades"
- [ ] Keywords (100 chars): `student,planner,homework,canvas,assignment,tracker,gpa,college,study,ai,grade,scheduler`
- [ ] Privacy policy URL (required — host a simple page, must be live)
- [ ] App privacy labels (data types collected: email, usage data, identifiers)
- [ ] Add student testimonial to paywall screen before screenshots
- [ ] TestFlight beta first → 10–20 real students → fix issues → public release
- [ ] Build + submit: `eas build --platform ios` then `eas submit --platform ios`
- [ ] Optional but high-value: set up Apple Pre-Order (up to 180 days before release — builds wishlist before launch day)

### Google Play (Android)
- [ ] Google Play Console account ($25 one-time fee)
- [ ] Add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to `.env`
- [ ] Add `google-services.json` to project root (from Firebase Console → Project Settings → Android)
- [ ] Configure FCM for push notifications (Firebase → Cloud Messaging)
- [ ] Create Play billing subscription products (matching iOS SKUs)
- [ ] Notification icon: white silhouette PNG on transparent background (already in android/app/src/main/res)
- [ ] Store listing: description (4000 chars), screenshots (2–8 per form factor), 1024×500 feature graphic
- [ ] Data safety form (equivalent to Apple privacy labels — required)
- [ ] Content rating questionnaire
- [ ] Build + submit: `eas build --platform android` then `eas submit --platform android`
- [ ] Note: Play review takes 7–14 days for first submission; plan accordingly

### Marketing (before launch day)
- [ ] Recruit 3–5 campus reps for orientation week (free Scholar + referral link + $25–50 at 20 signups)
- [ ] DM 15 student TikTok/Instagram creators (5k–80k followers) — offer free Scholar, no pressure to post
- [ ] App Store screenshots + preview video using `DEMO_MODE: true`
- [ ] Verify completion share card works end-to-end (triggers at streak 3+)

### Infrastructure
- [ ] Add `SENTRY_DISABLE_AUTO_UPLOAD=true` to `.env` (or configure Sentry org/project in `app.json`)
