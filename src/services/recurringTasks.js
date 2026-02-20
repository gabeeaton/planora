// ============================================================
// src/services/recurringTasks.js
// Handles all recurring task logic — generation, scheduling,
// and next-due-date calculation.
// ============================================================

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Recurrence types supported:
 *   daily        — every day
 *   weekly       — same day each week
 *   custom_days  — specific days of week (e.g. Mon/Wed/Fri)
 *   biweekly     — every 2 weeks
 *   monthly      — same date each month
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * Returns a human-readable label for a recurrence config.
 * e.g. { type: "custom_days", days: [1,3,5] } → "Mon, Wed, Fri"
 */
export const getRecurrenceLabel = (recurrence) => {
  if (!recurrence) return null;
  switch (recurrence.type) {
    case "daily":       return "Every day";
    case "weekly":      return `Every ${DAY_FULL[recurrence.dayOfWeek ?? 1]}`;
    case "biweekly":    return `Every 2 weeks (${DAY_FULL[recurrence.dayOfWeek ?? 1]})`;
    case "monthly":     return `Monthly`;
    case "custom_days":
      return (recurrence.days ?? []).map((d) => DAY_NAMES[d]).join(", ");
    default:            return "Recurring";
  }
};

/**
 * Given a recurrence config and a reference date (usually today or last due date),
 * returns the next Date this task should be due.
 */
export const getNextDueDate = (recurrence, fromDate = new Date()) => {
  const base = new Date(fromDate);
  base.setHours(23, 59, 0, 0); // end of day

  switch (recurrence.type) {
    case "daily": {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      return next;
    }

    case "weekly": {
      const next = new Date(base);
      const targetDay = recurrence.dayOfWeek ?? base.getDay();
      const diff = (targetDay - base.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + diff);
      return next;
    }

    case "biweekly": {
      const next = new Date(base);
      next.setDate(next.getDate() + 14);
      return next;
    }

    case "monthly": {
      const next = new Date(base);
      next.setMonth(next.getMonth() + 1);
      return next;
    }

    case "custom_days": {
      const days = recurrence.days ?? [];
      if (days.length === 0) return null;
      const today = base.getDay();
      // Find the soonest upcoming day in the set
      let minDiff = 8;
      for (const d of days) {
        const diff = (d - today + 7) % 7 || 7;
        if (diff < minDiff) minDiff = diff;
      }
      const next = new Date(base);
      next.setDate(next.getDate() + minDiff);
      return next;
    }

    default:
      return null;
  }
};

/**
 * When a recurring task is completed, spawn the next instance.
 */
export const spawnNextRecurringTask = async (completedTask) => {
  if (!completedTask.recurrence) return;

  const nextDue = getNextDueDate(
    completedTask.recurrence,
    completedTask.dueDate ? new Date(completedTask.dueDate) : new Date()
  );
  if (!nextDue) return;

  try {
    await addDoc(collection(db, "tasks"), {
      userId:        completedTask.userId,
      title:         completedTask.title,
      description:   completedTask.description ?? "",
      priority:      completedTask.priority ?? "MEDIUM",
      classId:       completedTask.classId   ?? null,
      className:     completedTask.className ?? null,
      recurrence:    completedTask.recurrence,
      completed:     false,
      createdAt:     Timestamp.now(),
      lastTouchedAt: Timestamp.now(),
      dueDate:       Timestamp.fromDate(nextDue),
      parentTaskId:  completedTask.id, // trace back to origin
    });
  } catch (err) {
    console.warn("Failed to spawn next recurring task:", err);
  }
};