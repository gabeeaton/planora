// __tests__/notificationScheduling.test.js
//
// Verifies that scheduleBatchReminders correctly reads dueDate/dueTime,
// groups tasks by date, builds notification content, and skips ineligible
// tasks (completed, no date, past due, outside 7-day window).

const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// ── AsyncStorage in-memory mock ───────────────────────────────
const store = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem:    jest.fn(async (k)   => store[k] ?? null),
  setItem:    jest.fn(async (k,v) => { store[k] = v; }),
  removeItem: jest.fn(async (k)   => { delete store[k]; }),
  multiGet:   jest.fn(async (ks)  => ks.map(k => [k, store[k] ?? null])),
  multiSet:   jest.fn(async (ps)  => ps.forEach(([k,v]) => { store[k] = v; })),
}));

// ── expo-notifications mock ───────────────────────────────────
let scheduledNotifications = [];
const mockSchedule = jest.fn(async ({ content, trigger }) => {
  const id = `notif-${scheduledNotifications.length + 1}`;
  scheduledNotifications.push({ id, content, trigger });
  return id;
});
const mockCancel = jest.fn(async () => {});

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync:        (...a) => mockSchedule(...a),
  cancelScheduledNotificationAsync: (...a) => mockCancel(...a),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  setBadgeCountAsync:               jest.fn(async () => {}),
  getBadgeCountAsync:               jest.fn(async () => 0),
  getPermissionsAsync:              jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync:          jest.fn(async () => ({ status: "granted" })),
  setNotificationHandler:           jest.fn(),
  setNotificationChannelAsync:      jest.fn(async () => {}),
  SchedulableTriggerInputTypes:     { DATE: "date" },
  AndroidImportance:                { DEFAULT: 3, HIGH: 4 },
  addNotificationReceivedListener:  jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// ── React Native mock (avoids __DEV__ and native module chain) ─
jest.mock("react-native", () => ({
  Platform:    { OS: "ios", select: jest.fn((obj) => obj.ios) },
  AppState:    { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  Alert:       { alert: jest.fn() },
  Vibration:   { vibrate: jest.fn() },
  NativeModules: {},
  NativeEventEmitter: jest.fn(() => ({ addListener: jest.fn(), removeAllListeners: jest.fn() })),
}));

// ── Config / feature flags mock ───────────────────────────────
jest.mock("../src/config", () => ({
  FIREBASE_CONFIG: {},
  FEATURE_FLAGS:   { DEMO_MODE: false },
}));

// ── Import after mocks ────────────────────────────────────────
const { scheduleBatchReminders } = require("../src/services/notifications");

// ── Helpers ───────────────────────────────────────────────────

// Returns a Date N days from now with the given hour/minute
const daysFromNow = (n, h = 23, m = 59) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return d;
};

// Minimal pending task
const makeTask = (overrides = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: "Test task",
  completed: false,
  dueDate: daysFromNow(2),
  dueTime: null,
  className: null,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────

describe("scheduleBatchReminders — eligibility filtering", () => {
  beforeEach(() => {
    scheduledNotifications = [];
    mockSchedule.mockClear();
    mockCancel.mockClear();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it("skips completed tasks — no notification scheduled", async () => {
    const tasks = [makeTask({ completed: true })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("skips tasks with no dueDate", async () => {
    const tasks = [makeTask({ dueDate: null })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("skips tasks whose due date is in the past", async () => {
    const tasks = [makeTask({ dueDate: daysFromNow(-1) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("skips tasks due beyond the 7-day window", async () => {
    const tasks = [makeTask({ dueDate: daysFromNow(10) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does nothing when uid is missing", async () => {
    const tasks = [makeTask()];
    await scheduleBatchReminders(tasks, "morning", null);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("does nothing for an empty task list", async () => {
    await scheduleBatchReminders([], "morning", "uid-1");
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────

describe("scheduleBatchReminders — 24h day-before notification", () => {
  beforeEach(() => {
    scheduledNotifications = [];
    mockSchedule.mockClear();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it("schedules a 24h notification for a future task", async () => {
    const tasks = [makeTask({ dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch24h = scheduledNotifications.filter(n =>
      n.content.data?.type === "batch-24h"
    );
    expect(batch24h.length).toBeGreaterThan(0);
  });

  it("24h notification title contains 'tomorrow' or 'due'", async () => {
    const tasks = [makeTask({ title: "Chem lab report", dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const notif = scheduledNotifications.find(n => n.content.data?.type === "batch-24h");
    expect(notif.content.title.toLowerCase()).toMatch(/due|tomorrow/);
  });

  it("single-task 24h notification includes the task title", async () => {
    const tasks = [makeTask({ title: "Midterm essay", dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const notif = scheduledNotifications.find(n => n.content.data?.type === "batch-24h");
    expect(notif.content.title).toContain("Midterm essay");
  });

  it("multi-task 24h notification shows a count in the title", async () => {
    const due = daysFromNow(3);
    const tasks = [
      makeTask({ title: "Task A", dueDate: due }),
      makeTask({ title: "Task B", dueDate: due }),
      makeTask({ title: "Task C", dueDate: due }),
    ];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const notif = scheduledNotifications.find(n => n.content.data?.type === "batch-24h");
    expect(notif.content.title).toMatch(/3/);
  });

  it("produces only ONE 24h notification per calendar date (tasks grouped)", async () => {
    const due = daysFromNow(3);
    const tasks = [
      makeTask({ dueDate: due }),
      makeTask({ dueDate: due }),
    ];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch24h = scheduledNotifications.filter(n => n.content.data?.type === "batch-24h");
    // Both tasks share the same calendar date → one notification
    expect(batch24h.length).toBe(1);
  });

  it("produces separate 24h notifications for different due dates", async () => {
    const tasks = [
      makeTask({ dueDate: daysFromNow(2) }),
      makeTask({ dueDate: daysFromNow(4) }),
    ];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch24h = scheduledNotifications.filter(n => n.content.data?.type === "batch-24h");
    expect(batch24h.length).toBe(2);
  });

  it("includes className in the 24h notification body when present", async () => {
    const tasks = [makeTask({ title: "Lab report", className: "CHEM 101", dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const notif = scheduledNotifications.find(n => n.content.data?.type === "batch-24h");
    expect(notif.content.body).toContain("CHEM 101");
  });
});

// ─────────────────────────────────────────────────────────────

describe("scheduleBatchReminders — 2h reminder", () => {
  beforeEach(() => {
    scheduledNotifications = [];
    mockSchedule.mockClear();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it("schedules a 2h notification for a task with an explicit dueTime", async () => {
    // Due in ~4 hours so the 2h fire-time is still in the future
    const future = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const tasks = [makeTask({ dueDate: future, dueTime: [future.getHours(), future.getMinutes()] })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch2h = scheduledNotifications.filter(n => n.content.data?.type === "batch-2h");
    expect(batch2h.length).toBeGreaterThan(0);
  });

  it("2h notification title contains '2 hour' or '2h'", async () => {
    const future = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const tasks = [makeTask({ title: "Quiz", dueDate: future, dueTime: [future.getHours(), future.getMinutes()] })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const notif = scheduledNotifications.find(n => n.content.data?.type === "batch-2h");
    expect(notif.content.title.toLowerCase()).toMatch(/2.?h|hour/);
  });

  it("two tasks at the SAME exact time produce ONE 2h notification", async () => {
    const future = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const h = future.getHours(), m = future.getMinutes();
    const tasks = [
      makeTask({ dueDate: future, dueTime: [h, m] }),
      makeTask({ dueDate: future, dueTime: [h, m] }),
    ];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch2h = scheduledNotifications.filter(n => n.content.data?.type === "batch-2h");
    expect(batch2h.length).toBe(1);
  });

  it("two tasks at different times produce TWO 2h notifications", async () => {
    const t1 = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const t2 = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const tasks = [
      makeTask({ dueDate: t1, dueTime: [t1.getHours(), t1.getMinutes()] }),
      makeTask({ dueDate: t2, dueTime: [t2.getHours(), t2.getMinutes()] }),
    ];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch2h = scheduledNotifications.filter(n => n.content.data?.type === "batch-2h");
    expect(batch2h.length).toBe(2);
  });

  it("skips 2h notification when fire-time would be in the past", async () => {
    // Task due in 1 hour — 2h-before fire time is already past
    const due = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const tasks = [makeTask({ dueDate: due, dueTime: [due.getHours(), due.getMinutes()] })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    const batch2h = scheduledNotifications.filter(n => n.content.data?.type === "batch-2h");
    expect(batch2h.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────

describe("scheduleBatchReminders — dueDate format handling", () => {
  beforeEach(() => {
    scheduledNotifications = [];
    mockSchedule.mockClear();
    Object.keys(store).forEach(k => delete store[k]);
  });

  it("handles dueDate as a plain JS Date object", async () => {
    const tasks = [makeTask({ dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).toHaveBeenCalled();
  });

  it("handles dueDate as a Firestore-Timestamp-like object with .toDate()", async () => {
    const date = daysFromNow(3);
    const timestampLike = { toDate: () => date, seconds: Math.floor(date.getTime() / 1000) };
    const tasks = [makeTask({ dueDate: timestampLike })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    expect(mockSchedule).toHaveBeenCalled();
  });

  it("uses end-of-day (23:59) for tasks without a dueTime", async () => {
    const tasks = [makeTask({ dueDate: daysFromNow(3), dueTime: null })];
    await scheduleBatchReminders(tasks, "morning", "uid-1");
    // End-of-day means no 2h notification fires (fire-time = 21:59, depends on when test runs)
    // We just check the 24h notification was created (which confirms the task was processed)
    const batch24h = scheduledNotifications.filter(n => n.content.data?.type === "batch-24h");
    expect(batch24h.length).toBeGreaterThanOrEqual(1);
  });

  it("saves a manifest to AsyncStorage after scheduling", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    const tasks = [makeTask({ dueDate: daysFromNow(3) })];
    await scheduleBatchReminders(tasks, "morning", "uid-manifest");
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    const key = AsyncStorage.setItem.mock.calls.find(([k]) => k.includes("uid-manifest"));
    expect(key).toBeDefined();
  });
});
