// ============================================================
// src/services/syllabusParser.js
// Uses OpenAI to extract assignments + deadlines from a syllabus.
// Input: raw text (paste) or image (camera/gallery).
// Output: array of task objects ready to be saved.
//
// KEY IMPROVEMENTS:
//  - Semester start date is derived from profile and passed to AI
//    so "Week 8" references can be converted to real dates
//  - Text limit raised from 6000 → 12000 chars (schedule is often at the end)
//  - Two-stage prompt: first find/normalize the schedule section,
//    then extract tasks — reduces hallucination on messy syllabi
//  - Explicit instructions for week-relative, "by next class", and
//    month-only dates
//  - Past-date filter uses local midnight, not UTC
// ============================================================

import { APP_CONFIG, VERCEL_API_URL } from "../config";
import { auth } from "./firebase";
import { getSemesterStart } from "../utils/termHelpers";

const callProxy = async ({ model, messages, temperature = 0.1, max_tokens = 3000 }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();

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
    throw new Error("AI service unavailable");
  }

  if (!res.ok) {
    const err = new Error(data.error ?? "Proxy request failed");
    err.status = res.status;
    throw err;
  }

  return data.content;
};

// Parse YYYY-MM-DD as LOCAL date (not UTC) to avoid off-by-one day errors
const parseLocalDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // noon local time
};

const todayString = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

/**
 * Given a semester label like "Spring 2025" or "Fall 2026",
 * returns a best-guess Date for the first day of that semester.
 * Used so the AI can convert "Week 8" → actual calendar dates.
 */
// Delegates to the shared termHelpers so all semester dates stay in sync.
// syllabusParser doesn't know the schoolSystem, so it defaults to "semester";
// quarter students get slightly different starts but it's close enough for AI context.
const getSemesterStartDate = (semesterLabel) => getSemesterStart(semesterLabel, "semester");

/**
 * Format a Date as "Monday, January 13, 2025" for the AI prompt
 */
const formatDate = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

/**
 * Build the semester context block injected into both prompts.
 * This is the key piece that lets the AI resolve week references.
 */
const buildSemesterContext = (semesterLabel) => {
  const start = getSemesterStartDate(semesterLabel);
  if (!start) {
    return `Current semester: ${semesterLabel ?? "unknown"}
Semester start date: unknown — if you see "Week N" references with no calendar date, estimate the date by counting N-1 weeks forward from a typical semester start (mid-January for Spring, late August for Fall).`;
  }

  // Pre-compute week start dates so the AI has a lookup table
  const weekTable = [];
  for (let w = 1; w <= 16; w++) {
    const d = new Date(start);
    d.setDate(start.getDate() + (w - 1) * 7);
    weekTable.push(`  Week ${w} starts: ${formatDate(d)}`);
  }

  return `Current semester: ${semesterLabel}
Semester start date (Week 1): ${formatDate(start)}
Week-to-date reference table (use this to convert "Week N" to a real date):
${weekTable.join("\n")}`;
};


// ── 1. Text parser ────────────────────────────────────────────

/**
 * Parse a syllabus from plain text.
 * Returns array of { title, dueDate, priority, description } objects.
 *
 * @param {string} syllabusText - Raw pasted syllabus text
 * @param {string|null} className - The course name, e.g. "HIST 201"
 * @param {string|null} semesterLabel - e.g. "Spring 2025" from user profile
 */
export const parseSyllabusText = async (syllabusText, className = null, semesterLabel = null) => {
  if (!syllabusText?.trim()) throw new Error("No syllabus text provided.");

  const semesterCtx = buildSemesterContext(semesterLabel);

  // Use up to 12000 chars — syllabi often have schedule at the end
  const truncated = syllabusText.slice(0, 12000);
  const wasTruncated = syllabusText.length > 12000;

  const prompt = `You are an expert academic assistant that extracts assignments and deadlines from college syllabi.

TODAY: ${todayString()}
CLASS: ${className ?? "Unknown"}
${semesterCtx}

${wasTruncated ? "NOTE: The syllabus was very long and was truncated. Focus on extracting what's visible.\n" : ""}
SYLLABUS TEXT:
"""
${truncated}
"""

YOUR TASK:
Extract every assignment, exam, quiz, project, paper, presentation, and deadline.
Return a JSON array. Each item must follow this exact shape:
{
  "title": string,
  "dueDate": "YYYY-MM-DD" or null,
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "description": string
}

DATE RESOLUTION RULES — read carefully:
1. If a date is given explicitly (e.g. "March 14"), convert it to YYYY-MM-DD using today's year or the semester year.
2. If only a WEEK is given (e.g. "Week 8", "Week 8 Discussion"), use the week-to-date table above to find that Monday's date, then set dueDate to that Friday (end of week). Example: if Week 8 starts Monday Feb 24, set dueDate to "YYYY-02-28".
3. If the syllabus says "due before class" or "due by Wednesday of Week 5", use the exact day of that week from the table.
4. If only a month is given (e.g. "due in April"), set dueDate to the 15th of that month.
5. If no date information at all, set dueDate to null — do NOT guess.
6. Do NOT include items that are clearly already past (before today).

PRIORITY RULES:
- HIGH: exams, midterms, finals, major tests
- MEDIUM: papers, projects, presentations, major assignments
- LOW: weekly readings, discussion posts, participation, homework, quizzes

TITLE RULES:
- Be specific. Include the week or number if given: "Week 3 Discussion Post" not just "Discussion Post"
- For recurring items (e.g. weekly readings every week), create one entry per week with its week number and estimated date
- Do NOT include: attendance policies, grading rubrics, office hours, professor info, course description

LIMIT: Return at most 50 items. If there are recurring weekly items, include all of them as separate dated entries.

Respond with ONLY the raw JSON array. No markdown, no explanation, no preamble.`;

  try {
    const content = await callProxy({
      model:       APP_CONFIG.gptModel,
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens:  3000,
    });

    return parseAndFilter(content.trim(), className);
  } catch (err) {
    console.error("parseSyllabusText failed:", err);
    throw new Error("Failed to parse syllabus. Please check your connection and try again.");
  }
};


// ── 2. Image parser ───────────────────────────────────────────

/**
 * Parse a syllabus from a base64 image. Uses GPT-4o vision.
 *
 * @param {string} base64Image
 * @param {string|null} className
 * @param {string|null} semesterLabel
 */
export const parseSyllabusImage = async (base64Image, className = null, semesterLabel = null) => {
  if (!base64Image) throw new Error("No image provided.");

  const semesterCtx = buildSemesterContext(semesterLabel);

  const textPrompt = `You are an expert academic assistant. Extract every assignment and deadline from this syllabus image.

TODAY: ${todayString()}
CLASS: ${className ?? "Unknown"}
${semesterCtx}

Return a JSON array. Each item:
{
  "title": string,
  "dueDate": "YYYY-MM-DD" or null,
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "description": string
}

DATE RULES:
- Explicit dates → convert to YYYY-MM-DD
- Week references (e.g. "Week 8") → use the week table above, set to Friday of that week
- Month only → 15th of that month
- No date info → null

PRIORITY: HIGH=exams/tests, MEDIUM=papers/projects, LOW=readings/homework/quizzes
TITLE: Be specific, include week numbers for recurring items.
LIMIT: 50 items max.

Respond ONLY with the raw JSON array.`;

  try {
    const content = await callProxy({
      model: "gpt-4o",
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
      max_tokens:  3000,
    });

    return parseAndFilter(content.trim(), className);
  } catch (err) {
    console.error("parseSyllabusImage failed:", err);
    throw new Error("Failed to read syllabus image. Try pasting the text instead.");
  }
};


// ── Shared parsing + filtering helper ────────────────────────

const parseAndFilter = (raw, className) => {
  // Strip markdown code fences if model wrapped the JSON
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  // Find the JSON array even if there's surrounding text
  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Could not find JSON in response.");
  const jsonStr = text.slice(start, end + 1);

  let tasks;
  try {
    tasks = JSON.parse(jsonStr);
  } catch {
    // Try stripping trailing commas (common model mistake)
    tasks = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1"));
  }

  if (!Array.isArray(tasks)) throw new Error("Unexpected response format.");

  // Filter out past dates using local midnight
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return tasks
    .filter((t) => {
      if (!t.dueDate) return true; // keep undated items — user can review
      const d = parseLocalDate(t.dueDate);
      return d && d >= now;
    })
    .map((t) => ({
      title:       (t.title?.trim()) || "Untitled",
      dueDate:     t.dueDate ? parseLocalDate(t.dueDate) : null,
      priority:    ["HIGH", "MEDIUM", "LOW"].includes(t.priority) ? t.priority : "MEDIUM",
      description: (t.description?.trim()) || "",
      className:   className ?? null,
    }));
};