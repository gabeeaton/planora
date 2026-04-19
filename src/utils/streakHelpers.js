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

export const incrementStreak = async (uid) => {
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const { count, lastDate } = await loadStreak(uid);

  // Already counted today — idempotent, safe to call multiple times
  if (lastDate === today) return count;

  // Continuing streak from yesterday, or starting fresh
  const newCount = lastDate === yesterday ? count + 1 : 1;
  await AsyncStorage.multiSet([
    [streakKey(uid),     String(newCount)],
    [streakDateKey(uid), today],
  ]);
  return newCount;
};

/**
 * Called on app mount. Resets streak if the user missed a day.
 * Returns the current valid streak count.
 */
export const checkAndResetStreak = async (uid) => {
  const { count, lastDate } = await loadStreak(uid);
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const isActive  = lastDate === today || lastDate === yesterday;

  if (!isActive && count > 0) {
    await AsyncStorage.multiSet([
      [streakKey(uid),     "0"],
      [streakDateKey(uid), ""],
    ]);
    return 0;
  }
  return count;
};

export const clearStreak = async (uid) => {
  try {
    await AsyncStorage.multiRemove([streakKey(uid), streakDateKey(uid)]);
  } catch {}
};
