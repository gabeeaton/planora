// ============================================================
// src/services/notifications.js
//
// IMPORTANT: expo-notifications requires a standalone build to work.
// Run: npx expo run:ios  (or run:android)
// It will NOT fire in Expo Go (SDK 53+).
//
// What this module does:
//   - requestNotificationPermissions  — ask on first use
//   - scheduleTaskReminder            — schedule for 24h + 2h before due
//   - cancelTaskReminder              — cancel both when task is deleted/done
//   - cancelAllReminders              — nuclear option on logout
//   - scheduleWeeklySummary           — Sunday 7pm recap push
// ============================================================

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Global handler — show banners while app is foregrounded ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

// ── Permission request ────────────────────────────────────────

/**
 * Ask the OS for notification permission.
 * Call once — ideally after user has seen their first task list.
 * Returns true if granted.
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();

    // Android 13+ needs an explicit channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("task-reminders", {
        name:        "Task Reminders",
        importance:  Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:  "#6C63FF",
        sound:       true,
      });
      await Notifications.setNotificationChannelAsync("weekly-summary", {
        name:        "Weekly Summary",
        importance:  Notifications.AndroidImportance.DEFAULT,
        sound:       true,
      });
      await Notifications.setNotificationChannelAsync("avoidance-alerts", {
        name:        "Avoidance Alerts",
        importance:  Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:  "#6C63FF",
        sound:       true,
      });
    }

    return status === "granted";
  } catch (err) {
    // Gracefully fail — notifications are a nice-to-have, not critical
    console.warn("Notification permission error:", err);
    return false;
  }
};

// ── Schedule a reminder for one task ─────────────────────────

/**
 * Schedule up to 2 reminders for a task:
 *   1. 24 hours before due date
 *   2. 2 hours before due date (HIGH priority only)
 *
 * Returns an object: { id24h, id2h } — store this on the task
 * in Firestore as `notificationIds` so you can cancel later.
 *
 * @param {object} task  - must have: id, title, dueDate, priority
 * @returns {Promise<{id24h: string|null, id2h: string|null}>}
 */
export const scheduleTaskReminder = async (task) => {
  const result = { id24h: null, id2h: null };

  if (!task?.dueDate) return result;

  const due = new Date(task.dueDate);
  const now = new Date();

  // Don't schedule reminders for tasks already due
  if (due <= now) return result;

  const granted = await requestNotificationPermissions();
  if (!granted) return result;

  // ── 24-hour reminder ──────────────────────────────────────
  const remind24h = new Date(due.getTime() - 24 * 60 * 60 * 1000);
  if (remind24h > now) {
    try {
      result.id24h = await Notifications.scheduleNotificationAsync({
        content: {
          title: `📚 Due tomorrow: ${task.title}`,
          body:  task.className
            ? `${task.className} — due ${_formatDue(due)}`
            : `Due ${_formatDue(due)}`,
          data:  { taskId: task.id },
          sound: true,
        },
        trigger: { type: "date", date: remind24h },
      });
    } catch (err) {
      console.warn("Failed to schedule 24h reminder:", err);
    }
  }

  // ── 2-hour reminder (HIGH priority only) ─────────────────
  if (task.priority === "HIGH") {
    const remind2h = new Date(due.getTime() - 2 * 60 * 60 * 1000);
    if (remind2h > now) {
      try {
        result.id2h = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ Due in 2 hours: ${task.title}`,
            body:  task.className
              ? `${task.className} assignment due very soon!`
              : "This task is due very soon!",
            data:  { taskId: task.id },
            sound: true,
          },
          trigger: { type: "date", date: remind2h },
        });
      } catch (err) {
        console.warn("Failed to schedule 2h reminder:", err);
      }
    }
  }

  return result;
};

// ── Cancel reminders for one task ────────────────────────────

/**
 * Cancel all scheduled reminders for a specific task.
 * Pass the `notificationIds` object returned by scheduleTaskReminder.
 *
 * @param {object|string|null} notificationIds
 *   Either the { id24h, id2h } object, OR a legacy single string ID.
 */
export const cancelTaskReminder = async (notificationIds) => {
  if (!notificationIds) return;

  try {
    // Legacy: single string ID (old tasks may have stored just one ID)
    if (typeof notificationIds === "string") {
      await Notifications.cancelScheduledNotificationAsync(notificationIds);
      return;
    }

    const { id24h, id2h } = notificationIds;
    if (id24h) await Notifications.cancelScheduledNotificationAsync(id24h).catch(() => {});
    if (id2h)  await Notifications.cancelScheduledNotificationAsync(id2h).catch(() => {});
  } catch (err) {
    console.warn("Failed to cancel task reminder:", err);
  }
};

// ── Cancel ALL reminders (on logout / account wipe) ──────────

export const cancelAllReminders = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn("Failed to cancel all reminders:", err);
  }
};

// ── Avoidance alerts (Scholar only) ──────────────────────────

const AVOIDANCE_MAP_KEY = "@planora_avoidance_alerted";
const todayDateStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

/**
 * For each avoided task that qualifies, fire a local notification once per day.
 * Caller is responsible for the Scholar gate — this function has no Pro check.
 *
 * @param {Array} avoidanceScores  Output of getAvoidanceScores()
 */
export const checkAndScheduleAvoidanceAlerts = async (avoidanceScores) => {
  if (!avoidanceScores?.length) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Load dedup map { taskId: "YYYY-MM-DD" }
  let alerted = {};
  try {
    const raw = await AsyncStorage.getItem(AVOIDANCE_MAP_KEY);
    if (raw) alerted = JSON.parse(raw);
  } catch {}

  const today = todayDateStr();
  let changed = false;

  for (const item of avoidanceScores) {
    const { taskId, title, className, isBeingAvoided, daysSinceTouched, daysUntilDue } = item;
    if (!isBeingAvoided) continue;
    if (daysUntilDue !== null && daysUntilDue > 4) continue; // only nudge when it matters
    if (alerted[taskId] === today) continue; // already fired today

    const classLabel = className ? `${className} — ` : "";
    const dueLabel   = daysUntilDue !== null
      ? daysUntilDue === 0 ? " It's due today."
      : daysUntilDue === 1 ? " It's due tomorrow."
      : ` Due in ${daysUntilDue} days.`
      : "";

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Don't forget this one 👀",
          body:  `${classLabel}"${title}" hasn't been touched in ${daysSinceTouched} days.${dueLabel}`,
          data:  { type: "avoidance-alert", taskId },
          sound: true,
        },
        trigger: { type: "timeInterval", seconds: 5 },
      });
      alerted[taskId] = today;
      changed = true;
    } catch (err) {
      console.warn("Failed to schedule avoidance alert:", err);
    }
  }

  if (changed) {
    // Prune entries older than 2 days to keep the map small
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const cutoff = twoDaysAgo.toISOString().slice(0, 10);
    Object.keys(alerted).forEach((k) => { if (alerted[k] < cutoff) delete alerted[k]; });
    AsyncStorage.setItem(AVOIDANCE_MAP_KEY, JSON.stringify(alerted)).catch(() => {});
  }
};

// ── Weekly summary (Sunday 7pm) ───────────────────────────────

/**
 * Schedule a repeating weekly summary notification every Sunday at 7pm.
 * This fires once a week regardless of tasks — the body is generic.
 * For per-user stats you'd need a backend push. This is a good-enough local version.
 *
 * Returns the notification ID (string). Store it to cancel later.
 */
export const scheduleWeeklySummary = async () => {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    // Cancel any existing weekly summary first (avoid duplicates)
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content?.data?.type === "weekly-summary") {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📊 Your week in review",
        body:  "Open Planora to see how you did this week and plan ahead.",
        data:  { type: "weekly-summary" },
        sound: true,
      },
      trigger: {
        type:     "weekly",
        weekday:  1,    // Sunday (1 = Sunday in Expo's numbering)
        hour:     19,   // 7pm
        minute:   0,
        repeats:  true,
      },
    });

    return id;
  } catch (err) {
    console.warn("Failed to schedule weekly summary:", err);
    return null;
  }
};

// ── Internal helpers ──────────────────────────────────────────

const _formatDue = (date) => {
  const now   = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const dueMidnight = new Date(date); dueMidnight.setHours(0, 0, 0, 0);
  const diff  = Math.round((dueMidnight - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";

  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};