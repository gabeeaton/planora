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
        lightColor:  "#9060E8",
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
        lightColor:  "#9060E8",
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

/**
 * Check if notifications are already granted — never prompts the user.
 * Use this inside scheduling functions so they never trigger Apple's dialog.
 * Only NotificationPermissionPrompt should call requestNotificationPermissions().
 */
const checkNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
};

// ── Schedule a reminder for one task ─────────────────────────

/**
 * Schedule up to 2 reminders for a task:
 *   1. Day-before reminder — snapped to user's productive hour if possible,
 *      falls back to due - 24h.
 *   2. 2 hours before due date (HIGH priority only)
 *
 * Returns an object: { id24h, id2h } — store this on the task
 * in Firestore as `notificationIds` so you can cancel later.
 *
 * @param {object} task      - must have: id, title, dueDate, priority
 * @param {string} bestTime  - "morning"|"afternoon"|"evening"|"night" (optional)
 * @returns {Promise<{id24h: string|null, id2h: string|null}>}
 */
export const scheduleTaskReminder = async (task, bestTime = null) => {
  const result = { id24h: null, id2h: null };

  if (!task?.dueDate) return result;

  const due = new Date(task.dueDate);
  const now = new Date();

  // Don't schedule reminders for tasks already due
  if (due <= now) return result;

  const granted = await checkNotificationPermissions();
  if (!granted) return result;

  // ── Day-before reminder ───────────────────────────────────
  // Try to fire at the user's productive hour on the day before due.
  // Fall back to due - 24h if the smart time is past or too close to due.
  let remind24h = new Date(due.getTime() - 24 * 60 * 60 * 1000);
  if (bestTime && PRODUCTIVE_TIME_HOURS[bestTime] !== undefined) {
    const smartTime = new Date(due);
    smartTime.setDate(smartTime.getDate() - 1);
    smartTime.setHours(PRODUCTIVE_TIME_HOURS[bestTime], 0, 0, 0);
    // Use smart time only if it's in the future and at least 1h before due
    if (smartTime > now && smartTime < new Date(due.getTime() - 60 * 60 * 1000)) {
      remind24h = smartTime;
    }
  }

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

// ── Streak reminder (daily, fires at user's productive hour) ─

const streakNotifKey = (uid) => `@planora_streak_notif_id_${uid}`;

const PRODUCTIVE_TIME_HOURS = {
  morning:   8,
  afternoon: 13,
  evening:   18,
  night:     21,
};

/**
 * Schedule (or reschedule) a daily streak reminder at the user's best
 * productive time. Cancels any previously scheduled one first.
 *
 * @param {number} streak    Current streak count (must be > 0)
 * @param {string} bestTime  "morning" | "afternoon" | "evening" | "night"
 * @param {string} uid       Firebase user ID (keeps keys user-specific)
 */
export const scheduleStreakReminder = async (streak, bestTime, uid) => {
  if (!uid) return;
  if (!streak || streak <= 0) {
    await cancelStreakReminder(uid);
    return;
  }

  const granted = await checkNotificationPermissions();
  if (!granted) return;

  // Cancel existing before rescheduling
  await cancelStreakReminder(uid);

  const hour = PRODUCTIVE_TIME_HOURS[bestTime] ?? 18;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 ${streak} day streak — keep it going!`,
        body:  "Complete a task today so you don't lose your streak.",
        data:  { type: "streak-reminder" },
        sound: true,
      },
      trigger: {
        type:    "daily",
        hour,
        minute:  0,
        repeats: true,
      },
    });
    await AsyncStorage.setItem(streakNotifKey(uid), id).catch(() => {});
  } catch (err) {
    console.warn("Failed to schedule streak reminder:", err);
  }
};

/**
 * Cancel the streak reminder for a specific user.
 */
export const cancelStreakReminder = async (uid) => {
  try {
    const key = uid ? streakNotifKey(uid) : null;
    const id  = key ? await AsyncStorage.getItem(key) : null;
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(key).catch(() => {});
    }
  } catch {}
};

/**
 * Cancel ALL scheduled local notifications — call on sign-out to prevent
 * stale notifications from a previous account firing on the next user.
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
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
export const checkAndScheduleAvoidanceAlerts = async (avoidanceScores, bestTime = null) => {
  if (!avoidanceScores?.length) return;

  const granted = await checkNotificationPermissions();
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
      // Fire at the user's productive hour (or 9am default) rather than
      // 5 seconds after app open — more useful when the app is closed
      const alertHour = PRODUCTIVE_TIME_HOURS[bestTime] ?? 9;
      const fireTime = new Date();
      fireTime.setHours(alertHour, 0, 0, 0);
      if (fireTime <= new Date()) {
        // Productive hour already passed today — schedule for same time tomorrow
        fireTime.setDate(fireTime.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Don't forget this one 👀",
          body:  `${classLabel}"${title}" hasn't been touched in ${daysSinceTouched} days.${dueLabel}`,
          data:  { type: "avoidance-alert", taskId },
          sound: true,
        },
        trigger: { type: "date", date: fireTime },
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

const weeklySummaryKey = (uid) => `@planora_weekly_summary_id_${uid}`;

/**
 * Schedule (or reschedule) a weekly summary for next Sunday at 7pm.
 * Bakes in real stats: tasks completed this week + tasks due before Monday.
 * Call whenever tasks or history change so the copy stays fresh.
 *
 * @param {Array}  tasks    All tasks
 * @param {Array}  history  Completed task history
 * @param {string} uid      Firebase user ID
 */
export const scheduleWeeklySummary = async (tasks, history, uid) => {
  if (!uid) return;

  const granted = await checkNotificationPermissions();
  if (!granted) return;

  // Cancel previous
  try {
    const prevId = await AsyncStorage.getItem(weeklySummaryKey(uid));
    if (prevId) {
      await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
      await AsyncStorage.removeItem(weeklySummaryKey(uid)).catch(() => {});
    }
  } catch {}

  // Count tasks completed in the last 7 days (from history)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const completedThisWeek = (history ?? []).filter((h) => {
    const d = h.completedAt ? new Date(h.completedAt) : null;
    return d && d >= weekAgo;
  }).length;

  // Count pending tasks due before next Monday
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);

  const dueBeforeMonday = (tasks ?? []).filter((t) => {
    if (t.completed || !t.dueDate) return false;
    return new Date(t.dueDate) < nextMonday;
  }).length;

  // Skip if nothing to report
  if (completedThisWeek === 0 && dueBeforeMonday === 0) return;

  // Build specific copy
  let title, body;
  if (completedThisWeek > 0 && dueBeforeMonday > 0) {
    title = "📊 Weekly check-in";
    body  = `You knocked out ${completedThisWeek} task${completedThisWeek !== 1 ? "s" : ""} this week. ${dueBeforeMonday} more due before Monday — finish strong.`;
  } else if (completedThisWeek > 0) {
    title = "📊 Weekly check-in";
    body  = `${completedThisWeek} task${completedThisWeek !== 1 ? "s" : ""} done this week. You're clear — enjoy the weekend.`;
  } else {
    title = "📊 Weekend heads up";
    body  = `${dueBeforeMonday} task${dueBeforeMonday !== 1 ? "s" : ""} due before Monday. Get ahead this weekend.`;
  }

  // Find the next Sunday at 7pm
  const fireSunday = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
  fireSunday.setDate(now.getDate() + daysUntilSunday);
  fireSunday.setHours(19, 0, 0, 0);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { type: "weekly-summary" }, sound: true },
      trigger: { type: "date", date: fireSunday },
    });
    await AsyncStorage.setItem(weeklySummaryKey(uid), id).catch(() => {});
  } catch (err) {
    console.warn("Failed to schedule weekly summary:", err);
  }
};

// ── Morning due-today digest ──────────────────────────────────

const digestNotifKey = (uid) => `@planora_digest_notif_id_${uid}`;

/**
 * Schedule a "due today" morning notification for the next day.
 * Call whenever tasks change. Cancels the previous digest first.
 * Skips if no tasks are due tomorrow (= today when it fires).
 *
 * @param {Array}  tasks     All tasks
 * @param {string} bestTime  "morning"|"afternoon"|"evening"|"night"
 * @param {string} uid       Firebase user ID
 */
export const scheduleDailyDigest = async (tasks, bestTime, uid) => {
  if (!uid) return;

  const granted = await checkNotificationPermissions();
  if (!granted) return;

  // Cancel any previously scheduled digest
  try {
    const prevId = await AsyncStorage.getItem(digestNotifKey(uid));
    if (prevId) {
      await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
      await AsyncStorage.removeItem(digestNotifKey(uid)).catch(() => {});
    }
  } catch {}

  // Find tasks due tomorrow (they'll be "due today" when the notification fires)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const dueTomorrow = (tasks ?? []).filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= tomorrow && d < dayAfter;
  });

  if (dueTomorrow.length === 0) return;

  const hour = PRODUCTIVE_TIME_HOURS[bestTime] ?? 8;
  const fireTime = new Date(tomorrow);
  fireTime.setHours(hour, 0, 0, 0);

  const body = dueTomorrow.length === 1
    ? `"${dueTomorrow[0].title}" is due today.`
    : `${dueTomorrow.length} tasks due today — don't let them sneak up on you.`;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Good morning — check today's tasks",
        body,
        data:  { type: "daily-digest" },
        sound: true,
      },
      trigger: { type: "date", date: fireTime },
    });
    await AsyncStorage.setItem(digestNotifKey(uid), id).catch(() => {});
  } catch (err) {
    console.warn("Failed to schedule daily digest:", err);
  }
};

// ── App icon badge (overdue count) ───────────────────────────

/**
 * Set the app icon badge to the number of overdue tasks.
 * Clears the badge when there are none.
 * Silently no-ops if permissions aren't granted.
 */
export const updateOverdueBadge = async (tasks) => {
  try {
    const now = new Date();
    const count = (tasks ?? []).filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
    ).length;
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Fail silently — badge is a nice-to-have
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