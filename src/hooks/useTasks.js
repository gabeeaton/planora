// ============================================================
// src/hooks/useTasks.js
// Context-based — one Firestore listener shared across all screens.
// Notification strategy: batch-based (scheduleBatchReminders).
//   - All mutations call scheduleBatchReminders with updated task list.
//   - syncNotificationWindow (12s debounce) handles quiet background sync.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  subscribeTasks,
  addTask,
  updateTask,
  batchUpdateTasks,
  toggleTask,
  deleteTask,
  recordTaskCompletion,
  removeTaskHistory,
  loadTaskHistory,
  clearCompletedTasks,
  auth,
} from "../services/firebase";
import {
  cacheTasksLocally,
  loadCachedTasks,
  cacheTaskHistory,
  loadCachedHistory,
} from "../services/offlineStorage";
import {
  updateOverdueBadge,
  scheduleDailyDigest,
  scheduleWeeklySummary,
  scheduleBatchReminders,
  scheduleOverdueNudges,
  syncNotificationWindow,
} from "../services/notifications";
import { spawnNextRecurringTask } from "../services/recurringTasks";
import { analyzePatterns } from "../services/patternAnalysis";
import { suggestPriorities } from "../services/openai";
import { isPriorityStale } from "../utils/priority";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";
import {
  getTodayString,
  getYesterdayString,
  loadStreak,
  incrementStreak,
  checkAndResetStreak,
} from "../utils/streakHelpers";

const TasksContext = createContext(null);
const SHARE_KEY  = (uid) => `@planora_last_share_${uid}`;
const REVIEW_KEY = (uid) => `@planora_review_asked_${uid}`;
const TOTAL_COMPLETIONS_KEY = (uid) => `@planora_total_completions_${uid}`;

export const TasksProvider = ({ children }) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [streak, setStreak] = useState(0);
  const [recentlyCompleted, setRecentlyCompleted] = useState(null); // task shown in share sheet

  const tasksRef = useRef([]);
  const lastEditTimeRef = useRef(0);
  const priorityRecalcDone = useRef(false);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const bestTimeRef = useRef(null);
  useEffect(() => {
    bestTimeRef.current = patterns?.productiveTimeOfDay?.bestTime ?? null;
  }, [patterns?.productiveTimeOfDay?.bestTime]);

  const streakChecked = useRef(false);
  useEffect(() => {
    if (!user?.uid || loading || streakChecked.current) return;
    streakChecked.current = true;
    checkAndResetStreak(user.uid, tasks).then(setStreak).catch(() => {});
  }, [user?.uid, loading]);

  useEffect(() => {
    if (tasks.length > 0 || history.length > 0) {
      setPatterns(analyzePatterns(tasks, history, profile));
    }
  }, [tasks, history]);

  useEffect(() => { updateOverdueBadge(tasks); }, [tasks]);

  // Background priority recalculation — runs once per session after tasks load.
  // Finds tasks whose stored priority is stale (due date crossed a tier boundary)
  // and silently updates them via the AI + Firestore.
  useEffect(() => {
    if (priorityRecalcDone.current || loading || !user?.uid || tasks.length === 0) return;
    const staleTasks = tasks.filter((t) => !t.completed && isPriorityStale(t));
    if (staleTasks.length === 0) { priorityRecalcDone.current = true; return; }
    priorityRecalcDone.current = true;

    // Delay 12s so auth.currentUser is guaranteed to be ready (tasks may load from cache first)
    const timer = setTimeout(async () => {
      if (!auth.currentUser) return;
      const RECALC_KEY = "@tf_priority_recalc_at";
      try {
        const raw = await AsyncStorage.getItem(RECALC_KEY);
        const last = raw ? parseInt(raw, 10) : 0;
        if (Date.now() - last < 6 * 60 * 60 * 1000) return; // at most once per 6 hours
        await AsyncStorage.setItem(RECALC_KEY, String(Date.now()));
        // Cap at 15 tasks per call — prioritize those without any AI rank yet
        const unranked = staleTasks.filter((t) => !t.aiPriority).slice(0, 8);
        const ranked   = staleTasks.filter((t) =>  t.aiPriority).slice(0, 7);
        const batch    = [...unranked, ...ranked];
        const updated = await suggestPriorities(batch, patterns, profile);
        const changed = updated.filter((t) => {
          const orig = staleTasks.find((s) => s.id === t.id);
          return orig && t.aiPriority !== orig.aiPriority;
        });
        if (changed.length > 0) {
          // Single batch write → Firestore listener fires once, no overlapping re-renders
          await batchUpdateTasks(
            changed.map((t) => ({ taskId: t.id, data: { aiPriority: t.aiPriority, aiReason: t.aiReason } }))
          );
        }
      } catch {
        // silent — background optimization
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [loading, user?.uid, tasks.length]);

  useEffect(() => {
    if (!user?.uid) return;
    const timer = setTimeout(() => {
      scheduleDailyDigest(tasks, bestTimeRef.current, user.uid);
    }, 12000);
    return () => clearTimeout(timer);
  }, [tasks, user?.uid, patterns?.productiveTimeOfDay?.bestTime]);

  useEffect(() => {
    if (!user?.uid) return;
    const timer = setTimeout(() => {
      scheduleOverdueNudges(tasks, bestTimeRef.current, user.uid);
    }, 12000);
    return () => clearTimeout(timer);
  }, [tasks, user?.uid]);

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
    Promise.all([loadCachedTasks(), loadCachedHistory()]).then(
      ([cachedTasks, cachedHistory]) => {
        if (cachedTasks.length > 0) {
          const sanitized = cachedTasks.map((t) => ({
            ...t,
            className: typeof t.className === "string" ? t.className : t.className?.name ?? null,
          }));
          setTasks(sanitized);
          setLoading(false);
        }
        if (cachedHistory.length > 0) setHistory(cachedHistory);
      }
    );

    const unsubscribe = subscribeTasks(user.uid, (freshTasks) => {
      setTasks(freshTasks);
      cacheTasksLocally(freshTasks);
      setLoading(false);
    });

    loadTaskHistory(user.uid, 100)
      .then((freshHistory) => { setHistory(freshHistory); cacheTaskHistory(freshHistory); })
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

  const createTask = useCallback(async (taskData) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const docRef = await addTask(user.uid, taskData);
      const optimistic = [...tasksRef.current, { ...taskData, id: docRef.id, completed: false }];
      scheduleBatchReminders(optimistic, bestTimeRef.current, user.uid).catch(() => {});
      return docRef;
    } catch (err) {
      const msg = err.message?.includes("permission") ? "Permission denied. Please sign in again." : err.message || "Failed to create task.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  const createManyTasks = useCallback(async (tasksArray) => {
    if (!user) throw new Error("Not logged in.");
    try {
      const existingCanvasIds = new Set(tasksRef.current.filter((t) => t.canvasId).map((t) => String(t.canvasId)));
      const existingIcsUids = new Set(tasksRef.current.filter((t) => t.icsUid).map((t) => String(t.icsUid)));
      const toCreate = tasksArray.filter(
        (t) => (!t.canvasId || !existingCanvasIds.has(String(t.canvasId))) && (!t.icsUid || !existingIcsUids.has(String(t.icsUid)))
      );
      const skipped = tasksArray.length - toCreate.length;
      if (toCreate.length === 0) return { created: 0, skipped };
      const docRefs = await Promise.all(toCreate.map((t) => addTask(user.uid, t)));
      const newTasks = toCreate.map((t, i) => ({ ...t, id: docRefs[i].id, completed: false }));
      const optimistic = [...tasksRef.current, ...newTasks];
      scheduleBatchReminders(optimistic, bestTimeRef.current, user.uid).catch(() => {});
      return { created: toCreate.length, skipped };
    } catch (err) {
      const msg = err.message || "Failed to import tasks.";
      setError(msg);
      throw new Error(msg);
    }
  }, [user]);

  const editTask = useCallback(async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
      if ("dueDate" in updates || "dueTime" in updates) {
        lastEditTimeRef.current = Date.now();
        const updatedTasks = tasksRef.current.map((t) => t.id === taskId ? { ...t, ...updates } : t);
        scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
      }
    } catch (err) {
      const msg = err.message?.includes("permission") ? "Permission denied." : err.message || "Failed to update task.";
      setError(msg);
      throw new Error(msg);
    }
  }, [tasks, user]);

  const completeTask = useCallback(async (task) => {
    try {
      await toggleTask(task.id, task.completed);
      if (!task.completed) {
        // ── Completing ────────────────────────────────────────
        incrementStreak(user?.uid, tasksRef.current)
          .then((newStreak) => {
            setStreak(newStreak);
            const MILESTONES = new Set([3, 7, 14, 30, 60, 100]);
            if (MILESTONES.has(newStreak)) {
              setRecentlyCompleted({ ...task, _streakAtCompletion: newStreak });
            }
          })
          .catch(() => {}); // never touch streak state on error
        if (task.recurrence) spawnNextRecurringTask({ ...task, userId: user.uid }).catch(() => {});
        recordTaskCompletion({ ...task, userId: user.uid }).catch(() => {});
        // In-app review — fire once after 5th total completion
        (async () => {
          try {
            const asked = await AsyncStorage.getItem(REVIEW_KEY(user?.uid));
            if (asked) return;
            const raw = await AsyncStorage.getItem(TOTAL_COMPLETIONS_KEY(user?.uid));
            const count = (raw ? parseInt(raw, 10) : 0) + 1;
            await AsyncStorage.setItem(TOTAL_COMPLETIONS_KEY(user?.uid), String(count));
            if (count === 5) {
              await AsyncStorage.setItem(REVIEW_KEY(user?.uid), "1");
              setTimeout(async () => {
                try {
                  // Lazy require — no-ops in Expo Go, works in production build
                  const StoreReview = require("expo-store-review");
                  if (await StoreReview.hasAction()) await StoreReview.requestReview();
                } catch {}
              }, 1500);
            }
          } catch {}
        })();
        const updatedTasks = tasksRef.current.map((t) => t.id === task.id ? { ...t, completed: true } : t);
        scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
        loadTaskHistory(user.uid, 100).then((fresh) => { setHistory(fresh); cacheTaskHistory(fresh); }).catch(() => {});
      } else {
        // ── Undoing completion ────────────────────────────────
        removeTaskHistory(task.id).catch(() => {}); // clean up pattern data
        const updatedTasks = tasksRef.current.map((t) => t.id === task.id ? { ...t, completed: false } : t);
        scheduleBatchReminders(updatedTasks, bestTimeRef.current, user?.uid).catch(() => {});
        loadTaskHistory(user.uid, 100).then((fresh) => { setHistory(fresh); cacheTaskHistory(fresh); }).catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Failed to update task.");
    }
  }, [user]);

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

  const clearCompleted = useCallback(async () => {
    if (!user) return 0;
    try {
      const result = await clearCompletedTasks(user.uid);
      const remaining = tasksRef.current.filter((t) => !t.completed);
      scheduleBatchReminders(remaining, bestTimeRef.current, user.uid).catch(() => {});
      return result;
    } catch (err) {
      setError(err.message || "Failed to clear completed tasks.");
      throw err;
    }
  }, [user]);

  const pendingTasks   = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const todaysTasks    = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const today = new Date();
    const due   = new Date(t.dueDate);
    return due.getDate() === today.getDate() && due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
  });

  const clearRecentlyCompleted = useCallback(() => setRecentlyCompleted(null), []);

  const value = { tasks, pendingTasks, completedTasks, todaysTasks, loading, error, patterns, streak, recentlyCompleted, clearRecentlyCompleted, createTask, createManyTasks, editTask, completeTask, removeTask, clearCompleted };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
};
