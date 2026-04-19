const { generateTerms, WORK_TIMES, GRADES, CREDIT_OPTS } = require("../src/utils/termHelpers");

describe("generateTerms", () => {
  test("returns an array", () => {
    expect(Array.isArray(generateTerms("semester"))).toBe(true);
  });

  test("returns at most 8 results", () => {
    expect(generateTerms("semester").length).toBeLessThanOrEqual(8);
    expect(generateTerms("quarter").length).toBeLessThanOrEqual(8);
  });

  test("returns no duplicates", () => {
    const terms = generateTerms("semester");
    expect(new Set(terms).size).toBe(terms.length);
  });

  test("semester terms use Spring/Summer/Fall", () => {
    const terms = generateTerms("semester");
    const valid = ["Spring", "Summer", "Fall"];
    terms.forEach((t) => {
      expect(valid.some((s) => t.startsWith(s))).toBe(true);
    });
  });

  test("quarter terms use Winter/Spring/Summer/Fall", () => {
    const terms = generateTerms("quarter");
    const valid = ["Winter", "Spring", "Summer", "Fall"];
    terms.forEach((t) => {
      expect(valid.some((s) => t.startsWith(s))).toBe(true);
    });
  });

  test("includes a term with the current year", () => {
    const year = String(new Date().getFullYear());
    const terms = generateTerms("semester");
    expect(terms.some((t) => t.includes(year))).toBe(true);
  });

  test("all terms end with a 4-digit year", () => {
    generateTerms("semester").forEach((t) => {
      expect(t).toMatch(/\d{4}$/);
    });
  });

  test("defaults to semester when no argument given", () => {
    const defaultTerms = generateTerms();
    const semesterTerms = generateTerms("semester");
    expect(defaultTerms).toEqual(semesterTerms);
  });
});

describe("constants", () => {
  test("WORK_TIMES has 4 entries", () => {
    expect(WORK_TIMES).toHaveLength(4);
  });

  test("GRADES includes standard letter grades and No grade yet", () => {
    expect(GRADES).toContain("A");
    expect(GRADES).toContain("F");
    expect(GRADES).toContain("No grade yet");
  });

  test("CREDIT_OPTS are string numbers", () => {
    CREDIT_OPTS.forEach((c) => expect(typeof c).toBe("string"));
    expect(CREDIT_OPTS).toContain("3");
  });
});
