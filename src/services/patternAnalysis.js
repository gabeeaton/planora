// ============================================================
// src/services/patternAnalysis.js
// Pure local logic — NO API calls.
// Analyzes cached task history to find behavioral patterns.
// Output feeds into OpenAI prompts to make them personalized.
//
// CHANGES:
//  - buildPatternContext() now accepts userProfile (2nd arg)
//  - Includes lifestyleGoals and hardestClass in AI context
//  - Grade comparison handles C+, percentages, GPA floats
// ============================================================

export const analyzePatterns = (tasks, history, userProfile) => {
  const gradeMap = {};
  (userProfile?.classes ?? []).forEach((cls) => {
    if (cls.name) gradeMap[cls.name] = cls.grade ?? null;
  });
  return {
    avoidanceScores:     getAvoidanceScores(tasks),
    completionByClass:   getCompletionPatternsByClass(history, gradeMap),
    latenessProfile:     getLatenessProfile(history),
    productiveTimeOfDay: getProductiveTimeOfDay(history),
    staleTasks:          getStaleTasks(tasks),
    urgentUntouched:     getUrgentUntouched(tasks),
    overallStats:        getOverallStats(tasks, history),
  };
};

export const getAvoidanceScores = (tasks) => {
  const now = new Date();
  return tasks
    .filter((t) => !t.completed)
    .map((t) => {
      const createdAt   = t.createdAt    ? new Date(t.createdAt)    : now;
      const dueDate     = t.dueDate      ? new Date(t.dueDate)      : null;
      const lastTouched = t.lastTouchedAt ? new Date(t.lastTouchedAt) : createdAt;

      const daysSinceTouched = Math.floor((now - lastTouched) / (1000 * 60 * 60 * 24));
      const daysUntilDue     = dueDate
        ? Math.floor((dueDate - now) / (1000 * 60 * 60 * 24))
        : null;

      let score = daysSinceTouched;
      if (daysUntilDue !== null) {
        if (daysUntilDue <= 1)       score *= 4;
        else if (daysUntilDue <= 3)  score *= 2.5;
        else if (daysUntilDue <= 7)  score *= 1.5;
      }

      return {
        taskId:          t.id,
        title:           t.title,
        className:       t.className ?? null,
        score:           Math.round(score),
        daysSinceTouched,
        daysUntilDue,
        isBeingAvoided:  daysSinceTouched >= 3 && (daysUntilDue === null || daysUntilDue <= 7),
      };
    })
    .sort((a, b) => b.score - a.score);
};

export const getCompletionPatternsByClass = (history, gradeMap = {}) => {
  const byClass = {};

  history.forEach((record) => {
    const key = record.classId ?? "untagged";
    if (!byClass[key]) {
      byClass[key] = {
        classId:        key,
        className:      record.className ?? "Untagged",
        grade:          gradeMap[record.className] ?? null,
        completedCount: 0,
        lateCount:      0,
        totalDaysEarly: 0,
        daysBeforeList: [],
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

export const getLatenessProfile = (history) => {
  const withDates = history.filter((h) => h.daysBeforeDeadline !== null);
  if (withDates.length === 0) return { label: "unknown", avgDaysBefore: null };

  const avg       = withDates.reduce((sum, h) => sum + h.daysBeforeDeadline, 0) / withDates.length;
  const lateCount = withDates.filter((h) => h.daysBeforeDeadline < 0).length;
  const lateRate  = Math.round((lateCount / withDates.length) * 100);

  return {
    avgDaysBefore: Math.round(avg),
    lateRate,
    label:         avg >= 3 ? "plans ahead" : avg >= 0 ? "last minute" : "often late",
    totalSamples:  withDates.length,
  };
};

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

export const getStaleTasks = (tasks) => {
  const now = new Date();
  return tasks
    .filter((t) => {
      if (t.completed) return false;
      const lastTouched = t.lastTouchedAt
        ? new Date(t.lastTouchedAt)
        : t.createdAt ? new Date(t.createdAt) : now;
      return Math.floor((now - lastTouched) / (1000 * 60 * 60 * 24)) >= 3;
    })
    .map((t) => ({
      ...t,
      daysSinceTouched: Math.floor(
        (now - new Date(t.lastTouchedAt ?? t.createdAt ?? now)) / (1000 * 60 * 60 * 24)
      ),
    }));
};

export const getUrgentUntouched = (tasks) => {
  const now     = new Date();
  const in48hrs = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return tasks.filter((t) => {
    if (t.completed || !t.dueDate) return false;
    const due          = new Date(t.dueDate);
    const lastTouched  = t.lastTouchedAt ? new Date(t.lastTouchedAt) : null;
    const touchedToday = lastTouched
      ? lastTouched.toDateString() === now.toDateString()
      : false;
    return due <= in48hrs && !touchedToday;
  });
};

export const getOverallStats = (tasks, history) => {
  const pending   = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);
  const overdue   = pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());
  return {
    totalPending:   pending.length,
    totalCompleted: completed.length,
    totalOverdue:   overdue.length,
    historyCount:   history.length,
  };
};

// ── Grade normalization ───────────────────────────────────────
// Handles letter grades, percentages ("78%"), and GPA floats ("3.2")

const LETTER_TO_GPA = {
  "A+": 4.0, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F":  0.0,
};

export const normalizeGradeToGPA = (grade) => {
  if (grade == null) return null;
  const s = String(grade).trim().toUpperCase();
  if (LETTER_TO_GPA[s] !== undefined) return LETTER_TO_GPA[s];
  const pct = parseFloat(s.replace("%", ""));
  if (!isNaN(pct) && pct >= 0 && pct <= 100) {
    if (pct >= 93) return 4.0;
    if (pct >= 90) return 3.7;
    if (pct >= 87) return 3.3;
    if (pct >= 83) return 3.0;
    if (pct >= 80) return 2.7;
    if (pct >= 77) return 2.3;
    if (pct >= 73) return 2.0;
    if (pct >= 70) return 1.7;
    if (pct >= 67) return 1.3;
    if (pct >= 63) return 1.0;
    if (pct >= 60) return 0.7;
    return 0.0;
  }
  const gpa = parseFloat(s);
  if (!isNaN(gpa) && gpa >= 0 && gpa <= 4.0) return gpa;
  return null;
};

export const isStrugglingGrade = (grade) => {
  const gpa = normalizeGradeToGPA(grade);
  return gpa !== null && gpa < 2.3;
};

// ── Context builder ───────────────────────────────────────────

export const buildPatternContext = (patterns, userProfile = null) => {
  const lines = [];
  const { latenessProfile, productiveTimeOfDay, overallStats, staleTasks, urgentUntouched } = patterns;

  lines.push(`User tendency: ${latenessProfile.label} (avg ${latenessProfile.avgDaysBefore ?? "?"} days before deadline)`);
  lines.push(`Most productive time: ${productiveTimeOfDay.bestTime}`);
  lines.push(`Currently: ${overallStats.totalPending} pending, ${overallStats.totalOverdue} overdue`);

  // Lifestyle goals — tells AI about time constraints
  if (userProfile?.lifestyleGoals?.length > 0) {
    const GOAL_LABELS = {
      gym_fitness:   "goes to the gym",
      sleep_health:  "prioritizes sleep",
      mental_health: "managing mental health",
      part_time_job: "works a part-time job",
      social_life:   "values social life",
      side_projects: "has side projects",
      greek_life:    "involved in greek life",
      athletics:     "student athlete",
    };
    const labels = userProfile.lifestyleGoals
      .map((g) => GOAL_LABELS[g] ?? g)
      .join(", ");
    lines.push(`Lifestyle: ${labels} — factor this into time recommendations`);
  }

  // Hardest class — AI should be extra proactive about it
  if (userProfile?.hardestClass) {
    const cls         = userProfile?.classes?.find((c) => c.id === userProfile.hardestClass);
    const hardestName = cls?.name ?? userProfile.hardestClass;
    lines.push(`Self-reported hardest class: ${hardestName} — be extra proactive about this class`);
  }

  if (staleTasks.length > 0) {
    lines.push(`Stale tasks (untouched 3+ days): ${staleTasks.map((t) => `"${t.title}"`).join(", ")}`);
  }
  if (urgentUntouched.length > 0) {
    lines.push(`URGENT but untouched today: ${urgentUntouched.map((t) => `"${t.title}"`).join(", ")}`);
  }

  const classPatterns = Object.values(patterns.completionByClass);
  if (classPatterns.length > 0) {
    lines.push("Per-class patterns:");
    classPatterns.forEach((c) => {
      const gNote      = c.grade ? ` | grade: ${c.grade}` : "";
      const struggling = isStrugglingGrade(c.grade);
      const gWarn      = struggling ? " ⚠️ PRIORITIZE — struggling grade" : "";
      lines.push(`  - ${c.className}: ${c.tendencyLabel}, ${c.lateRate}% late rate${gNote}${gWarn}`);
    });
  }

  return lines.join("\n");
};