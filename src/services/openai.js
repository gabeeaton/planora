// ============================================================
// src/services/openai.js
//
// All AI calls go through the Vercel proxy (api/ai.js).
// The OpenAI API key never touches the client bundle.
// Firebase ID token is sent on every request for auth + rate limiting.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG, VERCEL_API_URL } from "../config";
import { buildPatternContext, isStrugglingGrade } from "./patternAnalysis";
import { auth } from "./firebase";
import { format, addDays } from "date-fns";

// ── Helpers ──────────────────────────────────────────────────

// Mirrors server FREE_DAILY_LIMIT — used in error messages only
const FREE_DAILY_LIMIT = 10;

const parseDate = (d) => {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  if (d?.seconds) return new Date(d.seconds * 1000);
  return new Date(d);
};

const toIso = (d) => parseDate(d)?.toISOString().slice(0, 10) ?? null;

const formatTaskList = (tasks) =>
  tasks
    .slice(0, APP_CONFIG.maxTasksForAI)
    .map((t, i) => {
      const due = t.dueDate ? `due ${toIso(t.dueDate)}` : "no due date";
      const cls = t.className ? `[${t.className}]` : "";
      const priority = (t.aiPriority ?? t.priority) ? `priority:${t.aiPriority ?? t.priority}` : "";
      return `${i + 1}. [ID:${t.id}] ${cls} "${t.title}" — ${due} ${priority}`.trim();
    })
    .join("\n");

const today = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// Safe JSON parse — handles minor model formatting issues
const safeParseJSON = (raw, type = "object") => {
  let text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const open = type === "array" ? "[" : "{";
  const close = type === "array" ? "]" : "}";
  const start = text.indexOf(open);
  if (start === -1) throw new Error(`No JSON ${type} in response`);
  let depth = 0, end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error(`Unterminated JSON ${type} in response`);
  const chunk = text.slice(start, end + 1);
  try {
    return JSON.parse(chunk);
  } catch {
    return JSON.parse(chunk.replace(/,\s*([}\]])/g, "$1"));
  }
};

// System message applied to every call — prevents [ID:xxx] echoing
const BASE_SYSTEM =
  "You are a helpful academic coach. NEVER include [ID:xxx] tags, task IDs, or internal identifiers in any text output. These are internal only and must never appear in recommendations, coaching lines, or any user-facing text.";

/**
 * Maps proxy/network errors to user-friendly messages.
 * Uses err.limit from the server 429 response when available.
 */
const friendlyError = (err) => {
  if (err?.limitReached) {
    const limit = err.limit ?? FREE_DAILY_LIMIT;
    return `You've used all ${limit} free AI messages today. Upgrade to Scholar for unlimited access.`;
  }
  const status = err?.status;
  if (status === 429 || status === 503)
    return "AI is busy right now — wait a minute and try again.";
  if (status === 401) return "AI configuration error. Please contact support.";
  if (status >= 500) return "AI service is having issues. Try again in a moment.";
  if (
    err?.message?.toLowerCase().includes("network") ||
    err?.message?.toLowerCase().includes("fetch")
  )
    return "Check your internet connection and try again.";
  return "Couldn't reach AI. Check your connection and try again.";
};

const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
};

const callProxy = async ({ model, messages, temperature = 0.3, max_tokens = 500 }) => {
  const token = await getIdToken();
  const res = await fetch(`${VERCEL_API_URL}/api/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("Proxy non-JSON response:", text.slice(0, 200));
    const err = new Error("AI service unavailable");
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error ?? "Proxy request failed");
    err.status = res.status;
    err.limitReached = data.limitReached ?? false;
    err.limit = data.limit ?? null; // forward server's limit for error messages
    throw err;
  }

  return data.content;
};

// ── Unified context builder ───────────────────────────────────
//
// mode: 'brief'  — overdue + next-7-days tasks + lean profile (used in chat)
//       'focus'  — just the pattern context string, no task list (used in getTodayFocus/getWhatDoIDo)
//       'full'   — same as 'brief' but 14-day window (future use)
//
const buildStudentContext = (tasks, userProfile, patterns, mode = "brief") => {
  // 'focus' mode: just the behavioral pattern string
  if (mode === "focus") {
    return patterns ? buildPatternContext(patterns, userProfile) : "No pattern data yet.";
  }

  const now     = new Date();
  const dayMs   = 24 * 60 * 60 * 1000;
  const windowMs = mode === "full" ? 14 * dayMs : 7 * dayMs;
  const windowEnd = new Date(now.getTime() + windowMs);

  const relevant = (tasks ?? [])
    .filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) <= windowEnd)
    .slice(0, 10);

  const overdue = (tasks ?? []).filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
  );

  const todayIso    = new Date().toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + dayMs).toISOString().slice(0, 10);

  const lines = [];
  lines.push(`Today: ${today()} (${todayIso}). Tomorrow is ${tomorrowIso}. Always use YYYY-MM-DD when setting dueDate.`);

  const classes = userProfile?.classes
    ?.map((c) => `${c.name} (${c.creditHours}cr, grade:${c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"})`)
    .join(", ");
  if (userProfile?.name)         lines.push(`Student name: ${userProfile.name}`);
  if (userProfile?.studentYear)  lines.push(`Year: ${userProfile.studentYear}`);
  if (classes)                   lines.push(`Classes: ${classes}`);
  if (userProfile?.semester) {
    const sys = userProfile?.schoolSystem === "quarter" ? "quarter system" : "semester system";
    lines.push(`Current term: ${userProfile.semester} (${sys})`);
  }
  if (userProfile?.preferredWorkTime) lines.push(`Best work time: ${userProfile.preferredWorkTime}`);
  if (userProfile?.learningStyle) {
    const styleMap = {
      "on-top":        "stays on top of things",
      "procrastinator":"tends to procrastinate",
      "structured":    "needs structure and reminders to stay on track",
    };
    lines.push(`Work style: ${styleMap[userProfile.learningStyle] ?? userProfile.learningStyle}`);
  }

  const taskLabel = (t) => {
    const cls   = t.className ? `[${t.className}] ` : "";
    const due   = t.dueDate ? ` due ${toIso(t.dueDate)}` : "";
    const grade = t.grade ? ` | grade: ${t.grade}` : "";
    return `${cls}"${t.title}"${due}${grade}`;
  };

  if (overdue.length > 0) lines.push(`OVERDUE: ${overdue.map(taskLabel).join(", ")}`);
  if (relevant.length > 0) {
    lines.push(`Upcoming (next ${mode === "full" ? "14" : "7"} days): ${relevant.map(taskLabel).join(", ")}`);
  } else {
    const pending = (tasks ?? []).filter((t) => !t.completed).slice(0, 5);
    if (pending.length > 0) lines.push(`Pending tasks: ${pending.map(taskLabel).join(", ")}`);
  }

  // Recently completed tasks (last 14 days, with or without grades)
  // Lets the AI acknowledge finished work and avoid suggesting it again
  const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
  const recentCompleted = (tasks ?? [])
    .filter((t) => t.completed && t.completedAt && new Date(t.completedAt) > fourteenDaysAgo)
    .slice(0, 8);
  if (recentCompleted.length > 0) {
    lines.push(
      `Recently completed: ${recentCompleted.map((t) => {
        const cls   = t.className ? `[${t.className}] ` : "";
        const grade = t.grade ? ` → ${t.grade}` : "";
        return `${cls}"${t.title}"${grade}`;
      }).join(", ")}`
    );
  }

  if (patterns) {
    const ctx = buildPatternContext(patterns, userProfile);
    if (ctx) lines.push(`\nBehavioral patterns:\n${ctx}`);
  }

  return lines.join("\n");
};

// ── 1. Today's Focus (auto-loads on dashboard) ───────────────
const FOCUS_CACHE_KEY = "@planora_focus_cache";
const FOCUS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

let _focusCache = null;
let _focusCachedAt = null;

export const getTodayFocus = async (tasks, userProfile, patterns) => {
  if (_focusCache && _focusCachedAt && Date.now() - _focusCachedAt < FOCUS_TTL_MS) {
    return _focusCache;
  }

  try {
    const stored = await AsyncStorage.getItem(FOCUS_CACHE_KEY);
    if (stored) {
      const { result, cachedAt } = JSON.parse(stored);
      if (Date.now() - cachedAt < FOCUS_TTL_MS) {
        _focusCache = result;
        _focusCachedAt = cachedAt;
        return result;
      }
    }
  } catch {}

  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return null;

  const patternCtx = buildStudentContext(null, userProfile, patterns, "focus");

  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...pending].sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return (PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1) - (PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1);
  });

  const taskList = formatTaskList(sorted);
  const shown = Math.min(APP_CONFIG.maxTasksForAI, sorted.length);
  const classes = userProfile?.classes
    ?.map((c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"})`)
    .join(", ") ?? "Not specified";

  const styleMap = { "on-top": "stays on top of things", "procrastinator": "tends to procrastinate", "structured": "needs structure and reminders" };
  const workStyleLine = userProfile?.learningStyle ? `Work style: ${styleMap[userProfile.learningStyle] ?? userProfile.learningStyle}` : null;

  const prompt = `You are a focused academic coach. Pick the 2-3 most important tasks for a student to work on TODAY.

Today: ${today()}
Classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}${workStyleLine ? `\n${workStyleLine}` : ""}

Behavioral patterns:
${patternCtx}

All pending tasks (sorted by urgency — most urgent first):
${taskList}
Note: showing ${shown} of ${pending.length} total pending tasks, sorted by urgency. You may be seeing a partial list.

Rules:
- Pick 2-3 tasks MAX. Not more.
- STRICT priority order: overdue first, then due today, then due this week, then HIGH priority tasks, then MEDIUM — NEVER pick a LOW priority task or a task due more than 2 weeks away if there are HIGH priority or sooner-due tasks available
- Factor in assumed complexity using this order: final exam / midterm > major project / paper / presentation > quiz / discussion post > reading / participation — readings should almost never appear unless nothing more important exists
- Use EXACT task IDs from the list above

Respond ONLY with this JSON, no markdown:
{
  "taskIds": ["id1", "id2"]
}`;

  try {
    const content = await callProxy({
      model: "gpt-4o-mini", // hardcoded — this runs on every dashboard load, keep it cheap
      messages: [
        { role: "system", content: BASE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
    const result = safeParseJSON(content.trim());
    const now = Date.now();
    _focusCache = result;
    _focusCachedAt = now;
    AsyncStorage.setItem(FOCUS_CACHE_KEY, JSON.stringify({ result, cachedAt: now })).catch(() => {});
    return result;
  } catch (err) {
    console.error("getTodayFocus failed:", err);
    if (err?.limitReached) return { limitReached: true };
    return null;
  }
};

export const invalidateTodayFocusCache = () => {
  _focusCache = null;
  _focusCachedAt = null;
  AsyncStorage.removeItem(FOCUS_CACHE_KEY).catch(() => {});
};

// ── 2. What Do I Do Right Now? ───────────────────────────────

export const getWhatDoIDo = async (tasks, userProfile, patterns) => {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0)
    return {
      recommendation: "You have no pending tasks! Enjoy the moment or add something new.",
      reasoning: null,
      taskId: null,
    };

  const patternCtx = buildStudentContext(null, userProfile, patterns, "focus");

  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...pending].sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return (PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1) - (PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1);
  });

  const taskList = formatTaskList(sorted);
  const shown = Math.min(APP_CONFIG.maxTasksForAI, sorted.length);
  const classes = userProfile?.classes
    ?.map((c) => `${c.name} (${c.creditHours} credits, current grade: ${c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"})`)
    .join(", ") ?? "Not specified";

  const WHAT_DO_I_DO_SYSTEM =
    "You are a blunt academic coach. You do not hedge. You name the exact task, name the exact deadline, and tell the student what to do in the first 10 minutes. No generic encouragement. Reference the student's actual patterns and deadlines. NEVER include [ID:xxx] tags, task IDs, or internal identifiers in any text output.";

  const wdidStyleMap = { "on-top": "stays on top of things", "procrastinator": "tends to procrastinate", "structured": "needs structure and reminders" };
  const wdidWorkStyle = userProfile?.learningStyle ? `Work style: ${wdidStyleMap[userProfile.learningStyle] ?? userProfile.learningStyle}` : null;

  const prompt = `Today: ${today()}
Student's classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}${wdidWorkStyle ? `\n${wdidWorkStyle}` : ""}

Behavioral patterns (learned from their history):
${patternCtx}

Pending tasks (sorted by urgency — most urgent first):
${taskList}
Note: showing ${shown} of ${pending.length} total pending tasks, sorted by urgency. You may be seeing a partial list.

Rules for picking the task:
- STRICT priority order: overdue first, then due today, then due this week, then HIGH priority, then MEDIUM — never pick LOW or far-future if more urgent work exists
- Complexity order: final / midterm > project / paper > quiz / discussion post > reading — readings almost never
- Classify a task as a reading if its title contains words like: read, chapter, pages, textbook, article, review notes. Readings should almost never be selected unless nothing more urgent exists.
- Pick ONE. No hedging, no alternatives.

Rules for the response:
- "recommendation": One sharp, direct sentence. Name the exact task. Sound like a coach, not a bot. E.g. "Start your HIST 201 paper outline tonight — it's due Friday and this is the right moment to get ahead of it."
- "reasoning": 2-4 sentences of actual coaching. Tell them HOW to start (open the doc, write the first bullet, do the first 10 problems — be specific). Reference a real pattern or deadline if relevant. Make them feel like someone is actually paying attention to their situation.

Respond ONLY with this JSON, no markdown:
{
  "taskId": "the_exact_task_id_from_list",
  "recommendation": "One sharp directive sentence naming the exact task.",
  "reasoning": "2-4 sentences of specific coaching on how to approach it."
}`;

  try {
    const content = await callProxy({
      model: APP_CONFIG.gptModel,
      messages: [
        { role: "system", content: WHAT_DO_I_DO_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 400,
    });
    return safeParseJSON(content.trim());
  } catch (err) {
    console.error("getWhatDoIDo failed:", err);
    throw new Error(friendlyError(err));
  }
};

// ── 3. Academic Coach Chat ───────────────────────────────────

const CHAT_SYSTEM = (contextBlock) =>
  `You are an academic coach inside Planora, a productivity app for college students. Be direct, warm, and specific. Keep responses concise (2-4 sentences) unless they ask for something detailed. Never be generic.

CLASS vs TASK rule (read this first): when the student asks about a CLASS (e.g. "which class should I worry about?"), answer with the class name (e.g. "HIST 101"), not a task title. When they ask about a specific task, use the task title. Never mix these up.

Task creation: If the user explicitly asks you to add, create, or schedule a task, follow these rules:
1. If no class is mentioned and the user has classes set up, ask which class it's for before creating it.
2. For due dates, always calculate relative to the Today date provided in the context block below. "Tomorrow" = Today + 1 day, "Friday" = the next upcoming Friday from Today, etc. Never guess the date independently.
3. Set priority using your own judgment — weigh ALL of these factors together:
   - Due today → always HIGH, no exceptions (even reading or low-stakes work)
   - Due tomorrow → HIGH unless the task is genuinely trivial (e.g. "buy coffee")
   - Due within 7 days → MEDIUM; further out → LOW
   - Assignment weight: final exam / midterm / major paper → bump up one level if within 2 weeks
   - Class importance: if the student's hardest class or highest-credit class is in context, weight its tasks higher
   - No due date: use assignment type — a final project with no date is still MEDIUM, casual participation is LOW
4. For a SINGLE task, append this block at the very end of your response:
%%ACTION:{"type":"createTask","title":"<task title>","dueDate":"<YYYY-MM-DD or null>","className":"<class name or null>","priority":"<HIGH|MEDIUM|LOW>"}%%
5. If the user asks to break down, split, or create subtasks for a task, first look up the task in the context above — its due date, class, and priority are already there. Only ask for details that are NOT in the context (e.g. page count, specific requirements, format). If you need to ask, ask everything in one message with each question on its own line so the user can reply all at once. Never ask for information already available in context. Once you have enough info, generate 3-5 specific actionable subtasks following these rules exactly:
- Due dates: space evenly between today and 1 day BEFORE the parent's due date. No subtask may land on or after the parent's due date. If the parent is due in 2 days, fit all subtasks within those 2 days (same-day is allowed only when the window is that tight). Never assign all subtasks the same date unless unavoidable.
- If the parent has no due date, space subtasks 2-3 days apart starting from tomorrow.
- Priority: LOW for early subtasks, MEDIUM for middle, HIGH for the last one (closest to deadline).
- Titles: start with an action verb ("Draft", "Find", "Read", "Outline", "Review", "Submit"). Never use a title identical or nearly identical to the parent task.
- Be specific to the actual task — subtasks for a research paper differ from subtasks for a lab report.
Append this block:
%%ACTION:{"type":"createTasks","tasks":[{"title":"<subtask title>","dueDate":"<YYYY-MM-DD>","dueTime":[H,M],"className":"<class name or null>","priority":"<HIGH|MEDIUM|LOW>"},...]}%%
dueTime is optional — only include it if a specific time makes sense (e.g. "finish draft by 3pm" → [15,0]). Omit the field entirely if no time is relevant.
6. If the user asks to move, reschedule, push back, or delay a task, find it in context by name and append:
%%ACTION:{"type":"rescheduleTask","taskId":"<exact task id from context>","newDueDate":"<YYYY-MM-DD>"}%%
7. If the user says they finished, completed, or did a task, find it in context by name and append:
%%ACTION:{"type":"completeTask","taskId":"<exact task id from context>"}%%
After marking a task complete, ask "Did you get a grade on it?" If the user replies with a grade, append:
%%ACTION:{"type":"logGrade","taskId":"<exact task id>","grade":"<grade value>"}%%
Only include an action block when you have enough info. Never include it for questions or advice.

${contextBlock}`;

/**
 * Send one chat turn to the coach.
 */
export const sendChatMessage = async (
  history,
  userMessage,
  tasks,
  userProfile,
  patterns
) => {
  const contextBlock = buildStudentContext(tasks, userProfile, patterns, "brief");
  const systemMsg    = { role: "system", content: CHAT_SYSTEM(contextBlock) };

  // Cap history at last 8 messages to leave token headroom
  const trimmedHistory = history.slice(-8);

  const messages = [
    systemMsg,
    ...trimmedHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const raw = await callProxy({
      model: APP_CONFIG.gptModel, // chat uses primary model — nuanced coaching matters here
      messages,
      temperature: 0.5,
      max_tokens: 400,
    });

    // Guard against double action blocks — use the last one if multiple appear
    const actionOccurrences = (raw.match(/%%ACTION:/g) ?? []).length;
    if (actionOccurrences > 1) {
      console.warn(`sendChatMessage: ${actionOccurrences} action blocks found, using last`);
    }
    const actionPattern = /%%ACTION:(.+?)%%/gs;
    let actionMatch = null;
    let m;
    while ((m = actionPattern.exec(raw)) !== null) actionMatch = m; // keep last

    let action = null;
    if (actionMatch) {
      try { action = JSON.parse(actionMatch[1]); } catch {}
    }
    const text = raw.replace(/\n?%%ACTION:.+?%%/gs, "").trim();

    return { text, action };
  } catch (err) {
    console.error("sendChatMessage failed:", err);
    const error = new Error(friendlyError(err));
    error.limitReached = err?.limitReached ?? false;
    throw error;
  }
};

// ── 5. Study Plan Generator ──────────────────────────────────

const TASK_DURATION_MINUTES = (title = "") => {
  const t = title.toLowerCase();
  if (/final|midterm/.test(t))                        return 180;
  if (/exam|test/.test(t))                            return 150;
  if (/paper|essay|report|thesis|write/.test(t))      return 120;
  if (/project|presentation|lab report/.test(t))      return 90;
  if (/lab|assignment|problem set|pset|hw|homework/.test(t)) return 60;
  if (/quiz|discussion|post|response/.test(t))        return 45;
  if (/read|chapter|pages|textbook|article/.test(t))  return 60;
  return 60;
};

export const generateStudyPlan = async (tasks, userProfile, patterns, availability, completedSessions = []) => {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  const pending = (tasks ?? [])
    .filter((t) => !t.completed && t.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 15);

  if (pending.length === 0) throw new Error("No upcoming tasks to plan around.");

  // Build class lookup: name → { grade, credits }
  const classLookup = {};
  (userProfile?.classes ?? []).forEach((c) => {
    if (c.name) classLookup[c.name] = c;
  });

  // Build avoidance lookup: taskId → daysSinceTouched
  const avoidanceLookup = {};
  (patterns?.avoidanceScores ?? []).forEach((a) => {
    if (a.isBeingAvoided) avoidanceLookup[a.taskId] = a.daysSinceTouched;
  });

  const taskLines = pending.map((t) => {
    const daysUntil = Math.ceil((new Date(t.dueDate) - now) / (1000 * 60 * 60 * 24));
    const est = TASK_DURATION_MINUTES(t.title);

    // Class context: grade + credits
    const clsData  = t.className ? classLookup[t.className] : null;
    const gradeStr = clsData?.grade && clsData.grade !== "No grade yet"
      ? ` | grade: ${clsData.grade}${isStrugglingGrade(clsData.grade) ? " ⚠️ struggling" : ""}`
      : "";
    const creditStr = clsData?.credits ? ` | ${clsData.credits} credits` : "";
    const cls = t.className ? `[${t.className}${gradeStr}${creditStr}]` : "";

    const urgency = daysUntil < 0
      ? "OVERDUE (already past due — catch up ASAP, 1 session only)"
      : daysUntil === 0 ? "DUE TODAY"
      : daysUntil === 1 ? "DUE TOMORROW"
      : `due in ${daysUntil} days`;

    // Pre-compute minutes available before this task's deadline
    const taskDueDate = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate?.seconds ? new Date(t.dueDate.seconds * 1000) : new Date(t.dueDate);
    const dueDateLocalStr = format(taskDueDate, "yyyy-MM-dd");
    const minsAvailable = availability
      .filter((d) => {
        if (daysUntil <= 0) return d.date === todayStr;
        return d.date >= todayStr && d.date < dueDateLocalStr;
      })
      .reduce((sum, d) => sum + d.hours * 60, 0);

    const timeNote    = minsAvailable < est ? " ⚠️ tight on time — tell student to prioritize this" : "";
    const avoidedNote = avoidanceLookup[t.id] ? ` | ⚠️ being avoided (${avoidanceLookup[t.id]}d untouched — front-load this)` : "";

    return `- [ID:${t.id}] ${cls} "${t.title}" — ${urgency}, est. ${est} min${timeNote}${avoidedNote}, priority: ${t.aiPriority ?? t.priority ?? "MEDIUM"}`;
  }).join("\n");

  const availLines = availability
    .filter((d) => d.hours > 0)
    .map((d) => `${d.label} (${d.date}): ${d.hours * 60} min available`)
    .join("\n");

  const name = userProfile?.name ? `Student: ${userProfile.name}. ` : "";
  const patternContext = patterns ? buildPatternContext(patterns, userProfile) : null;

  const prompt = `You are an expert academic coach building a personalized weekly study plan. Produce sessions that are specific, actionable, and genuinely useful — not generic filler. Every session must feel written for this student specifically.

${name}Today: ${today()} (date: ${todayStr})

Daily availability (soft guide for spreading non-urgent work):
${availLines || "120 min/day for all days"}

Tasks to schedule:
${taskLines}
${completedSessions.length > 0 ? `\nAlready completed this week — reduce remaining time estimates for these tasks accordingly:\n${completedSessions.map((s) => `- ${s.className ? `[${s.className}] ` : ""}"${s.sessionTitle}" (${s.durationMinutes ?? 0}min logged)`).join("\n")}` : ""}
${patternContext ? `\nSTUDENT BEHAVIORAL PATTERNS (use these actively — they are real data):\n${patternContext}` : ""}

═══ SCHEDULING RULES ═══

1. DATE CONSTRAINT: Every session must be scheduled BEFORE the task's due date. Never on or after it. OVERDUE tasks → schedule today only.

2. URGENT (OVERDUE or DUE TODAY): Schedule today. Ignore availability limits entirely.

3. DUE TOMORROW: Schedule today. Ignore availability limits if needed.

4. AVAILABILITY: For tasks due in 2+ days, use daily availability as a soft guide. Never let it push a session past a deadline. If the only days before a deadline have 0 availability, schedule there anyway — the student needs to find time.

5. DAILY CAP: Maximum 4 study sessions per calendar day. If you must choose, prioritize by urgency then priority.

6. ZERO-AVAILABILITY OVERRIDE: If a task is due in ≤3 days and no available day before the deadline has study time, schedule the session anyway. In the activity, tell the student directly: "You'll need to carve out time for this — it's due [date] and can't wait."

7. TIGHT TIME (⚠️ tasks): Always schedule these, even on 0-availability days. Activity must explicitly say the student needs to make time — be direct, not soft.

9. AVOIDED TASKS (⚠️ being avoided): Front-load these — schedule the first session as early as possible, not near the deadline.

10. FINAL "COMPLETE" SESSION — NO EXCEPTIONS: Every task must end with a concrete submission/completion session (e.g. "Submit discussion post", "Turn in problem set", "Upload final essay"). For homework, quizzes, discussion posts — ONE final session only. Prep sessions come before it.

11. TASK-TYPE SESSION REQUIREMENTS:
    - EXAM or TEST → minimum 2 sessions: (1) focused review of key concepts, (2) practice/self-quiz the day before
    - PAPER or ESSAY → minimum 3 sessions: (1) outline/thesis, (2) draft body, (3) revise and submit
    - DISCUSSION POST or RESPONSE → 1 session: write and submit in one sitting
    - HOMEWORK/PROBLEM SET → 1–2 sessions: optional review first, then complete and submit
    - READING → 1 session: read + active notes

12. CLASS WEIGHT: Tasks for classes with struggling grades (⚠️) get an extra review session. Higher credit courses take priority when daily time is limited.

13. BEHAVIORAL PERSONALIZATION:
    - Procrastinator / high late rate → front-load sessions, never schedule key work for the day before
    - Struggling grade (⚠️) → extra "review concepts" session before submission
    - Productive time listed → reference it naturally in the activity
    - ONLY use patterns explicitly stated above. Never invent.

═══ SESSION QUALITY RULES ═══

14. SESSION TITLE: 3–7 words, action-verb first, specific — e.g. "Outline argument structure", "Solve problems 1–15", "Review Ch. 4 lecture notes", "Draft body paragraphs", "Submit discussion response". Never restate the raw task title.

15. ACTIVITY: Exactly 2 sentences.
    Sentence 1 — how to START: name specific materials (chapter, problem set numbers, essay section, lecture slides). Never say "review your notes" or "work on the assignment" — name the actual thing.
    Sentence 2 — what to PRODUCE: concrete output ("3 body paragraphs drafted", "problems 1–20 attempted and checked", "post submitted"). If urgency or a pattern is relevant, weave it in naturally.

16. DURATION: Use the est. minutes as a floor. Adjust up for struggling grades or avoided tasks. Keep individual sessions under 120 min.

17. COVERAGE: Every task in the list gets at least one session.

Output ONLY a raw JSON array — no markdown, no explanation:
[{
  "taskId": "exact_id_from_list",
  "sessionTitle": "Short specific title",
  "date": "YYYY-MM-DD",
  "durationMinutes": 60,
  "activity": "Specific how-to-start sentence. Concrete output sentence."
}]`;

  const content = await callProxy({
    model: "gpt-4o",
    messages: [
      { role: "system", content: BASE_SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  });

  const sessions = safeParseJSON(content.trim(), "array");

  const validIds = new Set(pending.map((t) => t.id));

  return sessions
    .filter((s) => validIds.has(s.taskId))
    .map((s) => {
      const task = pending.find((t) => t.id === s.taskId);
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate?.seconds ? new Date(task.dueDate.seconds * 1000) : new Date(task.dueDate);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDue < 0;

      // Hard enforce in code: overdue → today, future → must be before due date
      let date = s.date;
      if (isOverdue) {
        date = todayStr;
      } else {
        const dueDateLocalStr = format(dueDate, "yyyy-MM-dd");
        const dayBeforeStr = format(addDays(dueDate, -1), "yyyy-MM-dd");
        if (date > dueDateLocalStr) {
          // Session is after due date — move to day before, minimum today
          date = dayBeforeStr >= todayStr ? dayBeforeStr : todayStr;
        }
      }

      return {
        ...s,
        date,
        sessionTitle: s.sessionTitle ?? task?.title ?? "Study session",
        taskTitle: task?.title ?? "",
        className: task?.className ?? null,
        taskDueDate: format(dueDate, "M/d"),
      };
    });
};

// ── 4. AI Priority Suggestion ────────────────────────────────

export const suggestPriorities = async (tasks, patterns, userProfile = null) => {
  if (!tasks || tasks.length === 0) return [];

  const patternCtx = buildStudentContext(null, userProfile, patterns, "focus");
  const taskList = formatTaskList(tasks);
  const shown = Math.min(APP_CONFIG.maxTasksForAI, tasks.length);

  const prompt = `You are a productivity assistant. Assign each task a priority based on urgency, assignment type, and student context.

Today: ${today()}
${patternCtx ? `\nUser patterns:\n${patternCtx}` : ""}

Tasks:
${taskList}
Note: showing ${shown} of ${tasks.length} total pending tasks, sorted by urgency. You may be seeing a partial list.

Priority rules — apply ALL that match, take the highest result:

HIGH:
- Due today or tomorrow, any assignment type
- Exam, midterm, final, or comprehensive quiz due within 7 days (needs prep time)
- Major paper, thesis, or research project due within 5 days
- Student has a struggling/low grade in this class AND due within 10 days
- Overdue

MEDIUM:
- Due within 7 days (homework, problem set, lab, standard assignment)
- Exam or final due within 14 days (start studying now)
- Paper or project due within 10 days
- No due date but meaningful deliverable (essay draft, project milestone)

LOW:
- Reading, participation post, discussion reply, or attendance — due within 7 days
- Any assignment due 14+ days away that is NOT an exam or major project
- No due date and genuinely minor (optional extra credit, casual reflection)

Type guide: "exam", "midterm", "final", "test" = high-stakes. "paper", "essay", "thesis", "project", "report" = moderate-high. "homework", "problem set", "lab", "quiz" = moderate. "reading", "participation", "discussion", "post", "reflection", "attendance" = lower-stakes.

- If your reason exceeds 12 words, cut it to the single most important phrase. Never give more than one reason per task.

CRITICAL: Output ONLY a raw JSON array. Start with [ end with ]. No markdown, no text.
[{"id":"task_id","aiPriority":"HIGH","aiReason":"Max 12 words explaining why"}]`;

  try {
    const content = await callProxy({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: BASE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1400,
    });

    const data = safeParseJSON(content.trim(), "array");

    return tasks.map((task) => {
      const s = data.find((p) => p.id === task.id);
      return s ? { ...task, aiPriority: s.aiPriority, aiReason: s.aiReason } : task;
    });
  } catch (err) {
    console.error("suggestPriorities failed:", err);
    throw new Error(friendlyError(err));
  }
};
