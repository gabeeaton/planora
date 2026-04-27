// ============================================================
// src/utils/termHelpers.js
// Shared constants and helpers for term/class setup.
// Used by OnboardingScreen and ProfileScreen.
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
      // show: started ≤4 months ago (still ongoing) or starting ≤8 months from now (upcoming)
      if (monthsAgo >= -8 && monthsAgo <= 4) results.push(name);
    });
  }
  return [...new Set(results)].slice(0, 8);
};

export const WORK_TIMES = [
  "Morning (6am–12pm)",
  "Afternoon (12pm–5pm)",
  "Evening (5pm–9pm)",
  "Night (9pm+)",
];

export const GRADES      = ["A", "B", "C", "D", "F", "No grade yet"];
export const CREDIT_OPTS = ["1", "2", "3", "4", "5+"];
