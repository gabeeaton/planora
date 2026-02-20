// ============================================================
// src/services/syllabusParser.js
// Uses OpenAI to extract assignments + deadlines from a syllabus.
// Input: raw text (paste) or image (camera/gallery).
// Output: array of task objects ready to be saved.
// ============================================================

import OpenAI from "openai";
import { OPENAI_API_KEY, APP_CONFIG } from "../config";

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const today = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

/**
 * Parse a syllabus from plain text.
 * Returns array of { title, dueDate, priority, description } objects.
 */
export const parseSyllabusText = async (syllabusText, className = null) => {
  if (!syllabusText?.trim()) throw new Error("No syllabus text provided.");

  const prompt = `You are an academic assistant. Extract every assignment, exam, quiz, project, and deadline from this syllabus.

Today's date: ${today()}
Class name: ${className ?? "Unknown"}

Syllabus text:
"""
${syllabusText.slice(0, 6000)}
"""

Rules:
- Only include items with actionable deadlines (not general policies, grading rubrics, etc.)
- For exams/midterms/finals, set priority HIGH
- For weekly assignments/readings, set priority LOW
- For projects/papers, set priority MEDIUM
- Convert all dates to ISO format (YYYY-MM-DD). If no year, assume current semester.
- Skip items that are clearly in the past (before today)
- Max 40 items

Respond ONLY with this JSON array, no other text:
[
  {
    "title": "Assignment name (be specific, include class if helpful)",
    "dueDate": "YYYY-MM-DD or null if no date",
    "priority": "HIGH | MEDIUM | LOW",
    "description": "Brief note from syllabus if helpful, else empty string"
  }
]`;

  try {
    const response = await client.chat.completions.create({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens:  2000,
    });

    const raw   = response.choices[0].message.content.trim();
    const match = raw.match(/\[.*\]/s);
    if (!match) throw new Error("Could not parse syllabus response.");
    const tasks = JSON.parse(match[0]);

    // Filter out past dates and normalize
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return tasks
      .filter((t) => {
        if (!t.dueDate) return true; // keep undated items
        const d = new Date(t.dueDate);
        return !isNaN(d) && d >= now;
      })
      .map((t) => ({
        title:       t.title?.trim() ?? "Untitled",
        dueDate:     t.dueDate ? new Date(t.dueDate) : null,
        priority:    ["HIGH","MEDIUM","LOW"].includes(t.priority) ? t.priority : "MEDIUM",
        description: t.description?.trim() ?? "",
        className:   className ?? null,
      }));
  } catch (err) {
    console.error("parseSyllabusText failed:", err);
    throw new Error("Failed to parse syllabus. Please check your connection and try again.");
  }
};

/**
 * Parse a syllabus from a base64 image (camera shot of physical syllabus).
 * Uses GPT-4o vision.
 */
export const parseSyllabusImage = async (base64Image, className = null) => {
  if (!base64Image) throw new Error("No image provided.");

  const textPrompt = `Extract every assignment, exam, quiz, project, and deadline visible in this syllabus image.

Today's date: ${today()}
Class name: ${className ?? "Unknown"}

Rules:
- Only include actionable items with deadlines
- HIGH priority: exams, midterms, finals
- MEDIUM priority: projects, papers, presentations  
- LOW priority: readings, weekly assignments, participation
- Convert dates to ISO format (YYYY-MM-DD). If no year, assume current semester.
- Skip items clearly in the past
- Max 40 items

Respond ONLY with JSON array:
[{"title":"...","dueDate":"YYYY-MM-DD or null","priority":"HIGH|MEDIUM|LOW","description":"..."}]`;

  try {
    const response = await client.chat.completions.create({
      model: APP_CONFIG.gptModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
            { type: "text", text: textPrompt },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens:  2000,
    });

    const raw   = response.choices[0].message.content.trim();
    const match = raw.match(/\[.*\]/s);
    if (!match) throw new Error("Could not parse image response.");
    const tasks = JSON.parse(match[0]);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return tasks
      .filter((t) => {
        if (!t.dueDate) return true;
        const d = new Date(t.dueDate);
        return !isNaN(d) && d >= now;
      })
      .map((t) => ({
        title:       t.title?.trim() ?? "Untitled",
        dueDate:     t.dueDate ? new Date(t.dueDate) : null,
        priority:    ["HIGH","MEDIUM","LOW"].includes(t.priority) ? t.priority : "MEDIUM",
        description: t.description?.trim() ?? "",
        className:   className ?? null,
      }));
  } catch (err) {
    console.error("parseSyllabusImage failed:", err);
    throw new Error("Failed to read syllabus image. Try pasting the text instead.");
  }
};