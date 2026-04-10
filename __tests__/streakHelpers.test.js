// __tests__/streakHelpers.test.js
//
// Tests for streak increment, reset, and idempotency logic.
// AsyncStorage is mocked in-memory so no device needed.

const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// ── In-memory AsyncStorage mock ──────────────────────────────
const store = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, store[k] ?? null])),
  multiSet: jest.fn(async (pairs) => { pairs.forEach(([k, v]) => { store[k] = v; }); }),
}));

// ── Helpers to set up fake stored state ─────────────────────
const STREAK_KEY      = "@planora_streak";
const STREAK_DATE_KEY = "@planora_streak_date";

const seedStreak = (count, date) => {
  store[STREAK_KEY]      = String(count);
  store[STREAK_DATE_KEY] = date ?? "";
};

const clearStore = () => {
  delete store[STREAK_KEY];
  delete store[STREAK_DATE_KEY];
};

// ── Date helpers (mirrors implementation) ───────────────────
const dateString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const TODAY     = dateString(0);
const YESTERDAY = dateString(-1);
const TWO_DAYS_AGO = dateString(-2);

// ── Import after mock is set up ──────────────────────────────
const {
  incrementStreak,
  checkAndResetStreak,
  loadStreak,
} = require("../src/utils/streakHelpers");

// ────────────────────────────────────────────────────────────

describe("incrementStreak", () => {
  beforeEach(clearStore);

  it("starts at 1 for a brand new user", async () => {
    const count = await incrementStreak();
    expect(count).toBe(1);
    expect(store[STREAK_KEY]).toBe("1");
    expect(store[STREAK_DATE_KEY]).toBe(TODAY);
  });

  it("continues streak when last completion was yesterday", async () => {
    seedStreak(5, YESTERDAY);
    const count = await incrementStreak();
    expect(count).toBe(6);
  });

  it("resets to 1 when last completion was 2+ days ago", async () => {
    seedStreak(10, TWO_DAYS_AGO);
    const count = await incrementStreak();
    expect(count).toBe(1);
  });

  it("is idempotent — calling twice today does not double count", async () => {
    const first  = await incrementStreak();
    const second = await incrementStreak();
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(store[STREAK_KEY]).toBe("1");
  });

  it("is idempotent even with an existing streak", async () => {
    seedStreak(7, YESTERDAY);
    await incrementStreak();
    await incrementStreak();
    await incrementStreak();
    const { count } = await loadStreak();
    expect(count).toBe(8);
  });
});

describe("checkAndResetStreak", () => {
  beforeEach(clearStore);

  it("returns 0 and clears storage when streak is stale (missed a day)", async () => {
    seedStreak(5, TWO_DAYS_AGO);
    const result = await checkAndResetStreak();
    expect(result).toBe(0);
    expect(store[STREAK_KEY]).toBe("0");
    expect(store[STREAK_DATE_KEY]).toBe("");
  });

  it("returns current count when last date is today", async () => {
    seedStreak(3, TODAY);
    const result = await checkAndResetStreak();
    expect(result).toBe(3);
    // Should NOT have reset storage
    expect(store[STREAK_KEY]).toBe("3");
  });

  it("returns current count when last date is yesterday (still active)", async () => {
    seedStreak(4, YESTERDAY);
    const result = await checkAndResetStreak();
    expect(result).toBe(4);
  });

  it("does not reset a 0 streak (new user with no history)", async () => {
    // count is 0, no lastDate — should return 0 without writing
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.multiSet.mockClear();
    const result = await checkAndResetStreak();
    expect(result).toBe(0);
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
  });

  it("after reset, next incrementStreak starts fresh at 1", async () => {
    seedStreak(10, TWO_DAYS_AGO);
    await checkAndResetStreak();       // resets — writes lastDate = ""
    const count = await incrementStreak(); // should start fresh
    expect(count).toBe(1);
  });
});
