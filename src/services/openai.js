// ============================================================
// src/services/openai.js
//
// All AI calls go through the Vercel proxy (api/ai.js).
// The OpenAI API key never touches the client bundle.
// Firebase ID token is sent on every request for auth + rate limiting.
// ============================================================

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
      const priority = t.priority ? `priority:${t.priority}` : "";
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
    return "You've used all 10 free AI requests today. Upgrade to Pro for unlimited access.";
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
// Module-level cache — survives navigation, resets after 2 hours
let _focusCache = null;
let _focusCachedAt = null;
const FOCUS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export const getTodayFocus = async (tasks, userProfile, patterns) => {
  if (
    _focusCache &&
    _focusCachedAt &&
    Date.now() - _focusCachedAt < FOCUS_TTL_MS
  ) {
    return _focusCache;
  }

  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return null;

  const patternCtx = patterns
    ? buildPatternContext(patterns, userProfile)
    : "No pattern data yet.";
  const taskList = formatTaskList(pending);
  const classes =
    userProfile?.classes
      ?.map(
        (c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade ?? "?"})`
      )
      .join(", ") ?? "Not specified";

  const prompt = `You are a focused academic coach. Pick the 2-3 most important tasks for a student to work on TODAY and write one short coaching line.

Today: ${today()}
Classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}

Behavioral patterns:
${patternCtx}

All pending tasks:
${taskList}

Rules:
- Pick 2-3 tasks MAX. Not more.
- Prioritize: overdue > due today > due this week with avoidance > low-grade classes
- The coachLine should be 1 sentence, specific, and reference a real pattern or deadline — not generic advice
- Use EXACT task IDs from the list above

Respond ONLY with this JSON, no markdown:
{
  "taskIds": ["id1", "id2"],
  "coachLine": "One specific sentence referencing their actual situation."
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
    _focusCache = result;
    _focusCachedAt = Date.now();
    return result;
  } catch (err) {
    console.error("getTodayFocus failed:", err);
    return null; // Fails silently — card just won't show
  }
};

// Call this when tasks change significantly (new task added, task completed)
export const invalidateTodayFocusCache = () => {
  _focusCache = null;
  _focusCachedAt = null;
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
  const taskList = formatTaskList(pending);
  const classes =
    userProfile?.classes
      ?.map(
        (c) =>
          `${c.name} (${c.creditHours} credits, current grade: ${
            c.grade ?? "unknown"
          })`
      )
      .join(", ") ?? "Not specified";

  const prompt = `You are a proactive personal productivity coach. Based on everything you know, tell them exactly ONE task to work on right now.

Today: ${today()}
Student's classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}

Behavioral patterns (learned from their history):
${patternCtx}

Pending tasks:
${taskList}

Rules:
- Pick exactly ONE task. Do not hedge or list alternatives.
- Reference the task by its EXACT title.
- If they have a pattern of leaving a certain class late, call it out by name.
- Be direct and confident. Max 1 sentence for recommendation.

Respond ONLY with this JSON, no markdown:
{
  "taskId": "the_exact_task_id_from_list",
  "recommendation": "One confident sentence using the exact task title.",
  "reasoning": "2-3 sentences max explaining why, referencing their actual patterns and deadlines."
}`;

  try {
    const content = await callProxy({
      model: APP_CONFIG.gptModel,
      messages: [
        { role: "system", content: BASE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });
    return safeParseJSON(content.trim());
  } catch (err) {
    console.error("getWhatDoIDo failed:", err);
    throw new Error(friendlyError(err));
  }
};

// ── 3. Weekly Plan ───────────────────────────────────────────

export const getWeeklyPlan = async (tasks, userProfile, patterns) => {
  const pending = tasks.filter((t) => !t.completed);
  const patternCtx = patterns
    ? buildPatternContext(patterns, userProfile)
    : "No pattern data yet.";
  const taskList = formatTaskList(pending);
  const classes =
    userProfile?.classes
      ?.map(
        (c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade ?? "?"})`
      )
      .join("\n  ") ?? "Not specified";
  const preferredTime = userProfile?.preferredWorkTime ?? "not specified";

  const exactTitles = pending
    .slice(0, APP_CONFIG.maxTasksForAI)
    .map((t) => `"${t.title}"`)
    .join(", ");

  const prompt = `You are an academic planner. Build a realistic 7-day study plan for a college student.

TODAY: ${today()}
PREFERRED STUDY TIME: ${preferredTime}

CLASSES:
  ${classes}

BEHAVIORAL PATTERNS:
${patternCtx}

TASKS TO SCHEDULE:
${taskList}

STRICT RULES:
1. Each day's task list must contain ONLY exact task titles from this list: ${exactTitles}
2. NEVER invent chapter numbers, page numbers, reading assignments, or subtasks.
3. NEVER suggest tasks not in the list above.
4. If a task has a due date, schedule it on or before that date.
5. Front-load tasks for classes where the student has a late pattern.
6. Maximum 3 tasks per day.
7. If no tasks fit a day naturally, leave it as a rest day (empty tasks array).
8. The "note" field should be a brief specific coach tip, not generic advice.

Respond ONLY with this JSON (no markdown):
{
  "headline": "One encouraging sentence about their week",
  "keyInsight": "One behavioral insight referencing a specific class or habit",
  "days": [
    {
      "day": "Monday",
      "date": "Feb 24",
      "tasks": ["exact task title from list"],
      "note": "Optional short coach tip"
    }
  ],
  "warnings": ["Any overdue or at-risk items with specific due dates"]
}`;

  try {
    const content = await callProxy({
      model: APP_CONFIG.gptModel,
      messages: [
        { role: "system", content: BASE_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const result = safeParseJSON(content.trim());

    // Post-process: validate task titles actually exist
    const validTitles = new Set(pending.map((t) => t.title));
    if (result.days) {
      result.days = result.days.map((day) => ({
        ...day,
        tasks: (day.tasks ?? []).filter((title) => validTitles.has(title)),
      }));
    }

    return result;
  } catch (err) {
    console.error("getWeeklyPlan failed:", err);
    throw new Error(friendlyError(err));
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
- HIGH: Due within 2 days, or student historically struggles with this class
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
