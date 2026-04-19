// ============================================================
// src/services/openai.js
//
// All AI calls go through the Vercel proxy (api/ai.js).
// The OpenAI API key never touches the client bundle.
// Firebase ID token is sent on every request for auth + rate limiting.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG, VERCEL_API_URL } from "../config";
import { buildPatternContext } from "./patternAnalysis";
import { auth } from "./firebase";

// ── Helpers ──────────────────────────────────────────────────

const formatTaskList = (tasks) =>
  tasks
    .slice(0, APP_CONFIG.maxTasksForAI)
    .map((t, i) => {
      const due = t.dueDate
        ? `due ${new Date(t.dueDate).toLocaleDateString()}`
        : "no due date";
      const cls = t.className ? `[${t.className}]` : "";
      const priority = (t.aiPriority ?? t.priority) ? `priority:${t.aiPriority ?? t.priority}` : "";
      return `${i + 1}. [ID:${t.id}] ${cls} "${
        t.title
      }" — ${due} ${priority}`.trim();
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
  let depth = 0,
    end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
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
 */
const friendlyError = (err) => {
  if (err?.limitReached) {
    return "You've used all 10 free AI requests today. Upgrade to Scholar for unlimited access.";
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

/**
 * Gets a fresh Firebase ID token for the current user.
 * Throws if the user is not signed in.
 */
const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
};

/**
 * POST to the Vercel proxy with auth token + OpenAI params.
 * Returns the raw content string from the model.
 */
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

  // Guard against Vercel returning an HTML error page (e.g. missing env vars)
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
    throw err;
  }

  return data.content;
};

// ── 1. Today's Focus (auto-loads on dashboard) ───────────────
// Two-tier cache: memory (survives navigation) + AsyncStorage (survives cold launch)
// TTL: 2 hours. A cold launch within 2 hours costs 0 API calls.
const FOCUS_CACHE_KEY = "@planora_focus_cache";
const FOCUS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

let _focusCache = null;
let _focusCachedAt = null;

export const getTodayFocus = async (tasks, userProfile, patterns) => {
  // 1. Check memory cache
  if (_focusCache && _focusCachedAt && Date.now() - _focusCachedAt < FOCUS_TTL_MS) {
    return _focusCache;
  }

  // 2. Check AsyncStorage cache (survives cold launch)
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
  } catch {
    // ignore — fall through to API call
  }

  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return null;

  const patternCtx = patterns
    ? buildPatternContext(patterns, userProfile)
    : "No pattern data yet.";

  // Sort tasks before sending: soonest due first, then HIGH priority, so the AI
  // sees the most urgent work at the top of the list
  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...pending].sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    const aPri = PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1;
    const bPri = PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1;
    return aPri - bPri;
  });

  const taskList = formatTaskList(sorted);
  const classes =
    userProfile?.classes
      ?.map(
        (c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"})`
      )
      .join(", ") ?? "Not specified";

  const prompt = `You are a focused academic coach. Pick the 2-3 most important tasks for a student to work on TODAY.

Today: ${today()}
Classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}

Behavioral patterns:
${patternCtx}

All pending tasks (sorted by urgency — most urgent first):
${taskList}

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
      model: APP_CONFIG.gptModel,
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
    return null; // Fails silently — card just won't show
  }
};

// Call this when tasks change significantly (new task added, task completed)
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
      recommendation:
        "You have no pending tasks! Enjoy the moment or add something new.",
      reasoning: null,
      taskId: null,
    };

  const patternCtx = patterns
    ? buildPatternContext(patterns, userProfile)
    : "No pattern data yet.";

  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...pending].sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return (PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1) - (PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1);
  });

  const taskList = formatTaskList(sorted);
  const classes =
    userProfile?.classes
      ?.map(
        (c) =>
          `${c.name} (${c.creditHours} credits, current grade: ${
            c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"
          })`
      )
      .join(", ") ?? "Not specified";

  const prompt = `You are a direct, no-nonsense academic coach. You know this student's habits, grades, and workload. Give them exactly ONE task to open right now and coach them on how to attack it.

Today: ${today()}
Student's classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}

Behavioral patterns (learned from their history):
${patternCtx}

Pending tasks (sorted by urgency — most urgent first):
${taskList}

Rules for picking the task:
- STRICT priority order: overdue first, then due today, then due this week, then HIGH priority, then MEDIUM — never pick LOW or far-future if more urgent work exists
- Complexity order: final / midterm > project / paper > quiz / discussion post > reading — readings almost never
- Pick ONE. No hedging, no alternatives.

Rules for the response:
- "recommendation": One sharp, direct sentence. Name the exact task. Sound like a coach, not a bot. E.g. "Start your HIST 201 paper outline tonight — it's due Friday and you always leave writing late."
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
        { role: "system", content: BASE_SYSTEM },
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

Important: when the student asks about a CLASS (e.g. "which class should I worry about?"), answer with the class name (e.g. "HIST 101"), not a task title. Tasks belong to classes — use the class name for class-level questions and the task title for task-level questions.

Task creation: If the user explicitly asks you to add, create, or schedule a task, follow these rules:
1. If no class is mentioned and the user has classes set up, ask which class it's for before creating it.
2. For due dates, always calculate relative to the Today date provided in the context block below. "Tomorrow" = Today + 1 day, "Friday" = the next upcoming Friday from Today, etc. Never guess the date independently.
3. Set priority automatically based on due date: due today or tomorrow = HIGH, due within 7 days = MEDIUM, further out or no due date = LOW.
4. For a SINGLE task, append this block at the very end of your response:
%%ACTION:{"type":"createTask","title":"<task title>","dueDate":"<YYYY-MM-DD or null>","className":"<class name or null>","priority":"<HIGH|MEDIUM|LOW>"}%%
5. If the user asks to break down, split, or create subtasks for a task, generate 3-5 specific actionable subtasks and append this block instead:
%%ACTION:{"type":"createTasks","tasks":[{"title":"<subtask title>","dueDate":"<YYYY-MM-DD or null>","className":"<class name or null>","priority":"<HIGH|MEDIUM|LOW>"},...]}%%
Only include an action block when you have enough info. Never include it for questions or advice.

${contextBlock}`;

/**
 * Build a lean context block for chat.
 * Only includes overdue + next-7-days tasks to keep tokens low.
 */
const buildChatContext = (tasks, userProfile, patterns) => {
  const now      = new Date();
  const in7days  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const relevant = tasks
    .filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) <= in7days)
    .slice(0, 10);

  const overdue = tasks.filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
  );

  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const lines = [];
  lines.push(`Today: ${today()} (${todayIso}). Tomorrow is ${tomorrowIso}. Always use YYYY-MM-DD when setting dueDate.`);

  const classes = userProfile?.classes
    ?.map((c) => `${c.name} (${c.creditHours}cr, grade:${c.grade && c.grade !== "No grade yet" ? c.grade : "none yet"})`)
    .join(", ");
  if (userProfile?.name) lines.push(`Student name: ${userProfile.name}`);
  if (userProfile?.studentYear) lines.push(`Year: ${userProfile.studentYear}`);
  if (classes) lines.push(`Classes: ${classes}`);
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
    const desc = styleMap[userProfile.learningStyle] ?? userProfile.learningStyle;
    lines.push(`Work style: ${desc}`);
  }

  const taskLabel = (t) => {
    const cls = t.className ? `[${t.className}] ` : "";
    const due = t.dueDate ? ` due ${new Date(t.dueDate).toLocaleDateString()}` : "";
    return `${cls}"${t.title}"${due}`;
  };

  if (overdue.length > 0) {
    lines.push(`OVERDUE: ${overdue.map(taskLabel).join(", ")}`);
  }
  if (relevant.length > 0) {
    lines.push(`Upcoming (next 7 days): ${relevant.map(taskLabel).join(", ")}`);
  } else {
    const pending = tasks.filter((t) => !t.completed).slice(0, 5);
    if (pending.length > 0) {
      lines.push(`Pending tasks: ${pending.map(taskLabel).join(", ")}`);
    }
  }

  if (patterns) {
    const ctx = buildPatternContext(patterns, userProfile);
    if (ctx) lines.push(`\nBehavioral patterns:\n${ctx}`);
  }

  return lines.join("\n");
};

/**
 * Send one chat turn to the coach.
 * @param {Array}  history     - prior messages [{role, content}], max last 10
 * @param {string} userMessage - the new user message
 * @param {Array}  tasks       - all tasks for context
 * @param {object} userProfile
 * @param {object} patterns
 * @returns {string} AI reply text
 */
export const sendChatMessage = async (
  history,
  userMessage,
  tasks,
  userProfile,
  patterns
) => {
  const contextBlock = buildChatContext(tasks, userProfile, patterns);
  const systemMsg    = { role: "system", content: CHAT_SYSTEM(contextBlock) };

  // Cap history at last 10 messages to keep tokens lean
  const trimmedHistory = history.slice(-10);

  const messages = [
    systemMsg,
    ...trimmedHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const raw = await callProxy({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.5,
      max_tokens: 400,
    });

    // Parse optional task-creation action block
    const actionMatch = raw.match(/%%ACTION:(.+?)%%/s);
    let action = null;
    if (actionMatch) {
      try { action = JSON.parse(actionMatch[1]); } catch {}
    }
    const text = raw.replace(/\n?%%ACTION:.+?%%/s, "").trim();

    return { text, action };
  } catch (err) {
    console.error("sendChatMessage failed:", err);
    const error = new Error(friendlyError(err));
    error.limitReached = err?.limitReached ?? false;
    throw error;
  }
};

// ── 4. AI Priority Suggestion ────────────────────────────────

export const suggestPriorities = async (
  tasks,
  patterns,
  userProfile = null
) => {
  if (!tasks || tasks.length === 0) return [];

  const patternCtx = patterns ? buildPatternContext(patterns, userProfile) : "";
  const taskList = formatTaskList(tasks);

  const prompt = `You are a productivity assistant. Assign each task a priority based on urgency, due dates, and student behavioral patterns.

Today: ${today()}
${patternCtx ? `\nUser patterns:\n${patternCtx}` : ""}

Tasks:
${taskList}

Rules:
- HIGH: Due today or tomorrow, or student historically struggles with this class
- MEDIUM: Due within a week, or moderate importance
- LOW: No deadline, or low stakes

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
      return s
        ? { ...task, aiPriority: s.aiPriority, aiReason: s.aiReason }
        : task;
    });
  } catch (err) {
    console.error("suggestPriorities failed:", err);
    throw new Error(friendlyError(err));
  }
};
