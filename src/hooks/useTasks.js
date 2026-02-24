// ============================================================
// src/hooks/useTasks.js
// Updated: real notification scheduling wired in.
//   - createTask: schedules 24h + 2h reminders, stores notificationIds
//   - editTask: cancels old reminders, schedules new ones if date changed
//   - completeTask: cancels reminders on completion
//   - removeTask: cancels reminders on delete
// ============================================================

import { useState, useEffect, useCallback } from "react";
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

export const useTasks = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [tasks, setTasks]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [patterns, setPatterns] = useState(null);

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

      // Schedule reminder and store the notification IDs back on the task
      if (taskData.dueDate) {
        const notificationIds = await scheduleTaskReminder({
          id: docRef.id,
          ...taskData,
        });
        // Only write back if we actually got IDs — avoids a pointless Firestore write
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
      // Create all tasks in parallel, then schedule reminders
      const docRefs = await Promise.all(tasksArray.map((t) => addTask(user.uid, t)));

      // Schedule reminders in the background — don't block the import UI
      Promise.all(
        docRefs.map(async (docRef, i) => {
          const task = tasksArray[i];
          if (!task.dueDate) return;
          const notificationIds = await scheduleTaskReminder({ id: docRef.id, ...task });
          if (notificationIds.id24h || notificationIds.id2h) {
            await updateTask(docRef.id, { notificationIds }).catch(() => {});
          }
        })
      ).catch(() => {}); // Non-critical

    } catch (err) {
      const msg = err.message || "Failed to import tasks.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  // ── Edit task ───────────────────────────────────────────────

  const editTask = useCallback(async (taskId, updates) => {
    try {
      // Find the current task to check if due date changed
      const currentTask = tasks.find((t) => t.id === taskId);

      // If the due date changed (or was added/removed), reschedule reminders
      if (currentTask && "dueDate" in updates) {
        const oldDue = currentTask.dueDate?.getTime?.() ?? null;
        const newDue = updates.dueDate ? new Date(updates.dueDate).getTime() : null;

        if (oldDue !== newDue) {
          // Cancel old reminders
          if (currentTask.notificationIds) {
            await cancelTaskReminder(currentTask.notificationIds).catch(() => {});
          }

          // Schedule new reminders if there's a new due date
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
            // Due date was cleared — remove stored IDs
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

        // Spawn next occurrence for recurring tasks
        if (task.recurrence) {
          await spawnNextRecurringTask({ ...task, userId: user.uid });
        }

        // Record for pattern analysis
        await recordTaskCompletion({ ...task, userId: user.uid });

        // Cancel the reminders — no point reminding about a done task
        if (task.notificationIds) {
          await cancelTaskReminder(task.notificationIds).catch(() => {});
        }

        // Refresh history so patterns update after completion
        loadTaskHistory(user.uid, 100).then((fresh) => {
          setHistory(fresh);
          cacheTaskHistory(fresh);
        }).catch(() => {});
      } else {
        // Task is being un-completed — reschedule reminder if it has a future due date
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
      // Cancel reminders — accept both old string format and new object format
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
    loading, error, patterns,
    createTask, createManyTasks, editTask, completeTask, removeTask,
  };
};