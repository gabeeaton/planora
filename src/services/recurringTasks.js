// ============================================================
// src/services/recurringTasks.js
//
// CHANGES:
//  - spawnNextRecurringTask now has an idempotency guard:
//    checks Firestore for an existing task with the same
//    parentTaskId + dueDate before spawning. Prevents duplicates
//    if a user double-taps a completion.
// ============================================================

import { addDoc, collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * Returns a human-readable label for a recurrence config.
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
 * Given a recurrence config and a reference date, returns the next Date.
 */
export const getNextDueDate = (recurrence, fromDate = new Date()) => {
  const base = new Date(fromDate);
  base.setHours(23, 59, 0, 0);

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
 *
 * IDEMPOTENCY GUARD: Before creating, we query Firestore for any
 * existing task that shares the same parentTaskId AND dueDate.
 * If one already exists, we skip — preventing duplicates from
 * double-taps or network retries.
 */
export const spawnNextRecurringTask = async (completedTask) => {
  if (!completedTask.recurrence) return;

  const nextDue = getNextDueDate(
    completedTask.recurrence,
    completedTask.dueDate ? new Date(completedTask.dueDate) : new Date()
  );
  if (!nextDue) return;

  try {
    // ── Idempotency check ──────────────────────────────────
    // Window: ±1 hour around nextDue to catch timestamp rounding
    const windowStart = new Date(nextDue.getTime() - 60 * 60 * 1000);
    const windowEnd   = new Date(nextDue.getTime() + 60 * 60 * 1000);

    const existingQuery = query(
      collection(db, "tasks"),
      where("parentTaskId", "==", completedTask.id),
      where("dueDate", ">=", Timestamp.fromDate(windowStart)),
      where("dueDate", "<=", Timestamp.fromDate(windowEnd))
    );
    const existing = await getDocs(existingQuery);
    if (!existing.empty) {
      // Next instance already exists — skip silently
      return;
    }
    // ── End idempotency check ──────────────────────────────

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
      parentTaskId:  completedTask.id,
    });
  } catch (err) {
    console.warn("Failed to spawn next recurring task:", err);
  }
};