// ============================================================
// src/services/icsImport.js
// Parses .ics (iCalendar) files exported from Canvas, Google
// Calendar, Apple Calendar, Outlook — any calendar app.
//
// How students export from Canvas:
//   Canvas → Calendar → (top-right) Calendar Feed → Copy link
//   → paste in browser → save as .ics   (or subscribe link works too)
//   Alternatively: Canvas → Dashboard → "View Calendar" → export
//
// No native modules. No API keys. Pure JS — works in Expo Go.
// ============================================================

// ── ICS text unfolding (RFC 5545: long lines wrap with CRLF + whitespace) ──
const unfold = (raw) =>
  raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

// ── Decode escaped chars (\, \; \, \n) ────────────────────────
const unescape = (str) =>
  str
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();

// ── Parse ICS datetime string → JS Date ───────────────────────
// Handles: 20260315T235900Z  20260315T235900  20260315 (date-only)
const parseIcsDate = (raw) => {
  if (!raw) return null;
  const s = raw.replace(/[ZTz]/g, (m) => (m.toUpperCase() === "T" ? "T" : "Z")).trim();

  // Date-only: 20260315
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
    return new Date(`${y}-${mo}-${d}T23:59:00`);
  }

  // DateTime: 20260315T235900Z or 20260315T235900
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, y, mo, d, h, min, sec, utc] = m;
    const iso = `${y}-${mo}-${d}T${h}:${min}:${sec}${utc ? "Z" : ""}`;
    return new Date(iso);
  }

  // Fallback
  const fallback = new Date(raw);
  return isNaN(fallback) ? null : fallback;
};

// ── Priority inference from title + categories ─────────────────
const inferPriority = (summary = "", categories = "") => {
  const t = (summary + " " + categories).toLowerCase();
  if (/exam|final|midterm|test|quiz/.test(t))           return "HIGH";
  if (/project|paper|essay|presentation|report/.test(t)) return "MEDIUM";
  return "LOW";
};

// ── Strip HTML from Canvas descriptions ───────────────────────
const stripHtml = (str) =>
  str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

// ── Extract a property value, handling param syntax ───────────
// e.g. "DTSTART;TZID=America/New_York:20260315T120000" → "20260315T120000"
const extractValue = (line) => {
  const colonIdx = line.indexOf(":");
  return colonIdx === -1 ? "" : line.slice(colonIdx + 1);
};

const extractKey = (line) => {
  const colonIdx = line.indexOf(":");
  const raw = colonIdx === -1 ? line : line.slice(0, colonIdx);
  return raw.split(";")[0].toUpperCase();
};

// ── Main parser ───────────────────────────────────────────────
/**
 * Parse raw .ics text into TaskFlow-compatible task objects.
 * Filters to future events only (past events are ignored).
 *
 * @param {string} icsText - raw content of a .ics file
 * @returns {Array} tasks ready for createManyTasks()
 */
export const parseIcsText = (icsText) => {
  const text   = unfold(icsText);
  const lines  = text.split("\n");
  const tasks  = [];
  const now    = new Date();
  now.setHours(0, 0, 0, 0);

  let inEvent  = false;
  let current  = {};

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const key  = extractKey(line);
    const val  = extractValue(line);

    if (key === "BEGIN" && val === "VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (key === "END" && val === "VEVENT") {
      inEvent = false;

      const summary     = unescape(current.SUMMARY     ?? "");
      const description = unescape(current.DESCRIPTION ?? "");
      const categories  = unescape(current.CATEGORIES  ?? "");
      const location    = unescape(current.LOCATION    ?? "");

      // Canvas stores course name in CATEGORIES or in the SUMMARY prefix
      // e.g. "CATEGORIES:CS101 - Intro to CS" or "SUMMARY:[CS101] Essay Due"
      let className = null;
      if (categories) {
        className = categories.split(",")[0].trim() || null;
      }
      // Try to extract [Course Name] from summary like "[MATH 201] Homework 3"
      if (!className) {
        const bracketMatch = summary.match(/^\[([^\]]+)\]/);
        if (bracketMatch) className = bracketMatch[1].trim();
      }

      // Clean title: remove the [Course] prefix if we extracted it
      const title = className
        ? summary.replace(/^\[[^\]]+\]\s*/, "").trim() || summary
        : summary;

      if (!title) { continue; } // skip events with no title

      const dueDate = parseIcsDate(current.DTSTART);

      // Skip past events (unless undated)
      if (dueDate && dueDate < now) continue;

      // Skip all-day non-assignment events (class sessions, etc.)
      // Heuristic: if CATEGORIES is empty AND title looks like a class session → skip
      // (We keep undated events in case they're assignments without a due date)

      const cleanDesc = description ? stripHtml(description) : (location || null);

      tasks.push({
        title:       title.slice(0, 120),
        description: cleanDesc?.slice(0, 200) ?? null,
        dueDate,
        dueTime:     dueDate ? formatDueTime(dueDate) : null,
        priority:    inferPriority(title, categories),
        className,
        icsUid:      current.UID ?? null, // for deduplication
      });

      continue;
    }

    if (inEvent) {
      // Accumulate — handle multi-value and continuation
      if (key && val !== undefined) {
        // For DESCRIPTION, accumulate (long descriptions span multiple lines after unfold)
        if (current[key]) {
          current[key] += " " + val;
        } else {
          current[key] = val;
        }
      }
    }
  }

  // Deduplicate by icsUid (same assignment from multiple calendar feeds)
  const seen  = new Set();
  const dedup = tasks.filter((t) => {
    const k = t.icsUid ?? `${t.title}__${t.dueDate?.toISOString() ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Sort by due date ascending, undated at end
  return dedup.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate - b.dueDate;
  });
};

// ── Format time string from Date for dueTime field ────────────
const formatDueTime = (date) => {
  const h   = date.getHours();
  const min = date.getMinutes();
  // If exactly midnight or 11:59pm it's probably a date-only deadline
  if ((h === 0 && min === 0) || (h === 23 && min === 59)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const h12    = h % 12 || 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
};

// ── Validate that a string looks like a real .ics file ─────────
export const isValidIcs = (text) =>
  text.includes("BEGIN:VCALENDAR") && text.includes("BEGIN:VEVENT");

// ── Count events in an ICS file (for user feedback) ───────────
export const countIcsEvents = (text) =>
  (text.match(/BEGIN:VEVENT/g) ?? []).length;