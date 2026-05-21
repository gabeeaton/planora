// __tests__/streakHelpers.test.js
//
// Tests for streak increment, reset, and idempotency logic.
// AsyncStorage is mocked in-memory so no device needed.

const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// ── In-memory AsyncStorage mock ──────────────────────────────
const store = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  multiGet:  jest.fn(async (keys) => keys.map((k) => [k, store[k] ?? null])),
  multiSet:  jest.fn(async (pairs) => { pairs.forEach(([k, v]) => { store[k] = v; }); }),
  setItem:   jest.fn(async (k, v) => { store[k] = v; }),
  multiRemove: jest.fn(async (keys) => { keys.forEach((k) => { delete store[k]; }); }),
}));

// ── Helpers ──────────────────────────────────────────────────
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

const dateString = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const TODAY        = dateString(0);
const YESTERDAY    = dateString(-1);
const TWO_DAYS_AGO = dateString(-2);

// A task with a due date during the gap (yesterday) — triggers the reset path
const taskDueDuringGap = { dueDate: new Date(YESTERDAY + "T12:00:00"), completed: false };

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

  it("resets to 1 when last completion was 2+ days ago AND tasks were due during the gap", async () => {
    seedStreak(10, TWO_DAYS_AGO);
    const count = await incrementStreak(undefined, [taskDueDuringGap]);
    expect(count).toBe(1);
  });

  it("preserves streak when 2+ days gap but NO tasks were due (grace period)", async () => {
    seedStreak(10, TWO_DAYS_AGO);
    const count = await incrementStreak(undefined, []);
    expect(count).toBe(11);
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

  it("resets count to 0 when streak is stale and tasks were due during the gap", async () => {
    seedStreak(5, TWO_DAYS_AGO);
    const result = await checkAndResetStreak(undefined, [taskDueDuringGap]);
    expect(result).toBe(0);
    expect(store[STREAK_KEY]).toBe("0");
  });

  it("does NOT reset when gap had no tasks due (grace period)", async () => {
    seedStreak(5, TWO_DAYS_AGO);
    const result = await checkAndResetStreak(undefined, []);
    expect(result).toBe(5);
  });

  it("returns current count when last date is today", async () => {
    seedStreak(3, TODAY);
    const result = await checkAndResetStreak();
    expect(result).toBe(3);
    expect(store[STREAK_KEY]).toBe("3");
  });

  it("returns current count when last date is yesterday (still active)", async () => {
    seedStreak(4, YESTERDAY);
    const result = await checkAndResetStreak();
    expect(result).toBe(4);
  });

  it("does not reset a 0 streak (new user with no history)", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.multiSet.mockClear();
    AsyncStorage.setItem.mockClear();
    const result = await checkAndResetStreak();
    expect(result).toBe(0);
    expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("after reset, next incrementStreak starts fresh at 1", async () => {
    seedStreak(10, TWO_DAYS_AGO);
    await checkAndResetStreak(undefined, [taskDueDuringGap]);
    const count = await incrementStreak(undefined, [taskDueDuringGap]);
    expect(count).toBe(1);
  });
});
