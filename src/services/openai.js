// ============================================================
// src/services/openai.js
// All OpenAI calls. Every function is personalized using:
//   - The user's full task list
//   - Their academic profile (classes, grades)
//   - Behavioral patterns from patternAnalysis.js
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

// ── 1. What Do I Do Right Now? ───────────────────────────────

/**
 * THE core feature. Returns a single, confident recommendation
 * for what the user should work on right now.
 * Only possible because we have their full context.
 */
export const getWhatDoIDo = async (tasks, userProfile, patterns) => {
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return {
    recommendation: "You have no pending tasks! Enjoy the moment or add something new.",
    reasoning: null,
    taskId: null,
  };

  const patternCtx  = buildPatternContext(patterns);
  const taskList    = formatTaskList(pending);
  const classes     = userProfile?.classes?.map(
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

Give a direct, confident recommendation. Do not hedge. Do not list multiple options. Pick ONE.

Respond ONLY with this JSON, no other text:
{
  "taskId": "the_task_id",
  "recommendation": "One punchy sentence telling them what to do (e.g. 'Start your HIST 201 essay — it's due in 2 days and you always leave history late.')",
  "reasoning": "2-3 sentences max explaining why this task, referencing their actual patterns and deadlines."
}`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  300,
    });

    const raw   = response.choices[0].message.content.trim();
    const match = raw.match(/\{.*\}/s);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("getWhatDoIDo failed:", err);
    throw new Error("Couldn't get recommendation. Check your connection and try again.");
  }
};

// ── 2. Weekly Plan ───────────────────────────────────────────

/**
 * Generates a full day-by-day plan for the next 7 days.
 * Shown on the WeeklyBriefingScreen (Pro feature).
 */
export const getWeeklyPlan = async (tasks, userProfile, patterns) => {
  const pending     = tasks.filter((t) => !t.completed);
  const patternCtx  = buildPatternContext(patterns);
  const taskList    = formatTaskList(pending);
  const classes     = userProfile?.classes?.map(
    (c) => `${c.name} (${c.creditHours} credits, grade: ${c.grade ?? "?"})`
  ).join("\n  ") ?? "Not specified";
  const preferredTime = userProfile?.preferredWorkTime ?? "not specified";

  const prompt = `You are an academic coach building a realistic week plan for a college student.

Today: ${today()}
Preferred study time: ${preferredTime}

Classes:
  ${classes}

Behavioral patterns:
${patternCtx}

Pending tasks:
${taskList}

Create a realistic day-by-day plan for the next 7 days. Account for their patterns — if they tend to be late on a certain class, front-load those tasks.

Respond ONLY with this JSON:
{
  "headline": "One encouraging sentence about their week",
  "keyInsight": "One behavioral insight from their patterns (e.g. 'You tend to leave HIST work until the last day — this plan front-loads it.')",
  "days": [
    {
      "day": "Monday",
      "date": "Feb 24",
      "tasks": ["task title 1", "task title 2"],
      "note": "Optional short note for this day"
    }
  ],
  "warnings": ["Any overdue or at-risk items the student should know about"]
}`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens:  1200,
    });

    const raw   = response.choices[0].message.content.trim();
    const match = raw.match(/\{.*\}/s);
    if (!match) throw new Error("No JSON in response");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("getWeeklyPlan failed:", err);
    throw new Error("Couldn't generate weekly plan.");
  }
};

// ── 3. Avoidance Alert Message ───────────────────────────────

/**
 * Generates a personalized, non-naggy push notification message
 * for a task the user has been avoiding.
 */
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
  } catch (err) {
    return `"${task.title}" is still waiting — ${daysUntilDue ? `due in ${daysUntilDue} days` : "no deadline set"}.`;
  }
};

// ── 4. Daily Summary (updated with pattern context) ──────────

export const summarizeTasks = async (tasks, patterns) => {
  if (!tasks || tasks.length === 0) {
    return "No tasks yet — add some to get started!";
  }

  const pending      = tasks.filter((t) => !t.completed);
  const highPriority = pending.filter((t) => t.priority === "HIGH" || t.aiPriority === "HIGH");
  const patternCtx   = patterns ? buildPatternContext(patterns) : "";

  const prompt = `You are a friendly productivity coach. Give a brief, personalized daily summary for a college student.

Stats: ${pending.length} pending, ${highPriority.length} high-priority.
${patternCtx ? `\nPatterns:\n${patternCtx}` : ""}

Pending tasks:
${formatTaskList(pending)}

Write 2-3 sentences max. Be specific and encouraging. If they have avoidance patterns, gently acknowledge them.`;

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

// ── 5. AI Priority Suggestion (updated) ─────────────────────

export const suggestPriorities = async (tasks, patterns) => {
  if (!tasks || tasks.length === 0) return [];

  const patternCtx = patterns ? buildPatternContext(patterns) : "";
  const taskList   = formatTaskList(tasks);

  const prompt = `You are a productivity assistant. Assign each task a priority.

Today: ${today()}
${patternCtx ? `\nUser patterns:\n${patternCtx}` : ""}

Tasks:
${taskList}

Rules:
- HIGH: Due within 2 days, or user historically struggles with this class
- MEDIUM: Due within a week, moderate importance
- LOW: No deadline or low stakes

Return ONLY a JSON array:
[{"id":"task_id","aiPriority":"HIGH","aiReason":"Max 12 words"}]`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  800,
    });

    const raw   = response.choices[0].message.content.trim();
    const match = raw.match(/\[.*\]/s);
    if (!match) throw new Error("No JSON array");
    const data = JSON.parse(match[0]);

    return tasks.map((task) => {
      const s = data.find((p) => p.id === task.id);
      return s ? { ...task, aiPriority: s.aiPriority, aiReason: s.aiReason } : task;
    });
  } catch (err) {
    console.error("suggestPriorities failed:", err);
    throw new Error("Failed to get AI suggestions.");
  }
};