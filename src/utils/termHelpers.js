// ============================================================
// src/utils/termHelpers.js
// Shared constants and helpers for term/class setup.
// Used by OnboardingScreen, ProfileScreen, TasksScreen,
// StatsScreen, syllabusParser, and AppNavigator.
// ============================================================

export const generateTerms = (system = "semester") => {
  const now = new Date();
  const year = now.getFullYear();
  const results = [];
  for (let y = year - 1; y <= year + 2; y++) {
    const seasons = system === "quarter"
      ? [
          { name: `Winter ${y}`, startMonth: 0 },
          { name: `Spring ${y}`, startMonth: 3 },
          { name: `Summer ${y}`, startMonth: 6 },
          { name: `Fall ${y}`,   startMonth: 8 },
        ]
      : [
          { name: `Spring ${y}`, startMonth: 0 },
          { name: `Summer ${y}`, startMonth: 4 },
          { name: `Fall ${y}`,   startMonth: 7 },
        ];
    seasons.forEach(({ name, startMonth }) => {
      const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() - startMonth);
      if (monthsAgo >= -8 && monthsAgo <= 4) results.push(name);
    });
  }
  return [...new Set(results)].slice(0, 8);
};

// ── Unified semester/quarter date bounds ─────────────────────
// All date logic lives here so every screen uses the same numbers.
// End dates are intentionally ~1 week after typical finals to avoid
// firing the semester-end prompt while the student is still in exams.
//
// Semester:
//   Spring  Jan 6  – May 22    start early: MIT/Harvard open Jan 6-8
//   Summer  May 1  – Aug 17    start early: some schools open first week of May
//   Fall    Aug 14 – Dec 22    start early: many schools start Aug 14-18
//   Winter  Jan 1  – Mar 25    rare but some schools start Jan 2-3
//
// Quarter:
//   Winter  Jan 1  – Mar 25    start early: some open Jan 2-3
//   Spring  Mar 25 – Jun 25    start early: some open late March
//   Summer  Jun 15 – Sep 2     start early: some open mid-June
//   Fall    Sep 15 – Dec 15    start early: some open Sep 15-18

const BOUNDS = {
  semester: {
    spring: { start: [0, 6],  end: [4, 22] },
    summer: { start: [4, 1],  end: [7, 17] },
    fall:   { start: [7, 14], end: [11, 22] },
    winter: { start: [0, 1],  end: [2, 25] },
  },
  quarter: {
    winter: { start: [0, 1],  end: [2, 25] },
    spring: { start: [2, 25], end: [5, 25] },
    summer: { start: [5, 15], end: [8, 2]  },
    fall:   { start: [8, 15], end: [11, 15] },
  },
};

const parseSem = (sem) => {
  if (!sem) return null;
  const lower = sem.toLowerCase();
  const yearMatch = sem.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  const season =
    lower.includes("spring") ? "spring" :
    lower.includes("summer") ? "summer" :
    lower.includes("fall")   ? "fall"   :
    lower.includes("winter") ? "winter" : null;
  return season ? { year, season } : null;
};

// Returns { start: Date, end: Date } for the given term.
export const getSemesterBounds = (sem, schoolSystem = "semester") => {
  const parsed = parseSem(sem);
  if (!parsed) return null;
  const system = schoolSystem === "quarter" ? "quarter" : "semester";
  const b = BOUNDS[system][parsed.season];
  if (!b) return null;
  return {
    start: new Date(parsed.year, b.start[0], b.start[1]),
    end:   new Date(parsed.year, b.end[0],   b.end[1]),
  };
};

// Convenience wrappers used by individual screens.
export const getSemesterStart = (sem, schoolSystem = "semester") =>
  getSemesterBounds(sem, schoolSystem)?.start ?? null;

// Like generateTerms but strips out terms whose end date has already passed.
// Used in the new-semester prompt so students can't switch back to old terms.
export const generateUpcomingTerms = (system = "semester") => {
  const now = Date.now();
  return generateTerms(system).filter((t) => {
    const end = getSemesterEnd(t, system);
    return !end || end.getTime() > now;
  });
};

export const getSemesterEnd = (sem, schoolSystem = "semester") =>
  getSemesterBounds(sem, schoolSystem)?.end ?? null;

// 0–100 progress through the current term.
export const getSemesterProgress = (sem, schoolSystem = "semester") => {
  const bounds = getSemesterBounds(sem, schoolSystem);
  if (!bounds) return 0;
  const now = Date.now();
  if (now <= bounds.start) return 0;
  if (now >= bounds.end)   return 100;
  return Math.round(((now - bounds.start) / (bounds.end - bounds.start)) * 100);
};

export const WORK_TIMES = [
  "Morning (6am–12pm)",
  "Afternoon (12pm–5pm)",
  "Evening (5pm–9pm)",
  "Night (9pm+)",
];

export const GRADES      = ["A", "B", "C", "D", "F", "No grade yet"];
export const CREDIT_OPTS = ["1", "2", "3", "4", "5+"];
