// ============================================================
// src/hooks/useTasks.js
// Updated: real notification scheduling wired in.
//   - createTask: schedules 24h + 2h reminders, stores notificationIds
//   - editTask: cancels old reminders, schedules new ones if date changed
//   - completeTask: cancels reminders on completion, increments streak
//   - removeTask: cancels reminders on delete
// ============================================================

import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  subscribeTasks, addTask, updateTask,
  toggleTask, deleteTask, recordTaskCompletion,
  loadTaskHistory,
} from "../services/firebase";
import { cacheTasksLocally, loadCachedTasks, cacheTaskHistory, loadCachedHistory } from "../services/offlineStorage";
import {
  scheduleTaskReminder,
  cancelTaskReminder,
  cancelAllReminders,
} from "../services/notifications";
import { spawnNextRecurringTask } from "../services/recurringTasks";
import { analyzePatterns } from "../services/patternAnalysis";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";

// ── Streak helpers ──────────────────────────────────────────
const STREAK_KEY      = "@planora_streak";
const STREAK_DATE_KEY = "@planora_streak_date";

const getTodayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const loadStreak = async () => {
  try {
    const results  = await AsyncStorage.multiGet([STREAK_KEY, STREAK_DATE_KEY]);
    const countVal = results[0][1];
    const dateVal  = results[1][1];
    const count    = countVal ? parseInt(countVal, 10) : 0;
    return { count: isNaN(count) ? 0 : count, lastDate: dateVal };
  } catch {
    return { count: 0, lastDate: null };
  }
};

const incrementStreak = async () => {
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const { count, lastDate } = await loadStreak();
  if (lastDate === today) {
    console.log("[streak] already incremented today:", count);
    return count;
  }
  const newCount = lastDate === yesterday ? count + 1 : 1;
  console.log("[streak] writing newCount:", newCount);
  await AsyncStorage.multiSet([
    [STREAK_KEY,      String(newCount)],
    [STREAK_DATE_KEY, today],
  ]);
  return newCount;
};

export const useTasks = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [tasks, setTasks]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [streak, setStreak]     = useState(0);

  // Load persisted streak on mount — also resets if user missed a day
  useEffect(() => {
    loadStreak().then(({ count, lastDate }) => {
      const today     = getTodayString();
      const yesterday = getYesterdayString();
      if (lastDate !== today && lastDate !== yesterday) {
        // Missed at least one day — reset
        AsyncStorage.multiSet([
          [STREAK_KEY,      "0"],
          [STREAK_DATE_KEY, today],
        ]).catch(() => {});
        setStreak(0);
      } else {
        setStreak(count);
      }
    });
  }, []);

  // Recompute patterns whenever tasks or history change
  useEffect(() => {
    if (tasks.length > 0 || history.length > 0) {
      setPatterns(analyzePatterns(tasks, history, profile));
    }
  }, [tasks, history]);

  useEffect(() => {
    if (!user) { setTasks([]); setHistory([]); setLoading(false); return; }

    // Load cached data immediately for snappy offline-first UI
    Promise.all([loadCachedTasks(), loadCachedHistory()]).then(([cachedTasks, cachedHistory]) => {
      if (cachedTasks.length > 0) {
        const sanitized = cachedTasks.map((t) => ({
          ...t,
          className: typeof t.className === "string" ? t.className : (t.className?.name ?? null),
        }));
        setTasks(sanitized);
        setLoading(false);
      }
      if (cachedHistory.length > 0) {
        setHistory(cachedHistory);
      }
    });

    // Subscribe to live task updates
    const unsubscribe = subscribeTasks(user.uid, (freshTasks) => {
      setTasks(freshTasks);
      cacheTasksLocally(freshTasks);
      setLoading(false);
    });

    // Load full task history for pattern analysis (non-blocking)
    loadTaskHistory(user.uid, 100).then((freshHistory) => {
      setHistory(freshHistory);
      cacheTaskHistory(freshHistory);
    }).catch(() => {});

    return unsubscribe;
  }, [user]);

  // ── Create task ─────────────────────────────────────────────

  const createTask = useCallback(async (taskData) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const docRef = await addTask(user.uid, taskData);

      if (taskData.dueDate) {
        const notificationIds = await scheduleTaskReminder({
          id: docRef.id,
          ...taskData,
        });
        if (notificationIds.id24h || notificationIds.id2h) {
          await updateTask(docRef.id, { notificationIds }).catch(() => {});
        }
      }

      return docRef;
    } catch (err) {
      const msg = err.message?.includes("permission")
        ? "Permission denied. Please sign in again."
        : err.message || "Failed to create task.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  // ── Create many tasks (bulk import) ────────────────────────

  const createManyTasks = useCallback(async (tasksArray) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const docRefs = await Promise.all(tasksArray.map((t) => addTask(user.uid, t)));

      Promise.all(
        docRefs.map(async (docRef, i) => {
          const task = tasksArray[i];
          if (!task.dueDate) return;
          const notificationIds = await scheduleTaskReminder({ id: docRef.id, ...task });
          if (notificationIds.id24h || notificationIds.id2h) {
            await updateTask(docRef.id, { notificationIds }).catch(() => {});
          }
        })
      ).catch(() => {});

    } catch (err) {
      const msg = err.message || "Failed to import tasks.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  // ── Edit task ───────────────────────────────────────────────

  const editTask = useCallback(async (taskId, updates) => {
    try {
      const currentTask = tasks.find((t) => t.id === taskId);

      if (currentTask && "dueDate" in updates) {
        const oldDue = currentTask.dueDate?.getTime?.() ?? null;
        const newDue = updates.dueDate ? new Date(updates.dueDate).getTime() : null;

        if (oldDue !== newDue) {
          if (currentTask.notificationIds) {
            await cancelTaskReminder(currentTask.notificationIds).catch(() => {});
          }

          if (updates.dueDate) {
            const notificationIds = await scheduleTaskReminder({
              id: taskId,
              title: updates.title ?? currentTask.title,
              priority: updates.priority ?? currentTask.priority,
              className: updates.className ?? currentTask.className,
              dueDate: updates.dueDate,
            });
            updates.notificationIds = (notificationIds.id24h || notificationIds.id2h)
              ? notificationIds
              : null;
          } else {
            updates.notificationIds = null;
          }
        }
      }

      await updateTask(taskId, updates);
    } catch (err) {
      const msg = err.message?.includes("permission")
        ? "Permission denied."
        : err.message || "Failed to update task.";
      setError(msg);
      throw new Error(msg);
    }
  }, [tasks]);

  // ── Complete / toggle task ──────────────────────────────────

  const completeTask = useCallback(async (task) => {
    try {
      await toggleTask(task.id, task.completed);

      if (!task.completed) {
        // Task is being marked complete

        // Increment streak — only fires on actual completion, not on app open
        incrementStreak().then((newCount) => {
          setStreak(newCount);
        }).catch((e) => console.log("[streak] error:", e));

        // Spawn next occurrence for recurring tasks
        if (task.recurrence) {
          await spawnNextRecurringTask({ ...task, userId: user.uid });
        }

        // Record for pattern analysis
        await recordTaskCompletion({ ...task, userId: user.uid });

        // Cancel reminders — no point reminding about a done task
        if (task.notificationIds) {
          await cancelTaskReminder(task.notificationIds).catch(() => {});
        }

        // Refresh history so patterns update after completion
        loadTaskHistory(user.uid, 100).then((fresh) => {
          setHistory(fresh);
          cacheTaskHistory(fresh);
        }).catch(() => {});

      } else {
        // Task is being un-completed — reschedule reminder if future due date
        if (task.dueDate && new Date(task.dueDate) > new Date()) {
          const notificationIds = await scheduleTaskReminder(task);
          if (notificationIds.id24h || notificationIds.id2h) {
            await updateTask(task.id, { notificationIds }).catch(() => {});
          }
        }
      }
    } catch (err) {
      setError(err.message || "Failed to update task.");
    }
  }, [user]);

  // ── Delete task ─────────────────────────────────────────────

  const removeTask = useCallback(async (taskId, notificationIds) => {
    try {
      await deleteTask(taskId);
      if (notificationIds) {
        await cancelTaskReminder(notificationIds).catch(() => {});
      }
    } catch (err) {
      const msg = err.message || "Failed to delete task.";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // ── Derived lists ───────────────────────────────────────────

  const pendingTasks   = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const todaysTasks    = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const today = new Date();
    const due   = new Date(t.dueDate);
    return (
      due.getDate()     === today.getDate()   &&
      due.getMonth()    === today.getMonth()  &&
      due.getFullYear() === today.getFullYear()
    );
  });

  return {
    tasks, pendingTasks, completedTasks, todaysTasks,
    loading, error, patterns, streak,
    createTask, createManyTasks, editTask, completeTask, removeTask,
  };
};