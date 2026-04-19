// ============================================================
// src/hooks/useTasks.js
// Updated: real notification scheduling wired in.
//   - createTask: schedules 24h + 2h reminders, stores notificationIds
//   - editTask: cancels old reminders, schedules new ones if date changed
//   - completeTask: cancels reminders on completion, increments streak
//   - removeTask: cancels reminders on delete
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  subscribeTasks,
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
  recordTaskCompletion,
  loadTaskHistory,
  clearCompletedTasks,
} from "../services/firebase";
import {
  cacheTasksLocally,
  loadCachedTasks,
  cacheTaskHistory,
  loadCachedHistory,
} from "../services/offlineStorage";
import {
  cancelTaskReminder,
  updateOverdueBadge,
  scheduleDailyDigest,
  scheduleWeeklySummary,
  scheduleBatchReminders,
  syncNotificationWindow,
} from "../services/notifications";
import { spawnNextRecurringTask } from "../services/recurringTasks";
import { analyzePatterns } from "../services/patternAnalysis";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";
import {
  getTodayString,
  getYesterdayString,
  loadStreak,
  incrementStreak,
  checkAndResetStreak,
} from "../utils/streakHelpers";

export const useTasks = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [streak, setStreak] = useState(0);

  // Keep a ref so createManyTasks can read current tasks without stale closure
  const tasksRef = useRef([]);
  const pendingTaskIdsRef = useRef(new Set());
  const lastEditTimeRef = useRef(0);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Keep bestTime in a ref so reminder scheduling always uses the latest value
  // without needing to add patterns to every useCallback dep array
  const bestTimeRef = useRef(null);
  useEffect(() => {
    bestTimeRef.current = patterns?.productiveTimeOfDay?.bestTime ?? null;
  }, [patterns?.productiveTimeOfDay?.bestTime]);

  // Load persisted streak on mount — resets if user missed a day
  useEffect(() => {
    if (!user?.uid) return;
    checkAndResetStreak(user.uid)
      .then(setStreak)
      .catch(() => {});
  }, [user?.uid]);

  // Recompute patterns whenever tasks or history change
  useEffect(() => {
    if (tasks.length > 0 || history.length > 0) {
      setPatterns(analyzePatterns(tasks, history, profile));
    }
  }, [tasks, history]);

  // Keep app icon badge in sync with overdue count
  useEffect(() => {
    updateOverdueBadge(tasks);
  }, [tasks]);

  // Reschedule morning digest whenever tasks or productive time changes
  useEffect(() => {
    if (!user?.uid) return;

    const timer = setTimeout(() => {
      scheduleDailyDigest(tasks, bestTimeRef.current, user.uid);
    }, 12000);

    return () => clearTimeout(timer);
  }, [tasks, user?.uid, patterns?.productiveTimeOfDay?.bestTime]);

  // Reschedule weekly summary whenever tasks, history, or productive time changes
  useEffect(() => {
    if (!user?.uid) return;

    const timer = setTimeout(() => {
      scheduleWeeklySummary(tasks, history, user.uid);
    }, 12000);

    return () => clearTimeout(timer);
  }, [tasks, history, user?.uid, patterns?.productiveTimeOfDay?.bestTime]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    // Load cached data immediately for snappy offline-first UI
    Promise.all([loadCachedTasks(), loadCachedHistory()]).then(
      ([cachedTasks, cachedHistory]) => {
        if (cachedTasks.length > 0) {
          const sanitized = cachedTasks.map((t) => ({
            ...t,
            className:
              typeof t.className === "string"
                ? t.className
                : t.className?.name ?? null,
          }));
          setTasks(sanitized);
          setLoading(false);
        }
        if (cachedHistory.length > 0) {
          setHistory(cachedHistory);
        }
      }
    );

    // Subscribe to live task updates
    const unsubscribe = subscribeTasks(user.uid, (freshTasks) => {
      setTasks(freshTasks);
      cacheTasksLocally(freshTasks);
      setLoading(false);
    });

    // Load full task history for pattern analysis (non-blocking)
    loadTaskHistory(user.uid, 100)
      .then((freshHistory) => {
        setHistory(freshHistory);
        cacheTaskHistory(freshHistory);
      })
      .catch(() => {});

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user?.uid || tasks.length === 0) return;

    const timer = setTimeout(() => {
      if (Date.now() - lastEditTimeRef.current < 15_000) return;
      syncNotificationWindow(tasks, bestTimeRef.current, user.uid);
    }, 12000);

    return () => clearTimeout(timer);
  }, [tasks, user?.uid]);

  // ── Create task ─────────────────────────────────────────────

  const createTask = useCallback(
    async (taskData) => {
      if (!user) throw new Error("Not logged in.");
      try {
        const docRef = await addTask(user.uid, taskData);
        // Mark as pending so syncNotificationWindow skips it until
        // Firestore propagates the doc back through the snapshot listener.
        // syncNotificationWindow will schedule the reminder on the next
        // tasks-state update once the task has an ID in the snapshot.
        pendingTaskIdsRef.current.add(docRef.id);
        setTimeout(() => pendingTaskIdsRef.current.delete(docRef.id), 10_000);
        return docRef;
      } catch (err) {
        const msg = err.message?.includes("permission")
          ? "Permission denied. Please sign in again."
          : err.message || "Failed to create task.";
        setError(msg);
        throw new Error(msg);
      }
    },
    [user]
  );

  // ── Create many tasks (bulk import) ────────────────────────

  const createManyTasks = useCallback(
    async (tasksArray) => {
      if (!user) throw new Error("Not logged in.");
      try {
        // Deduplicate re-imports: skip tasks whose canvasId or icsUid already exists
        const existingCanvasIds = new Set(
          tasksRef.current
            .filter((t) => t.canvasId)
            .map((t) => String(t.canvasId))
        );
        const existingIcsUids = new Set(
          tasksRef.current.filter((t) => t.icsUid).map((t) => String(t.icsUid))
        );
        const toCreate = tasksArray.filter(
          (t) =>
            (!t.canvasId || !existingCanvasIds.has(String(t.canvasId))) &&
            (!t.icsUid || !existingIcsUids.has(String(t.icsUid)))
        );
        const skipped = tasksArray.length - toCreate.length;

        if (toCreate.length === 0) return { created: 0, skipped };

        const docRefs = await Promise.all(
          toCreate.map((t) => addTask(user.uid, t))
        );

        // once Firestore propagates the docs back through the snapshot listener
        docRefs.forEach((docRef) => {
          pendingTaskIdsRef.current.add(docRef.id);
          setTimeout(() => pendingTaskIdsRef.current.delete(docRef.id), 10_000);
        });

        return { created: toCreate.length, skipped };
      } catch (err) {
        const msg = err.message || "Failed to import tasks.";
        setError(msg);
        throw new Error(msg);
      }
    },
    [user]
  );

  // ── Edit task ───────────────────────────────────────────────

  const editTask = useCallback(
    async (taskId, updates) => {
      try {
        await updateTask(taskId, updates);

        // Reschedule batch notifications immediately when date/time changes
        if ("dueDate" in updates || "dueTime" in updates) {
          lastEditTimeRef.current = Date.now();
          const updatedTasks = tasksRef.current.map((t) =>
            t.id === taskId ? { ...t, ...updates } : t
          );
          scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
        }
      } catch (err) {
        const msg = err.message?.includes("permission")
          ? "Permission denied."
          : err.message || "Failed to update task.";
        setError(msg);
        throw new Error(msg);
      }
    },
    [tasks, user]
  );

  // ── Complete / toggle task ──────────────────────────────────

  const completeTask = useCallback(
    async (task) => {
      try {
        await toggleTask(task.id, task.completed);

        if (!task.completed) {
          // Task is being marked complete

          // Increment streak — guarded inside incrementStreak so re-completing
          // the same task today won't double-count
          incrementStreak(user?.uid)
            .then((newCount) => {
              setStreak(newCount);
            })
            .catch(() => {});

          // Spawn next occurrence for recurring tasks
          if (task.recurrence) {
            await spawnNextRecurringTask({ ...task, userId: user.uid });
          }

          // Record for pattern analysis
          await recordTaskCompletion({ ...task, userId: user.uid });

          // Reschedule batch reminders excluding this completed task
          const updatedTasks = tasksRef.current.map((t) =>
            t.id === task.id ? { ...t, completed: true } : t
          );
          scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});

          // Refresh history so patterns update after completion
          loadTaskHistory(user.uid, 100)
            .then((fresh) => {
              setHistory(fresh);
              cacheTaskHistory(fresh);
            })
            .catch(() => {});
        } else {
          // Task is being un-completed — reschedule batch with it included
          const updatedTasks = tasksRef.current.map((t) =>
            t.id === task.id ? { ...t, completed: false } : t
          );
          scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
        }
      } catch (err) {
        setError(err.message || "Failed to update task.");
      }
    },
    [user]
  );

  // ── Delete task ─────────────────────────────────────────────

  const removeTask = useCallback(async (taskId) => {
    try {
      await deleteTask(taskId);
      const updatedTasks = tasksRef.current.filter((t) => t.id !== taskId);
      scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
    } catch (err) {
      const msg = err.message || "Failed to delete task.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  // ── Clear all completed tasks ───────────────────────────────

  const clearCompleted = useCallback(async () => {
    if (!user) return 0;
    try {
      // Cancel any lingering reminders on completed tasks
      const completed = tasks.filter((t) => t.completed);
      await Promise.all(
        completed
          .filter((t) => t.notificationIds)
          .map((t) => cancelTaskReminder(t.notificationIds).catch(() => {}))
      );
      return await clearCompletedTasks(user.uid);
    } catch (err) {
      setError(err.message || "Failed to clear completed tasks.");
      throw err;
    }
  }, [user, tasks]);

  // ── Derived lists ───────────────────────────────────────────

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const todaysTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const today = new Date();
    const due = new Date(t.dueDate);
    return (
      due.getDate() === today.getDate() &&
      due.getMonth() === today.getMonth() &&
      due.getFullYear() === today.getFullYear()
    );
  });

  return {
    tasks,
    pendingTasks,
    completedTasks,
    todaysTasks,
    loading,
    error,
    patterns,
    streak,
    createTask,
    createManyTasks,
    editTask,
    completeTask,
    removeTask,
    clearCompleted,
  };
};
