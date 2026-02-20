// ============================================================
// src/hooks/useTasks.js
// Updated — spawns next recurring task on completion
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  subscribeTasks, addTask, updateTask,
  toggleTask, deleteTask, recordTaskCompletion,
} from "../services/firebase";
import { cacheTasksLocally, loadCachedTasks } from "../services/offlineStorage";
import { scheduleTaskReminder, cancelTaskReminder } from "../services/notifications";
import { spawnNextRecurringTask } from "../services/recurringTasks";
import { useAuth } from "./useAuth";

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [patterns, setPatterns] = useState(null);

  useEffect(() => {
    if (!user) { setTasks([]); setLoading(false); return; }

    loadCachedTasks().then((cached) => {
      if (cached.length > 0) { setTasks(cached); setLoading(false); }
    });

    const unsubscribe = subscribeTasks(user.uid, (freshTasks) => {
      setTasks(freshTasks);
      cacheTasksLocally(freshTasks);
      setLoading(false);
    });

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
      // If completing (not uncompleting) a recurring task, spawn the next instance
      if (!task.completed && task.recurrence) {
        await spawnNextRecurringTask({ ...task, userId: user.uid });
      }
      // Record to history for pattern analysis
      if (!task.completed) {
        await recordTaskCompletion({ ...task, userId: user.uid });
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