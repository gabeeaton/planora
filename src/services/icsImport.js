// ============================================================
// src/services/icsImport.js
// FIXED: Priority calculation now considers distance from due date
// ============================================================

const unfold  = (raw) => raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const unescape = (str) =>
  str.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();

const parseIcsDate = (raw) => {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{8}$/.test(s)) {
    const [y, mo, d] = [s.slice(0,4), s.slice(4,6), s.slice(6,8)];
    return new Date(`${y}-${mo}-${d}T23:59:00`);
  }
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/i);
  if (m) {
    const [,y,mo,d,h,min,sec,utc] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${min}:${sec}${utc ? "Z" : ""}`);
  }
  const fallback = new Date(raw);
  return isNaN(fallback) ? null : fallback;
};

/**
 * Priority calculation — exams far in the future should NOT be HIGH.
 * HIGH   = due within 7 days, OR exam/test/quiz within 14 days
 * MEDIUM = due within 30 days, OR exam/test within 60 days
 * LOW    = everything else (finals 2+ months away = LOW)
 */
const inferPriority = (summary = "", dueDate) => {
  const isExamType = /exam|final|midterm|test|quiz/i.test(summary);

  if (!dueDate) return "MEDIUM";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysOut = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

  if (daysOut < 0)  return "LOW";
  if (daysOut <= 7) return "HIGH";

  if (isExamType) {
    if (daysOut <= 14) return "HIGH";
    if (daysOut <= 60) return "MEDIUM";
    return "LOW"; // final exam 3 months out = LOW until it gets closer
  }

  if (daysOut <= 30) return "MEDIUM";
  return "LOW";
};

const extractValue = (line) => {
  const i = line.indexOf(":"); return i === -1 ? "" : line.slice(i + 1);
};
const extractKey = (line) => {
  const i = line.indexOf(":"); return (i === -1 ? line : line.slice(0, i)).split(";")[0].toUpperCase();
};

const cleanTitle = (raw) => {
  let title = raw.trim();
  title = title.replace(/\s*\[[A-Z]{2,6}\d{3}[^\]]*\]\s*$/i, "").trim();
  title = title.replace(/^\s*\[[A-Z]{2,6}\d{3}[^\]]*\]\s*/i, "").trim();
  return title || raw.trim();
};

const extractClassName = (code) => {
  if (!code) return null;
  const m = code.match(/([A-Z]{2,6})\s*(\d{3,4})/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return null;
};

const formatDueTime = (date) => {
  const h = date.getHours(), min = date.getMinutes();
  if ((h === 0 && min === 0) || (h === 23 && min === 59)) return null;
  return [h, min];
};

export const parseIcsText = (icsText) => {
  const text  = unfold(icsText);
  const lines = text.split("\n");
  const tasks = [];
  const now   = new Date(); 
  now.setHours(0, 0, 0, 0);

  let inEvent = false, current = {};

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const key  = extractKey(line);
    const val  = extractValue(line);

    if (key === "BEGIN" && val === "VEVENT") { inEvent = true; current = {}; continue; }
    if (key === "END"   && val === "VEVENT") {
      inEvent = false;

      const rawSummary  = unescape(current.SUMMARY    ?? "");
      const categories  = unescape(current.CATEGORIES ?? "");

      if (!rawSummary) continue;

      const dueDate = parseIcsDate(current.DTSTART);
      if (dueDate && dueDate < now) continue;

      const title = cleanTitle(rawSummary);

      let className = null;
      const bracketMatch = rawSummary.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        className = extractClassName(bracketMatch[1]) ?? (categories.split(",")[0].trim() || null);
      } else if (categories) {
        className = extractClassName(categories) ?? (categories.split(",")[0].trim() || null);
      }

      tasks.push({
        title,
        rawTitle:    rawSummary,
        description: null,
        dueDate,
        dueTime:     dueDate ? formatDueTime(dueDate) : null,
        priority:    inferPriority(rawSummary, dueDate),
        className,
        icsUid:      current.UID ?? null,
        needsReview: true,
      });
      continue;
    }

    if (inEvent && key && val !== undefined) {
      current[key] = current[key] ? current[key] + " " + val : val;
    }
  }

  const seen = new Set();
  const dedup = tasks.filter((t) => {
    const k = t.icsUid ?? `${t.title}__${t.dueDate?.toISOString() ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  return dedup.sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate - b.dueDate;
  });
};

export const isValidIcs  = (text) => text.includes("BEGIN:VCALENDAR") && text.includes("BEGIN:VEVENT");
export const countIcsEvents = (text) => (text.match(/BEGIN:VEVENT/g) ?? []).length;