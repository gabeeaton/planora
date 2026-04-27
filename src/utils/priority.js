import { differenceInCalendarDays, startOfToday } from "date-fns";

const safeDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Returns the priority to display.
// If the AI has set a priority, trust it — it accounts for assignment type.
// Only fall back to date-based rules when no AI priority exists (e.g. ICS imports).
export const getEffectivePriority = (task) => {
  if (task.aiPriority) return task.aiPriority;
  if (task.priority) return task.priority;
  if (!task.dueDate || task.completed) return "MEDIUM";
  const due = safeDate(task.dueDate);
  if (!due) return "MEDIUM";
  const daysUntil = differenceInCalendarDays(due, startOfToday());
  if (daysUntil <= 1) return "HIGH";
  if (daysUntil <= 7) return "MEDIUM";
  return "LOW";
};

// True if the stored AI priority is likely stale — the due date has crossed
// a tier boundary since it was assigned, warranting a background re-rank.
export const isPriorityStale = (task) => {
  const stored = task.aiPriority;
  if (!stored || !task.dueDate || task.completed) return false;
  const due = safeDate(task.dueDate);
  if (!due) return false;
  const daysUntil = differenceInCalendarDays(due, startOfToday());
  if (daysUntil < 0 && stored !== "HIGH") return true;  // overdue, not HIGH
  if (daysUntil <= 1 && stored === "LOW") return true;   // due today/tomorrow, stored LOW
  if (daysUntil <= 7 && stored === "LOW") return true;   // due this week, stored LOW
  return false;
};
