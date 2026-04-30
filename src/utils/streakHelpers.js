// ============================================================
// src/utils/streakHelpers.js
// Pure streak logic extracted for testability.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const streakKey     = (uid) => uid ? `@planora_streak_${uid}`      : "@planora_streak";
const streakDateKey = (uid) => uid ? `@planora_streak_date_${uid}` : "@planora_streak_date";

// Keep bare exports for legacy callers / tests
export const STREAK_KEY      = "@planora_streak";
export const STREAK_DATE_KEY = "@planora_streak_date";

export const getTodayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const loadStreak = async (uid) => {
  try {
    const results  = await AsyncStorage.multiGet([streakKey(uid), streakDateKey(uid)]);
    const countVal = results[0][1];
    const dateVal  = results[1][1];
    const count    = countVal ? parseInt(countVal, 10) : 0;
    return { count: isNaN(count) ? 0 : count, lastDate: dateVal };
  } catch {
    return { count: 0, lastDate: null };
  }
};

const _hadTasksDuringGap = (tasks, lastDate, today) => {
  if (!lastDate) return false;
  const last = new Date(lastDate + "T00:00:00");
  const tod  = new Date(today  + "T00:00:00");
  // Grace period capped at 14 days — covers any real academic break (spring break,
  // sick week, etc.) without letting a semester-old streak survive all summer.
  const gapDays = Math.round((tod - last) / (1000 * 60 * 60 * 24));
  if (gapDays > 14) return true; // treat long gaps as a genuine miss regardless of tasks
  return tasks.some((t) => {
    if (!t.dueDate || t.completed) return false;
    const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
    return !isNaN(d) && d > last && d < tod;
  });
};

export const incrementStreak = async (uid, tasks = []) => {
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const { count, lastDate } = await loadStreak(uid);

  // Already counted today — idempotent, safe to call multiple times
  if (lastDate === today) return count;

  let newCount;
  if (lastDate === yesterday) {
    // Normal: consecutive day
    newCount = count + 1;
  } else if (count > 0 && !_hadTasksDuringGap(tasks, lastDate, today)) {
    // Gap exists but no tasks were due during it — don't break the streak
    newCount = count + 1;
  } else {
    // Genuine miss: tasks were due but not completed
    newCount = 1;
  }

  await AsyncStorage.multiSet([
    [streakKey(uid),     String(newCount)],
    [streakDateKey(uid), today],
  ]);
  return newCount;
};

/**
 * Called on app mount. Resets streak if the user missed a day, then touches
 * today's date so opening the app protects the streak even with no tasks.
 * Returns the current valid streak count.
 */
export const checkAndResetStreak = async (uid, tasks = []) => {
  const { count, lastDate } = await loadStreak(uid);
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const isActive  = lastDate === today || lastDate === yesterday;

  if (!isActive && count > 0) {
    // Before resetting, check if the gap had any tasks due.
    // If not, the user had nothing to complete — don't penalise them.
    if (!_hadTasksDuringGap(tasks, lastDate, today)) {
      await AsyncStorage.setItem(streakDateKey(uid), today);
      return count;
    }
    await AsyncStorage.multiSet([
      [streakKey(uid),     "0"],
      [streakDateKey(uid), today],
    ]);
    return 0;
  }

  // Touch today so tomorrow's check sees the streak as active
  if (lastDate !== today) {
    await AsyncStorage.setItem(streakDateKey(uid), today);
  }
  return count;
};

export const clearStreak = async (uid) => {
  try {
    await AsyncStorage.multiRemove([streakKey(uid), streakDateKey(uid)]);
  } catch {}
};
