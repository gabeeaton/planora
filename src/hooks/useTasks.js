// ============================================================
// src/hooks/useTasks.js
// Fixed: pattern analysis now wired up correctly
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  subscribeTasks, addTask, updateTask,
  toggleTask, deleteTask, recordTaskCompletion,
  loadTaskHistory,
} from "../services/firebase";
import { cacheTasksLocally, loadCachedTasks, cacheTaskHistory, loadCachedHistory } from "../services/offlineStorage";
import { scheduleTaskReminder, cancelTaskReminder } from "../services/notifications";
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
        // Sanitize className on cache read — old cached data may have full class objects
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
    }).catch(() => {}); // Non-critical — patterns just won't be available

    return unsubscribe;
  }, [user]);

  const createTask = useCallback(async (taskData) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const docRef = await addTask(user.uid, taskData);
      if (taskData.dueDate) {
        await scheduleTaskReminder({ id: docRef.id, ...taskData });
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

  const createManyTasks = useCallback(async (tasksArray) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const promises = tasksArray.map((t) => addTask(user.uid, t));
      await Promise.all(promises);
    } catch (err) {
      const msg = err.message || "Failed to import tasks.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  const editTask = useCallback(async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
    } catch (err) {
      const msg = err.message?.includes("permission")
        ? "Permission denied."
        : err.message || "Failed to update task.";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const completeTask = useCallback(async (task) => {
    try {
      await toggleTask(task.id, task.completed);
      if (!task.completed && task.recurrence) {
        await spawnNextRecurringTask({ ...task, userId: user.uid });
      }
      if (!task.completed) {
        await recordTaskCompletion({ ...task, userId: user.uid });
        // Refresh history so patterns update after completion
        loadTaskHistory(user.uid, 100).then((fresh) => {
          setHistory(fresh);
          cacheTaskHistory(fresh);
        }).catch(() => {});
      }
      if (!task.completed && task.notificationId) {
        await cancelTaskReminder(task.notificationId);
      }
    } catch (err) {
      setError(err.message || "Failed to update task.");
    }
  }, [user]);

  const removeTask = useCallback(async (taskId, notificationId) => {
    try {
      await deleteTask(taskId);
      if (notificationId) await cancelTaskReminder(notificationId);
    } catch (err) {
      const msg = err.message || "Failed to delete task.";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

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