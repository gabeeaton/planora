// ============================================================
// src/services/openai.js
// Fixed: weekly plan prompt tightened to eliminate hallucinations.
// All AI calls receive full behavioral context via patterns.
// ============================================================

import OpenAI from "openai";
import { OPENAI_API_KEY, APP_CONFIG } from "../config";
import { buildPatternContext } from "./patternAnalysis";

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// ── Helper ───────────────────────────────────────────────────

const formatTaskList = (tasks) =>
  tasks
    .slice(0, APP_CONFIG.maxTasksForAI)
    .map((t, i) => {
      const due      = t.dueDate ? `due ${new Date(t.dueDate).toLocaleDateString()}` : "no due date";
      const cls      = t.className ? `[${t.className}]` : "";
      const priority = t.priority  ? `priority:${t.priority}` : "";
      return `${i + 1}. [ID:${t.id}] ${cls} "${t.title}" — ${due} ${priority}`.trim();
    })
    .join("\n");

const today = () => new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

// Safe JSON parse — handles minor model formatting issues
const safeParseJSON = (raw, type = "object") => {
  const pattern = type === "array" ? /\[.*\]/s : /\{.*\}/s;
  const match   = raw.match(pattern);
  if (!match) throw new Error(`No JSON ${type} in response`);
  try {
    return JSON.parse(match[0]);
  } catch {
    // Attempt to clean common issues (trailing commas, unquoted keys)
    const cleaned = match[0].replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned);
  }
};

// ── 1. What Do I Do Right Now? ───────────────────────────────

export const getWhatDoIDo = async (tasks, userProfile, patterns) => {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return {
    recommendation: "You have no pending tasks! Enjoy the moment or add something new.",
    reasoning: null,
    taskId: null,
  };

  const patternCtx = patterns ? buildPatternContext(patterns) : "No pattern data yet.";
  const taskList   = formatTaskList(pending);
  const classes    = userProfile?.classes?.map(
    (c) => `${c.name} (${c.creditHours} credits, current grade: ${c.grade ?? "unknown"})`
  ).join(", ") ?? "Not specified";

  const prompt = `You are a smart academic coach. Based on everything you know about this student, tell them exactly ONE task to work on right now and why.

Today: ${today()}
Student's classes: ${classes}
Preferred work time: ${userProfile?.preferredWorkTime ?? "not set"}

Behavioral patterns (learned from their history):
${patternCtx}

Pending tasks:
${taskList}

Rules:
- Pick exactly ONE task. Do not hedge or list alternatives.
- Reference the task by its EXACT title as written above.
- If they have a pattern of leaving a certain class late, call it out by name.
- Be direct and confident. Max 1 sentence for recommendation.

Respond ONLY with this JSON, no markdown, no explanation:
{
  "taskId": "the_exact_task_id_from_list",
  "recommendation": "One confident sentence using the exact task title (e.g. 'Start your HIST 201 essay — it\\'s due in 2 days and you always leave history late.')",
  "reasoning": "2-3 sentences max explaining why, referencing their actual patterns and deadlines."
}`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  300,
    });
    return safeParseJSON(response.choices[0].message.content.trim());
  } catch (err) {
    console.error("getWhatDoIDo failed:", err);
    throw new Error("Couldn't get recommendation. Check your connection and try again.");
  }
};

// ── 2. Weekly Plan (hallucination-resistant) ─────────────────

export const getWeeklyPlan = async (tasks, userProfile, patterns) => {
  const pending       = tasks.filter((t) => !t.completed);
  const patternCtx    = patterns ? buildPatternContext(patterns) : "No pattern data yet.";
  const taskList      = formatTaskList(pending);
  const classes       = userProfile?.classes?.map(
    (c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade ?? "?"})`
  ).join("\n  ") ?? "Not specified";
  const preferredTime = userProfile?.preferredWorkTime ?? "not specified";

  // Build exact task title list for the constraint section
  const exactTitles = pending.slice(0, APP_CONFIG.maxTasksForAI)
    .map((t) => `"${t.title}"`).join(", ");

  const prompt = `You are an academic planner. Build a realistic 7-day study plan for a college student.

TODAY: ${today()}
PREFERRED STUDY TIME: ${preferredTime}

CLASSES:
  ${classes}

BEHAVIORAL PATTERNS:
${patternCtx}

TASKS TO SCHEDULE:
${taskList}

STRICT RULES — READ CAREFULLY:
1. Each day's task list must contain ONLY exact task titles from this list: ${exactTitles}
2. NEVER invent chapter numbers, page numbers, reading assignments, or subtasks.
3. NEVER suggest tasks not in the list above. Do not say "review notes", "study chapter X", etc.
4. If a task has a due date, schedule it on or before that date.
5. Front-load tasks for classes where the student has a late pattern.
6. Schedule tasks during their preferred study time window where possible.
7. Maximum 3 tasks per day — realistic, not optimistic.
8. If no tasks fit a day naturally, leave it as a rest day (empty tasks array).
9. The "note" field for each day should be a brief coach tip referencing real data (e.g. their lateness pattern), not generic advice.

Respond ONLY with this JSON (no markdown, no extra text):
{
  "headline": "One encouraging sentence about their week (specific, not generic)",
  "keyInsight": "One behavioral insight from their patterns referencing a specific class or habit",
  "days": [
    {
      "day": "Monday",
      "date": "Feb 24",
      "tasks": ["exact task title from list", "another exact title"],
      "note": "Optional short coach tip for this specific day"
    }
  ],
  "warnings": ["Any overdue or at-risk items with specific due dates"]
}`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  1200,
    });

    const result = safeParseJSON(response.choices[0].message.content.trim());

    // Post-process: validate that all task titles in plan actually exist
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
    throw new Error("Couldn't generate weekly plan.");
  }
};

// ── 3. Avoidance Alert Message ───────────────────────────────

export const getAvoidanceAlert = async (task, patternForClass) => {
  const daysAvoided   = task.daysSinceTouched ?? 3;
  const daysUntilDue  = task.dueDate
    ? Math.round((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const classPattern  = patternForClass?.tendencyLabel ?? "unknown";

  const prompt = `Write a short, friendly push notification (max 20 words) for a student who has been avoiding a task.

Task: "${task.title}"
Days avoided: ${daysAvoided}
Days until due: ${daysUntilDue ?? "unknown"}
Their pattern with this class: ${classPattern}

Make it feel like a smart coach, not a nagging alarm. Reference the specific task. No emojis.
Reply with ONLY the notification text, nothing else.`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens:  60,
    });
    return response.choices[0].message.content.trim().replace(/^"|"$/g, "");
  } catch {
    return `"${task.title}" is still waiting — ${daysUntilDue ? `due in ${daysUntilDue} days` : "no deadline set"}.`;
  }
};

// ── 4. Daily Summary ─────────────────────────────────────────

export const summarizeTasks = async (tasks, patterns) => {
  if (!tasks || tasks.length === 0) {
    return "No tasks yet — add some to get started!";
  }

  const pending      = tasks.filter((t) => !t.completed);
  const highPriority = pending.filter((t) => t.priority === "HIGH" || t.aiPriority === "HIGH");
  const patternCtx   = patterns ? buildPatternContext(patterns) : "";

  const prompt = `You are a friendly productivity coach. Give a brief, personalized daily summary for a college student.

Stats: ${pending.length} pending, ${highPriority.length} high-priority.
${patternCtx ? `\nBehavioral patterns:\n${patternCtx}` : ""}

Pending tasks:
${formatTaskList(pending)}

Write 2-3 sentences max. Be specific and encouraging. Reference actual task titles where possible. If they have avoidance patterns with specific classes, gently acknowledge them by class name.`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens:  150,
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error("summarizeTasks failed:", err);
    return `You have ${pending.length} tasks pending. You've got this!`;
  }
};

// ── 5. AI Priority Suggestion ────────────────────────────────

export const suggestPriorities = async (tasks, patterns) => {
  if (!tasks || tasks.length === 0) return [];

  const patternCtx = patterns ? buildPatternContext(patterns) : "";
  const taskList   = formatTaskList(tasks);

  const prompt = `You are a productivity assistant. Assign each task a priority based on urgency, due dates, and student behavioral patterns.

Today: ${today()}
${patternCtx ? `\nUser patterns:\n${patternCtx}` : ""}

Tasks:
${taskList}

Rules:
- HIGH: Due within 2 days, or student historically struggles with this class
- MEDIUM: Due within a week, or moderate importance
- LOW: No deadline, or low stakes

Return ONLY a JSON array, no markdown:
[{"id":"task_id","aiPriority":"HIGH","aiReason":"Max 12 words explaining why"}]`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  800,
    });

    const data = safeParseJSON(response.choices[0].message.content.trim(), "array");

    return tasks.map((task) => {
      const s = data.find((p) => p.id === task.id);
      return s ? { ...task, aiPriority: s.aiPriority, aiReason: s.aiReason } : task;
    });
  } catch (err) {
    console.error("suggestPriorities failed:", err);
    throw new Error("Failed to get AI suggestions.");
  }
};