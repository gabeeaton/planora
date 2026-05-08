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
import { FEATURE_FLAGS } from "../config";

// ── Global handler — show banners while app is foregrounded ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Android channel setup (idempotent — safe to call multiple times) ─

const _schedulingLocks   = new Set();
const _schedulingPending = new Map(); // latest queued fn per key

// Run fn exclusively per key. If a call arrives while one is running,
// it is queued (replacing any previously queued call). When the current
// run finishes, the queued call executes — so the latest always wins.
const _withLock = async (key, fn) => {
  if (_schedulingLocks.has(key)) {
    _schedulingPending.set(key, fn);
    return;
  }
  _schedulingLocks.add(key);
  try {
    await fn();
  } finally {
    _schedulingLocks.delete(key);
    const pending = _schedulingPending.get(key);
    if (pending) {
      _schedulingPending.delete(key);
      _withLock(key, pending); // tail-call — does not await, fire and forget
    }
  }
};


const _ensureAndroidChannels = async () => {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("task-reminders", {
      name: "Task Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#9060E8",
      sound: true,
    });
    await Notifications.setNotificationChannelAsync("weekly-summary", {
      name: "Weekly Summary",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
    await Notifications.setNotificationChannelAsync("avoidance-alerts", {
      name: "Avoidance Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#9060E8",
      sound: true,
    });
    await Notifications.setNotificationChannelAsync("study-plan-reminders", {
      name: "Study Plan",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: true,
    });
  } catch (err) {
    console.warn("Failed to set Android notification channels:", err);
  }
};

// ── Permission request ────────────────────────────────────────

/**
 * Ask the OS for notification permission.
 * Call once — ideally after user has seen their first task list.
 * Returns true if granted.
 *
 * Android channels are always (re)created here — creating an existing
 * channel is a no-op, so this is safe even if permissions were already
 * granted on a previous install.
 */

export const testImmediateNotification = async () => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔥 TEST NOTIFICATION",
      body: "If you see this, push system works",
      sound: true,
    },
    trigger: null,
  });
};

/**
 * Fire every notification type in sequence with 8s gaps.
 * Pass real tasks + streak so the content looks authentic.
 *
 * @param {Array}  tasks   All tasks (picks first pending one for task reminders)
 * @param {number} streak  Current streak count
 */
/**
 * Fire batch notification scenarios in sequence so you can verify copy/grouping.
 * Fires 5 scenarios over ~40 seconds.
 */
export const testBatchNotifications = async () => {
  const granted = await checkNotificationPermissions();
  if (!granted) return;

  const schedule = (delaySecs, title, body) => {
    const fire = new Date(Date.now() + delaySecs * 1000);
    return Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  };

  // 1 — single task due tomorrow
  await schedule(4,
    "📚 Due tomorrow: Research Paper Draft",
    "ENGL 301 — due tomorrow at 11:59 PM"
  );
  // 2 — 3 tasks due tomorrow
  await schedule(12,
    "📚 3 assignments due tomorrow",
    "Research Paper Draft, CHEM 201 Lab Report, MATH 240 Problem Set"
  );
  // 3 — 6 tasks due tomorrow (count + truncate)
  await schedule(20,
    "📚 6 assignments due tomorrow",
    "Research Paper Draft, CHEM 201 Lab Report, MATH 240 Problem Set +3 more"
  );
  // 4 — single 2h reminder
  await schedule(28,
    "⚠️ Due in 2 hours: CHEM 201 Lab Report",
    "CHEM 201 — due very soon!"
  );
  // 5 — multiple 2h reminder
  await schedule(36,
    "⚠️ 4 assignments due in ~2 hours",
    "CHEM 201 Lab Report, MATH 240 Problem Set, HIST 110 Essay +1 more"
  );
  // 6 — overdue nudge
  await schedule(44,
    "⚠️ Overdue: Research Paper Draft",
    "ENGL 301 — was due yesterday. Don't let it slip further."
  );
};

export const testAllNotifications = async (tasks = [], streak = 3) => {
  const granted = await checkNotificationPermissions();
  if (!granted) return;

  const pending = tasks.filter((t) => !t.completed);
  const sampleTitle = pending[0]?.title ?? "Research Paper Draft";
  const sampleClass = pending[0]?.className ?? "ENGL 301";

  const schedule = (delaySecs, title, body, data = {}) => {
    const fire = new Date(Date.now() + delaySecs * 1000);
    return Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    }).catch(() => {});
  };

  // 1 — immediate test
  await schedule(3,  "✅ Notifications working", "You'll receive 5 more over the next 40 seconds.");

  // 2 — 24h task reminder
  await schedule(11, `📚 Due tomorrow: ${sampleTitle}`,
    sampleClass ? `${sampleClass} — due tomorrow at 11:59 PM` : "Due tomorrow at 11:59 PM",
    { type: "test-24h" });

  // 3 — 2h task reminder
  await schedule(19, `⚠️ Due in 2 hours: ${sampleTitle}`,
    sampleClass ? `${sampleClass} assignment due very soon!` : "This task is due very soon!",
    { type: "test-2h" });

  // 4 — daily digest
  await schedule(27, "Good morning — check today's tasks",
    pending.length > 0
      ? `${Math.min(pending.length, 3)} tasks due today — don't let them sneak up on you.`
      : "No tasks due today. Enjoy the day!",
    { type: "test-digest" });

  // 5 — streak reminder
  await schedule(35, `🔥 ${streak} day streak — keep it going!`,
    "Complete a task today so you don't lose your streak.",
    { type: "test-streak" });

  // 6 — weekly summary
  await schedule(43, "📊 Weekly check-in",
    `You knocked out ${Math.max(1, pending.length)} tasks this week. Finish strong before Monday.`,
    { type: "test-weekly" });
};

export const requestNotificationPermissions = async () => {
  try {
    // Always ensure Android channels exist — re-creating is idempotent
    await _ensureAndroidChannels();

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
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

// ── Batch reminder helpers ────────────────────────────────────

const batchManifestKey = (uid) => `@planora_batch_manifest_${uid}`;

const _saveBatchManifest = async (uid, entries) => {
  await AsyncStorage.setItem(batchManifestKey(uid), JSON.stringify(entries)).catch(() => {});
};

const _loadBatchManifest = async (uid) => {
  try {
    const raw = await AsyncStorage.getItem(batchManifestKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const _cancelAllBatchNotifications = async (uid) => {
  const entries = await _loadBatchManifest(uid);
  await Promise.all(
    entries.map(({ id }) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
  await AsyncStorage.removeItem(batchManifestKey(uid)).catch(() => {});
};

const _taskDueDate = (task) => {
  const due = task.dueDate?.toDate?.() ?? new Date(task.dueDate);
  const hasTime = Array.isArray(task.dueTime) && task.dueTime.length === 2;
  due.setHours(hasTime ? task.dueTime[0] : 23, hasTime ? task.dueTime[1] : 59, 0, 0);
  return due;
};

// Local YYYY-MM-DD — avoids UTC shift converting a late-evening local date to next day in UTC
const _localDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const _build24hContent = (tasks, dueDateObj) => {
  const count = tasks.length;
  if (count === 1) {
    const t = tasks[0];
    return {
      title: `📚 Due tomorrow: ${t.title}`,
      body: t.className ? `${t.className} — due ${_formatDue(dueDateObj)}` : `Due ${_formatDue(dueDateObj)}`,
    };
  }
  const names = tasks.slice(0, 3).map((t) => t.title).join(", ");
  const extra  = count > 3 ? ` +${count - 3} more` : "";
  return {
    title: `📚 ${count} assignments due tomorrow`,
    body: names + extra,
  };
};

const _build2hContent = (tasks) => {
  const count = tasks.length;
  if (count === 1) {
    const t = tasks[0];
    return {
      title: `⚠️ Due in 2 hours: ${t.title}`,
      body: t.className ? `${t.className} — due very soon!` : "Due very soon!",
    };
  }
  const names = tasks.slice(0, 3).map((t) => t.title).join(", ");
  const extra  = count > 3 ? ` +${count - 3} more` : "";
  return {
    title: `⚠️ ${count} assignments due in ~2 hours`,
    body: names + extra,
  };
};

/**
 * Schedule batch reminders for all pending tasks within the next 7 days.
 * Groups tasks by due date → one "due tomorrow" notification per date,
 * one "due in 2 hours" notification per unique due-time cluster.
 * Always cancels existing batch notifications first — safe to call any time.
 */
export const scheduleBatchReminders = async (tasks, bestTime, uid) => {
  if (!uid || FEATURE_FLAGS.DEMO_MODE) return;
  await _withLock(`batch-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    await _cancelAllBatchNotifications(uid);

    const now       = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fireHour  = PRODUCTIVE_TIME_HOURS[bestTime] ?? 9;
    const manifest  = [];

    // Group pending tasks by date string (YYYY-MM-DD)
    const byDate = new Map();
    for (const task of tasks) {
      if (task.completed || !task.dueDate) continue;
      const due = _taskDueDate(task);
      if (due <= now || due > windowEnd) continue;
      const dateStr = _localDateStr(due);
      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr).push({ task, due });
    }

    for (const [dateStr, entries] of byDate) {
      const taskList = entries.map((e) => e.task);

      // ── Day-before (24h) batch ──────────────────────────
      const dayBefore = new Date(dateStr + "T00:00:00");
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(fireHour, 0, 0, 0);

      if (dayBefore > now) {
        const { title, body } = _build24hContent(taskList, new Date(dateStr + "T23:59:00"));
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { type: "batch-24h", date: dateStr }, sound: true },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
          });
          manifest.push({ id, label: `24h-${dateStr}` });
        } catch (err) { console.warn("batch 24h failed:", err); }
      }

      // ── 2-hour reminders — group only tasks with identical due times ─
      const byExactTime = new Map();
      for (const { task, due } of entries) {
        const fireAt = new Date(due.getTime() - 2 * 60 * 60 * 1000);
        if (fireAt < now) continue;
        const key = fireAt.getTime();
        if (!byExactTime.has(key)) byExactTime.set(key, { fireAt, tasks: [] });
        byExactTime.get(key).tasks.push(task);
      }

      for (const { fireAt, tasks: group } of byExactTime.values()) {
        const { title, body } = _build2hContent(group);
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { type: "batch-2h", date: dateStr }, sound: true },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
          });
          manifest.push({ id, label: `2h-${fireAt.getTime()}-${dateStr}` });
        } catch (err) { console.warn("batch 2h failed:", err); }
      }
    }

    await _saveBatchManifest(uid, manifest);
  });
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
    if (id24h)
      await Notifications.cancelScheduledNotificationAsync(id24h).catch(
        () => {}
      );
    if (id2h)
      await Notifications.cancelScheduledNotificationAsync(id2h).catch(
        () => {}
      );
  } catch (err) {
    console.warn("Failed to cancel task reminder:", err);
  }
};

// ── Study plan reminders ──────────────────────────────────────

const studyPlanManifestKey = (uid) => `@planora_study_plan_manifest_${uid}`;

const STUDY_PLAN_HOUR = 8; // 8:00 AM

/**
 * Schedule one morning notification per day that has study sessions.
 * Always cancels existing study plan notifications first — safe to call
 * after generating or loading from cache.
 *
 * @param {Array}  plan  Array of session objects (same shape as StudyPlanScreen cache)
 * @param {string} uid   Firebase user ID
 */
export const scheduleStudyPlanReminders = async (plan, uid) => {
  if (!uid || !plan?.length || FEATURE_FLAGS.DEMO_MODE) return;
  await _withLock(`study-plan-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    await cancelStudyPlanReminders(uid);

    const now = new Date();
    const manifest = [];

    // Group non-missed sessions by date
    const byDate = new Map();
    for (const session of plan) {
      if (!session.date || session.missed) continue;
      if (!byDate.has(session.date)) byDate.set(session.date, []);
      byDate.get(session.date).push(session);
    }

    for (const [dateStr, sessions] of byDate) {
      // Build fire time: 8:00 AM local time on that day
      // "YYYY-MM-DDT08:00:00" parsed without Z stays in local time
      const fireTime = new Date(`${dateStr}T${String(STUDY_PLAN_HOUR).padStart(2, "0")}:00:00`);
      if (isNaN(fireTime.getTime()) || fireTime <= now) continue;

      // Summarise sessions for the body line
      const totalMins = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
      const hours = Math.floor(totalMins / 60);
      const mins  = totalMins % 60;
      const timeStr = hours > 0
        ? (mins > 0 ? `${hours}h ${mins}min` : `${hours}h`)
        : `${mins}min`;

      const names = sessions
        .slice(0, 2)
        .map((s) => s.className ?? s.sessionTitle)
        .filter(Boolean)
        .join(" · ");
      const extra    = sessions.length > 2 ? ` +${sessions.length - 2} more` : "";
      const timeSuffix = totalMins > 0 ? ` — ${timeStr} total` : "";
      const body = names
        ? `${names}${extra}${timeSuffix}`
        : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}${timeSuffix}`;

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: "📚 Today's study plan",
            body,
            data: { type: "study-plan-reminder", date: dateStr },
            sound: true,
            ...(Platform.OS === "android" && { channelId: "study-plan-reminders" }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireTime,
          },
        });
        manifest.push({ id, date: dateStr });
      } catch (err) {
        console.warn("Failed to schedule study plan reminder:", err);
      }
    }

    await AsyncStorage.setItem(studyPlanManifestKey(uid), JSON.stringify(manifest)).catch(() => {});
  });
};

/**
 * Cancel all pending study plan reminders for a user.
 * Call when the plan is cleared or a new one is generated (scheduleStudyPlanReminders
 * already calls this internally, so only call directly when clearing without regenerating).
 */
export const cancelStudyPlanReminders = async (uid) => {
  if (!uid) return;
  try {
    const raw = await AsyncStorage.getItem(studyPlanManifestKey(uid));
    if (!raw) return;
    const manifest = JSON.parse(raw);
    await Promise.all(
      manifest.map(({ id }) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
    await AsyncStorage.removeItem(studyPlanManifestKey(uid)).catch(() => {});
  } catch {}
};

/**
 * Fire a study-plan notification in 5 seconds with realistic sample content.
 * Use from the dev menu to verify content and tap-to-open behaviour.
 */
export const testStudyPlanNotification = async () => {
  const granted = await checkNotificationPermissions();
  if (!granted) return;
  const fire = new Date(Date.now() + 5000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "📚 Today's study plan",
      body: "HIST 201 · MATH 240 — 1h 45min total",
      data: { type: "study-plan-reminder", date: new Date().toISOString().slice(0, 10) },
      sound: true,
      ...(Platform.OS === "android" && { channelId: "study-plan-reminders" }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fire,
    },
  }).catch((err) => console.warn("testStudyPlanNotification failed:", err));
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
  morning: 8,
  afternoon: 13,
  evening: 18,
  night: 21,
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
  if (!uid || FEATURE_FLAGS.DEMO_MODE) return;
  if (!streak || streak <= 0) {
    await cancelStreakReminder(uid);
    return;
  }
  await _withLock(`streak-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    await cancelStreakReminder(uid);

    const hour = PRODUCTIVE_TIME_HOURS[bestTime] ?? 18;
    const fire = new Date();
    fire.setHours(hour, 0, 0, 0);
    if (fire <= new Date()) {
      fire.setDate(fire.getDate() + 1);
    }

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔥 ${streak} day streak — keep it going!`,
          body: "Complete a task today so you don't lose your streak.",
          data: { type: "streak-reminder" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fire,
        },
      });
      await AsyncStorage.setItem(streakNotifKey(uid), id).catch(() => {});
    } catch (err) {
      console.warn("Failed to schedule streak reminder:", err);
    }
  });
};

/**
 * Cancel the streak reminder for a specific user.
 */
export const cancelStreakReminder = async (uid) => {
  try {
    const key = uid ? streakNotifKey(uid) : null;
    const id = key ? await AsyncStorage.getItem(key) : null;
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(key).catch(() => {});
    }
  } catch {}
};

/**
 * Cancel ALL scheduled local notifications and wipe per-user AsyncStorage keys.
 * Call on sign-out to prevent stale notifications from firing for the next user.
 *
 * @param {string} uid  Firebase user ID — used to clean up user-scoped keys
 */
export const cancelAllNotifications = async (uid) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
  if (uid) {
    await AsyncStorage.multiRemove([
      `@planora_streak_notif_id_${uid}`,
      `@planora_weekly_summary_id_${uid}`,
      `@planora_digest_notif_id_${uid}`,
      `@planora_avoidance_alerted_${uid}`,
      `@planora_batch_manifest_${uid}`,
      `@planora_overdue_manifest_${uid}`,
      `@planora_study_plan_manifest_${uid}`,
    ]).catch(() => {});
  }
};

// ── Avoidance alerts (Scholar only) ──────────────────────────

const avoidanceMapKey = (uid) => `@planora_avoidance_alerted_${uid}`;
const todayDateStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

/**
 * For each avoided task that qualifies, fire a local notification once per day.
 * Caller is responsible for the Scholar gate — this function has no Pro check.
 *
 * @param {Array}  avoidanceScores  Output of getAvoidanceScores()
 * @param {string} bestTime         "morning"|"afternoon"|"evening"|"night"
 * @param {string} uid              Firebase user ID (keeps dedup map user-scoped)
 */
export const checkAndScheduleAvoidanceAlerts = async (
  avoidanceScores,
  bestTime = null,
  uid = null
) => {
  if (!avoidanceScores?.length || FEATURE_FLAGS.DEMO_MODE) return;

  const granted = await checkNotificationPermissions();
  if (!granted) return;

  const mapKey = uid ? avoidanceMapKey(uid) : "@planora_avoidance_alerted_anon";

  // Load dedup map { taskId: "YYYY-MM-DD" }
  let alerted = {};
  try {
    const raw = await AsyncStorage.getItem(mapKey);
    if (raw) alerted = JSON.parse(raw);
  } catch {}

  const today = todayDateStr();
  let changed = false;

  for (const item of avoidanceScores) {
    const {
      taskId,
      title,
      className,
      isBeingAvoided,
      daysSinceTouched,
      daysUntilDue,
    } = item;
    if (!isBeingAvoided) continue;
    if (daysUntilDue !== null && daysUntilDue > 4) continue; // only nudge when it matters
    if (alerted[taskId] === today) continue; // already fired today

    const classLabel = className ? `${className} — ` : "";
    const dueLabel =
      daysUntilDue !== null
        ? daysUntilDue === 0
          ? " It's due today."
          : daysUntilDue === 1
          ? " It's due tomorrow."
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
          body: `${classLabel}"${title}" hasn't been touched in ${daysSinceTouched} days.${dueLabel}`,
          data: { type: "avoidance-alert", taskId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireTime,
        },
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
    Object.keys(alerted).forEach((k) => {
      if (alerted[k] < cutoff) delete alerted[k];
    });
    AsyncStorage.setItem(mapKey, JSON.stringify(alerted)).catch(() => {});
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
  if (!uid || FEATURE_FLAGS.DEMO_MODE) return;
  await _withLock(`weekly-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    try {
      const prevId = await AsyncStorage.getItem(weeklySummaryKey(uid));
      if (prevId) {
        await Notifications.cancelScheduledNotificationAsync(prevId).catch(
          () => {}
        );
        await AsyncStorage.removeItem(weeklySummaryKey(uid)).catch(() => {});
      }
    } catch {}

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedThisWeek = (history ?? []).filter((h) => {
      const d = h.completedAt ? new Date(h.completedAt) : null;
      return d && d >= weekAgo;
    }).length;

    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
    nextMonday.setHours(0, 0, 0, 0);

    const dueBeforeMonday = (tasks ?? []).filter((t) => {
      if (t.completed || !t.dueDate) return false;
      return new Date(t.dueDate) < nextMonday;
    }).length;

    if (completedThisWeek === 0 && dueBeforeMonday === 0) return;

    let title, body;
    if (completedThisWeek > 0 && dueBeforeMonday > 0) {
      title = "📊 Weekly check-in";
      body = `You knocked out ${completedThisWeek} task${
        completedThisWeek !== 1 ? "s" : ""
      } this week. ${dueBeforeMonday} more due before Monday — finish strong.`;
    } else if (completedThisWeek > 0) {
      title = "📊 Weekly check-in";
      body = `${completedThisWeek} task${
        completedThisWeek !== 1 ? "s" : ""
      } done this week. You're clear — enjoy the weekend.`;
    } else {
      title = "📊 Weekend heads up";
      body = `${dueBeforeMonday} task${
        dueBeforeMonday !== 1 ? "s" : ""
      } due before Monday. Get ahead this weekend.`;
    }

    const fireSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    fireSunday.setDate(now.getDate() + daysUntilSunday);
    fireSunday.setHours(19, 0, 0, 0);

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { type: "weekly-summary" }, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireSunday,
        },
      });
      await AsyncStorage.setItem(weeklySummaryKey(uid), id).catch(() => {});
    } catch (err) {
      console.warn("Failed to schedule weekly summary:", err);
    }
  });
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
  if (!uid || FEATURE_FLAGS.DEMO_MODE) return;
  await _withLock(`digest-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    try {
      const prevId = await AsyncStorage.getItem(digestNotifKey(uid));
      if (prevId) {
        await Notifications.cancelScheduledNotificationAsync(prevId).catch(
          () => {}
        );
        await AsyncStorage.removeItem(digestNotifKey(uid)).catch(() => {});
      }
    } catch {}

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

    const body =
      dueTomorrow.length === 1
        ? `"${dueTomorrow[0].title}" is due today.`
        : `${dueTomorrow.length} tasks due today — don't let them sneak up on you.`;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Good morning — check today's tasks",
          body,
          data: { type: "daily-digest" },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireTime,
        },
      });
      await AsyncStorage.setItem(digestNotifKey(uid), id).catch(() => {});
    } catch (err) {
      console.warn("Failed to schedule daily digest:", err);
    }
  });
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
      (t) => !t.completed && t.dueDate && _taskDueDate(t) < now
    ).length;
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Fail silently — badge is a nice-to-have
  }
};

// ── Overdue nudge (fires morning after deadline missed) ───────

const overdueManifestKey = (uid) => `@planora_overdue_manifest_${uid}`;

/**
 * For each task that became overdue since the last check, schedule a one-time
 * nudge at the user's productive hour tomorrow morning (or later today if
 * the productive hour hasn't passed yet).
 * Deduplicates — each task fires at most once per overdue event.
 */
export const scheduleOverdueNudges = async (tasks, bestTime, uid) => {
  if (!uid || FEATURE_FLAGS.DEMO_MODE) return;
  await _withLock(`overdue-${uid}`, async () => {
    const granted = await checkNotificationPermissions();
    if (!granted) return;

    const now = new Date();
    const hour = PRODUCTIVE_TIME_HOURS[bestTime] ?? 9;

    // Load already-alerted task IDs so we don't double-fire
    let alerted = {};
    try {
      const raw = await AsyncStorage.getItem(overdueManifestKey(uid));
      if (raw) alerted = JSON.parse(raw);
    } catch {}

    for (const task of tasks) {
      if (task.completed || !task.dueDate) continue;
      if (alerted[task.id]) continue;

      const due = _taskDueDate(task);
      if (due >= now) continue;

      const fire = new Date();
      fire.setHours(hour, 0, 0, 0);
      if (fire <= now) fire.setDate(fire.getDate() + 1);

      const className = task.className ? `${task.className} — ` : "";
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `⚠️ Overdue: ${task.title}`,
            body: `${className}was due ${_formatDue(due)}. Don't let it slip further.`,
            data: { type: "overdue-nudge", taskId: task.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fire,
          },
        });
        alerted[task.id] = id;
      } catch (err) {
        console.warn("Failed to schedule overdue nudge:", err);
      }
    }

    // Prune entries for completed/deleted tasks — cancel their pending notifications too
    const activeIds = new Set(tasks.filter((t) => !t.completed).map((t) => t.id));
    for (const [id, notifId] of Object.entries(alerted)) {
      if (!activeIds.has(id)) {
        Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
        delete alerted[id];
      }
    }

    await AsyncStorage.setItem(overdueManifestKey(uid), JSON.stringify(alerted)).catch(() => {});
  });
};

// ── Internal helpers ──────────────────────────────────────────

// ── Notification sync — delegates to batch scheduler ─────────

/**
 * Kept for backward-compat call sites in useTasks.
 * Simply calls scheduleBatchReminders — all grouping logic lives there.
 */
export const syncNotificationWindow = async (tasks, bestTime, uid) => {
  await scheduleBatchReminders(tasks, bestTime, uid);
};

const _formatDue = (date) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueMidnight = new Date(date);
  dueMidnight.setHours(0, 0, 0, 0);
  const diff = Math.round((dueMidnight - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};
