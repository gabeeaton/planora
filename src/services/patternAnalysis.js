// ============================================================
// src/services/patternAnalysis.js
// Pure local logic — NO API calls.
// Analyzes cached task history to find behavioral patterns.
// Output feeds into OpenAI prompts to make them personalized.
// ============================================================

/**
 * Master function — call this to get all pattern insights.
 * @param {Array} tasks        - Current tasks from Firestore
 * @param {Array} history      - Completed task history records
 * @param {Object} userProfile - User's academic profile
 * @returns {Object} patterns
 */
export const analyzePatterns = (tasks, history, userProfile) => {
  return {
    avoidanceScores:     getAvoidanceScores(tasks),
    completionByClass:   getCompletionPatternsByClass(history),
    latenessProfile:     getLatenessProfile(history),
    productiveTimeOfDay: getProductiveTimeOfDay(history),
    staleTasks:          getStaleTasks(tasks),
    urgentUntouched:     getUrgentUntouched(tasks),
    overallStats:        getOverallStats(tasks, history),
  };
};

/**
 * Avoidance score per task: how long has it been sitting
 * without being touched relative to its due date urgency?
 * Higher score = more likely being avoided.
 */
export const getAvoidanceScores = (tasks) => {
  const now = new Date();
  return tasks
    .filter((t) => !t.completed)
    .map((t) => {
      const createdAt    = t.createdAt ? new Date(t.createdAt) : now;
      const dueDate      = t.dueDate   ? new Date(t.dueDate)   : null;
      const lastTouched  = t.lastTouchedAt ? new Date(t.lastTouchedAt) : createdAt;

      const daysSinceTouched = Math.floor((now - lastTouched) / (1000 * 60 * 60 * 24));
      const daysUntilDue     = dueDate
        ? Math.floor((dueDate - now) / (1000 * 60 * 60 * 24))
        : null;

      // Avoidance score: days sitting untouched weighted by urgency
      let score = daysSinceTouched;
      if (daysUntilDue !== null) {
        if (daysUntilDue <= 1)  score *= 4; // Due today/tomorrow — critical
        else if (daysUntilDue <= 3)  score *= 2.5;
        else if (daysUntilDue <= 7)  score *= 1.5;
      }

      return {
        taskId:           t.id,
        title:            t.title,
        className:        t.className ?? null,
        score:            Math.round(score),
        daysSinceTouched,
        daysUntilDue,
        isBeingAvoided:   daysSinceTouched >= 3 && (daysUntilDue === null || daysUntilDue <= 7),
      };
    })
    .sort((a, b) => b.score - a.score);
};

/**
 * Per-class completion patterns from history.
 * Returns object keyed by classId with stats.
 */
export const getCompletionPatternsByClass = (history) => {
  const byClass = {};

  history.forEach((record) => {
    const key = record.classId ?? "untagged";
    if (!byClass[key]) {
      byClass[key] = {
        classId:           key,
        className:         record.className ?? "Untagged",
        completedCount:    0,
        lateCount:         0,
        totalDaysEarly:    0,
        daysBeforeList:    [],
      };
    }
    const c = byClass[key];
    c.completedCount++;
    if (record.daysBeforeDeadline !== null) {
      c.daysBeforeList.push(record.daysBeforeDeadline);
      c.totalDaysEarly += record.daysBeforeDeadline;
      if (record.daysBeforeDeadline < 0) c.lateCount++;
    }
  });

  // Compute averages
  Object.values(byClass).forEach((c) => {
    c.avgDaysBeforeDeadline = c.daysBeforeList.length
      ? Math.round(c.totalDaysEarly / c.daysBeforeList.length)
      : null;
    c.lateRate = c.completedCount
      ? Math.round((c.lateCount / c.completedCount) * 100)
      : 0;
    c.tendencyLabel =
      c.avgDaysBeforeDeadline === null ? "unknown"
      : c.avgDaysBeforeDeadline >= 3   ? "early"
      : c.avgDaysBeforeDeadline >= 0   ? "on-time"
      :                                   "late";
  });

  return byClass;
};

/**
 * Overall lateness profile for the user.
 */
export const getLatenessProfile = (history) => {
  const withDates = history.filter((h) => h.daysBeforeDeadline !== null);
  if (withDates.length === 0) return { label: "unknown", avgDaysBefore: null };

  const avg = withDates.reduce((sum, h) => sum + h.daysBeforeDeadline, 0) / withDates.length;
  const lateCount = withDates.filter((h) => h.daysBeforeDeadline < 0).length;
  const lateRate  = Math.round((lateCount / withDates.length) * 100);

  return {
    avgDaysBefore: Math.round(avg),
    lateRate,
    label: avg >= 3 ? "plans ahead" : avg >= 0 ? "last minute" : "often late",
    totalSamples: withDates.length,
  };
};

/**
 * What time of day does this user most often complete tasks?
 */
export const getProductiveTimeOfDay = (history) => {
  const counts = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  history.forEach((h) => {
    if (!h.completedAt) return;
    const hour = new Date(h.completedAt).getHours();
    if      (hour >= 5  && hour < 12) counts.morning++;
    else if (hour >= 12 && hour < 17) counts.afternoon++;
    else if (hour >= 17 && hour < 21) counts.evening++;
    else                               counts.night++;
  });

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { counts, bestTime: best[0], totalSamples: history.length };
};

/**
 * Tasks that haven't been touched in 3+ days.
 */
export const getStaleTasks = (tasks) => {
  const now = new Date();
  return tasks
    .filter((t) => {
      if (t.completed) return false;
      const lastTouched = t.lastTouchedAt ? new Date(t.lastTouchedAt) : (t.createdAt ? new Date(t.createdAt) : now);
      const daysSince   = Math.floor((now - lastTouched) / (1000 * 60 * 60 * 24));
      return daysSince >= 3;
    })
    .map((t) => ({
      ...t,
      daysSinceTouched: Math.floor(
        (now - (t.lastTouchedAt ? new Date(t.lastTouchedAt) : new Date(t.createdAt ?? now))) /
        (1000 * 60 * 60 * 24)
      ),
    }));
};

/**
 * Incomplete tasks due within 48 hours that haven't been touched today.
 */
export const getUrgentUntouched = (tasks) => {
  const now     = new Date();
  const in48hrs = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return tasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const due         = new Date(t.dueDate);
    const lastTouched = t.lastTouchedAt ? new Date(t.lastTouchedAt) : null;
    const touchedToday = lastTouched
      ? lastTouched.toDateString() === now.toDateString()
      : false;
    return due <= in48hrs && !touchedToday;
  });
};

/**
 * High-level stats summary for AI prompt context.
 */
export const getOverallStats = (tasks, history) => {
  const pending   = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const overdue   = pending.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date()
  );

  return {
    totalPending:   pending.length,
    totalCompleted: completed.length,
    totalOverdue:   overdue.length,
    historyCount:   history.length,
  };
};

/**
 * Build a plain-text summary of patterns for injection into AI prompts.
 * Keeps tokens low by being concise.
 */
export const buildPatternContext = (patterns) => {
  const lines = [];
  const { latenessProfile, productiveTimeOfDay, overallStats, staleTasks, urgentUntouched } = patterns;

  lines.push(`User tendancy: ${latenessProfile.label} (avg ${latenessProfile.avgDaysBefore ?? "?"} days before deadline)`);
  lines.push(`Most productive time: ${productiveTimeOfDay.bestTime}`);
  lines.push(`Currently: ${overallStats.totalPending} pending, ${overallStats.totalOverdue} overdue`);

  if (staleTasks.length > 0) {
    lines.push(`Stale tasks (untouched 3+ days): ${staleTasks.map((t) => `"${t.title}"`).join(", ")}`);
  }
  if (urgentUntouched.length > 0) {
    lines.push(`URGENT but untouched today: ${urgentUntouched.map((t) => `"${t.title}"`).join(", ")}`);
  }

  // Per-class patterns
  const classPatterns = Object.values(patterns.completionByClass);
  if (classPatterns.length > 0) {
    lines.push("Per-class patterns:");
    classPatterns.forEach((c) => {
      lines.push(`  - ${c.className}: ${c.tendencyLabel}, ${c.lateRate}% late rate`);
    });
  }

  return lines.join("\n");
};
