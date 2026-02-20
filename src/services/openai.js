// ============================================================
// services/openai.js
// Handles all OpenAI GPT API calls.
// Two main features:
//   1. suggestPriorities() — AI ranks your tasks by urgency
//   2. summarizeTasks()    — AI gives a daily briefing
// ============================================================

import OpenAI from "openai";
import { OPENAI_API_KEY, APP_CONFIG } from "../config";

// Initialize the OpenAI client
const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  // Required for React Native — disables the Node.js HTTP agent
  dangerouslyAllowBrowser: true,
});

/**
 * Ask GPT-4 to suggest priorities for a list of tasks.
 * Returns an array of tasks sorted by AI-suggested priority,
 * each with an added `aiPriority` field ("HIGH" | "MEDIUM" | "LOW")
 * and `aiReason` explaining why.
 *
 * @param {Array} tasks - Array of task objects from Firestore
 * @returns {Promise<Array>} - Tasks with AI priority annotations
 */
export const suggestPriorities = async (tasks) => {
  if (!tasks || tasks.length === 0) return [];

  // Limit to avoid excessive token usage
  const tasksToAnalyze = tasks.slice(0, APP_CONFIG.maxTasksForAI);

  // Build a clean task list for the prompt
  const taskList = tasksToAnalyze
    .map((t, i) => {
      const due = t.dueDate
        ? `Due: ${new Date(t.dueDate).toLocaleDateString()}`
        : "No due date";
      return `${i + 1}. [ID:${t.id}] "${t.title}" — ${due} — Current priority: ${t.priority || "none"} — ${t.description || "No description"}`;
    })
    .join("\n");

  const prompt = `You are a productivity assistant. Analyze these tasks and assign each a priority level.

Tasks:
${taskList}

Today's date: ${new Date().toLocaleDateString()}

Return ONLY a JSON array in this exact format, no other text:
[
  {
    "id": "task_id_here",
    "aiPriority": "HIGH",
    "aiReason": "Brief reason (max 15 words)"
  }
]

Priority rules:
- HIGH: Due soon (within 2 days), blocking others, or critical impact
- MEDIUM: Due within a week, moderate importance  
- LOW: No deadline, nice-to-have, or can wait`;

  try {
    const response = await client.chat.completions.create({
      model: APP_CONFIG.gptModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // Low temp = more consistent/logical responses
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content.trim();
    // Extract JSON array even if GPT adds text before/after it
    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) throw new Error('No JSON array found in GPT response');
    const priorityData = JSON.parse(jsonMatch[0]);

    // Merge AI suggestions back into the original task objects
    return tasksToAnalyze.map((task) => {
      const suggestion = priorityData.find((p) => p.id === task.id);
      return suggestion
        ? { ...task, aiPriority: suggestion.aiPriority, aiReason: suggestion.aiReason }
        : task;
    });
  } catch (error) {
    console.error("OpenAI priority suggestion failed:", error);
    throw new Error(
      "Failed to get AI suggestions. Check your OpenAI API key and try again."
    );
  }
};

/**
 * Generate a friendly daily summary of all tasks.
 * Returns a short paragraph the user sees on their dashboard.
 *
 * @param {Array} tasks - All user tasks
 * @returns {Promise<string>} - Natural language summary
 */
export const summarizeTasks = async (tasks) => {
  if (!tasks || tasks.length === 0) {
    return "You have no tasks yet. Add some tasks to get started!";
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const highPriority = pending.filter((t) => t.priority === "HIGH" || t.aiPriority === "HIGH");

  const taskSummary = pending
    .slice(0, APP_CONFIG.maxTasksForAI)
    .map((t) => `- "${t.title}" (${t.priority || "no priority"})`)
    .join("\n");

  const prompt = `You are a friendly productivity coach. Give a brief, motivating daily summary.

Stats:
- ${pending.length} pending tasks
- ${completed.length} completed today
- ${highPriority.length} high priority items

Pending tasks:
${taskSummary}

Write 2-3 sentences max. Be encouraging and specific. Mention the most important task if there are high-priority items.`;

  try {
    const response = await client.chat.completions.create({
      model: APP_CONFIG.gptModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI summary failed:", error);
    return `You have ${pending.length} pending tasks. Keep going!`;
  }
};