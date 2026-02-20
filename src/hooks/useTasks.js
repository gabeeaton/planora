import { useState, useEffect, useCallback } from "react";
import {
  subscribeTasks,
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
} from "../services/firebase";
import { cacheTasksLocally, loadCachedTasks } from "../services/offlineStorage";
import { scheduleTaskReminder, cancelTaskReminder } from "../services/notifications";
import { useAuth } from "./useAuth";

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    // Load cached tasks immediately for snappy UI
    loadCachedTasks().then((cached) => {
      if (cached.length > 0) {
        setTasks(cached);
        setLoading(false);
      }
    });

    // Subscribe to Firestore real-time updates
    const unsubscribe = subscribeTasks(user.uid, (freshTasks) => {
      setTasks(freshTasks);
      cacheTasksLocally(freshTasks);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const createTask = useCallback(async (taskData) => {
    try {
      const docRef = await addTask(user.uid, taskData);
      if (taskData.dueDate) {
        await scheduleTaskReminder({ id: docRef.id, ...taskData });
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [user]);

  const editTask = useCallback(async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const completeTask = useCallback(async (taskId, currentStatus, notificationId) => {
    try {
      await toggleTask(taskId, currentStatus);
      if (!currentStatus && notificationId) {
        await cancelTaskReminder(notificationId);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const removeTask = useCallback(async (taskId, notificationId) => {
    try {
      await deleteTask(taskId);
      if (notificationId) await cancelTaskReminder(notificationId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

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
    createTask,
    editTask,
    completeTask,
    removeTask,
  };
};