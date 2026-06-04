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

  // Skip only if there's a real streak already counted today.
  // Allows count=0 to increment even if a stale date was written.
  if (lastDate === today && count > 0) return count;

  let newCount;
  if (lastDate === yesterday) {
    newCount = count + 1;
  } else if (count > 0 && !_hadTasksDuringGap(tasks, lastDate, today)) {
    // Gap but no tasks were due — don't penalise
    newCount = count + 1;
  } else {
    newCount = 1;
  }

  await AsyncStorage.multiSet([
    [streakKey(uid),     String(newCount)],
    [streakDateKey(uid), today],
  ]);
  return newCount;
};

/**
 * Called on app mount. Resets the streak COUNT to 0 if the user genuinely
 * missed a day (had tasks due but didn't complete them). Never writes the
 * date — only incrementStreak owns the date, so it can safely use
 * `lastDate === today` as the idempotency guard.
 */
export const checkAndResetStreak = async (uid, tasks = []) => {
  const { count, lastDate } = await loadStreak(uid);
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const isActive  = lastDate === today || lastDate === yesterday;

  if (!isActive && count > 0 && _hadTasksDuringGap(tasks, lastDate, today)) {
    // Genuine miss — reset count only, leave date alone so incrementStreak
    // can still fire today
    await AsyncStorage.setItem(streakKey(uid), "0");
    return 0;
  }

  return count;
};

export const clearStreak = async (uid) => {
  try {
    await AsyncStorage.multiRemove([streakKey(uid), streakDateKey(uid)]);
  } catch {}
};

// ── Plan streak — days where student completed ≥1 scheduled session ──────────

const planStreakKey      = (uid) => uid ? `@planora_plan_streak_${uid}`       : "@planora_plan_streak";
const planStreakDateKey  = (uid) => uid ? `@planora_plan_streak_date_${uid}`  : "@planora_plan_streak_date";
const planSessionDatesKey = (uid) => uid ? `@planora_plan_session_dates_${uid}` : "@planora_plan_session_dates";

export const loadPlanStreak = async (uid) => {
  try {
    const results  = await AsyncStorage.multiGet([planStreakKey(uid), planStreakDateKey(uid)]);
    const countVal = results[0][1];
    const dateVal  = results[1][1];
    const count    = countVal ? parseInt(countVal, 10) : 0;
    return { count: isNaN(count) ? 0 : count, lastDate: dateVal };
  } catch {
    return { count: 0, lastDate: null };
  }
};

// Call when a plan is generated/updated — saves which dates have sessions scheduled.
// incrementPlanStreak reads these to distinguish rest days from missed days.
export const savePlanSessionDates = async (uid, sessions) => {
  const dates = [...new Set((sessions ?? [])
    .filter((s) => !s.completed && !s.missed)
    .map((s) => s.date),
  )];
  await AsyncStorage.setItem(planSessionDatesKey(uid), JSON.stringify(dates)).catch(() => {});
};

// Returns true if any date strictly between lastDate and today had sessions scheduled.
const _gapHasScheduledSessions = (plannedDates, lastDate, today) => {
  if (!lastDate || !plannedDates || plannedDates.length === 0) return false;
  const plannedSet = new Set(plannedDates);
  const cur = new Date(lastDate + "T00:00:00");
  const tod = new Date(today   + "T00:00:00");
  cur.setDate(cur.getDate() + 1); // start the day after lastDate
  while (cur < tod) {
    if (plannedSet.has(cur.toISOString().slice(0, 10))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
};

// Returns the new plan streak count. Idempotent within a single day.
// Rest days (no sessions scheduled) carry the streak forward without incrementing.
// Gap days WITH scheduled sessions that weren't completed break the streak.
export const incrementPlanStreak = async (uid) => {
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const { count, lastDate } = await loadPlanStreak(uid);

  if (lastDate === today && count > 0) return count;

  let newCount;
  if (lastDate === yesterday) {
    newCount = count + 1;
  } else if (count > 0) {
    // Gap of 2+ days. Check whether those gap days had sessions.
    const gapDays = Math.round(
      (new Date(today + "T00:00:00") - new Date(lastDate + "T00:00:00")) / 86400000
    );
    if (gapDays > 14) {
      // Streak too stale to recover regardless
      newCount = 1;
    } else {
      const raw = await AsyncStorage.getItem(planSessionDatesKey(uid)).catch(() => null);
      const plannedDates = raw ? JSON.parse(raw) : [];
      newCount = _gapHasScheduledSessions(plannedDates, lastDate, today) ? 1 : count + 1;
    }
  } else {
    newCount = 1;
  }

  await AsyncStorage.multiSet([
    [planStreakKey(uid),     String(newCount)],
    [planStreakDateKey(uid), today],
  ]);
  return newCount;
};
