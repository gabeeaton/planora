// __tests__/recurringTasks.test.js
//
// Tests for recurrence label generation, next-due-date calculation,
// and the spawn-on-complete flow (including the idempotency guard).

const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// ── Firestore mock ────────────────────────────────────────────
const mockAddDoc = jest.fn(async () => ({ id: "spawned-id" }));
const mockGetDocs = jest.fn(async () => ({ empty: true, docs: [] }));

class MockTimestamp {
  constructor(seconds) { this.seconds = seconds; }
  toDate() { return new Date(this.seconds * 1000); }
  static now() { return new MockTimestamp(Math.floor(Date.now() / 1000)); }
  static fromDate(d) { return new MockTimestamp(Math.floor(d.getTime() / 1000)); }
}

jest.mock("firebase/firestore", () => ({
  addDoc:     (...a) => mockAddDoc(...a),
  getDocs:    (...a) => mockGetDocs(...a),
  collection: jest.fn(() => "col"),
  query:      jest.fn(() => "q"),
  where:      jest.fn(() => "w"),
  Timestamp:  MockTimestamp,
}));

jest.mock("../src/services/firebase", () => ({ db: {} }));

const {
  getRecurrenceLabel,
  getNextDueDate,
  spawnNextRecurringTask,
} = require("../src/services/recurringTasks");

// ─────────────────────────────────────────────────────────────

describe("getRecurrenceLabel", () => {
  it("returns null for a null recurrence", () => {
    expect(getRecurrenceLabel(null)).toBeNull();
  });

  it("returns 'Every day' for daily", () => {
    expect(getRecurrenceLabel({ type: "daily" })).toBe("Every day");
  });

  it("returns the full day name for weekly (Mon = 1)", () => {
    expect(getRecurrenceLabel({ type: "weekly", dayOfWeek: 1 })).toBe("Every Monday");
  });

  it("returns the full day name for weekly (Fri = 5)", () => {
    expect(getRecurrenceLabel({ type: "weekly", dayOfWeek: 5 })).toBe("Every Friday");
  });

  it("returns biweekly label with day name", () => {
    expect(getRecurrenceLabel({ type: "biweekly", dayOfWeek: 3 })).toBe("Every 2 weeks (Wednesday)");
  });

  it("returns 'Monthly' for monthly", () => {
    expect(getRecurrenceLabel({ type: "monthly" })).toBe("Monthly");
  });

  it("returns abbreviated day names for custom_days", () => {
    const label = getRecurrenceLabel({ type: "custom_days", days: [1, 3, 5] });
    expect(label).toBe("Mon, Wed, Fri");
  });

  it("handles empty custom_days gracefully", () => {
    const label = getRecurrenceLabel({ type: "custom_days", days: [] });
    expect(label).toBe("");
  });

  it("returns 'Recurring' for an unknown type", () => {
    expect(getRecurrenceLabel({ type: "quarterly" })).toBe("Recurring");
  });
});

// ─────────────────────────────────────────────────────────────

describe("getNextDueDate — daily", () => {
  it("returns exactly one day after the given date", () => {
    const from = new Date("2026-09-10T12:00:00");
    const next = getNextDueDate({ type: "daily" }, from);
    expect(next.getDate()).toBe(11);
    expect(next.getMonth()).toBe(8); // September (0-indexed)
  });
});

describe("getNextDueDate — weekly", () => {
  it("returns the next occurrence of the target weekday", () => {
    // 2026-09-07 is a Monday (dayOfWeek=1)
    const from = new Date("2026-09-07T10:00:00"); // Monday
    const next = getNextDueDate({ type: "weekly", dayOfWeek: 1 }, from);
    // Next Monday is Sep 14
    expect(next.getDate()).toBe(14);
  });

  it("advances to the same weekday in the following week when today matches", () => {
    const from = new Date("2026-09-07T10:00:00"); // Monday
    const next = getNextDueDate({ type: "weekly", dayOfWeek: from.getDay() }, from);
    // Should land on Mon Sep 14
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getDate()).toBe(14);
    expect(next.getMonth()).toBe(8); // September
  });
});

describe("getNextDueDate — biweekly", () => {
  it("returns exactly 14 days later (same day of month + 14)", () => {
    const from = new Date("2026-09-01T00:00:00");
    const next = getNextDueDate({ type: "biweekly" }, from);
    // Sep 1 + 14 days = Sep 15
    expect(next.getDate()).toBe(15);
    expect(next.getMonth()).toBe(8); // September
  });
});

describe("getNextDueDate — monthly", () => {
  it("advances the month by one, same day", () => {
    const from = new Date("2026-09-15T00:00:00");
    const next = getNextDueDate({ type: "monthly" }, from);
    expect(next.getMonth()).toBe(9); // October
    expect(next.getDate()).toBe(15);
  });

  it("handles month-end edge (Sep 30 → Oct 30)", () => {
    const from = new Date("2026-09-30T00:00:00");
    const next = getNextDueDate({ type: "monthly" }, from);
    expect(next.getMonth()).toBe(9); // October
    expect(next.getDate()).toBe(30);
  });
});

describe("getNextDueDate — custom_days", () => {
  it("returns the nearest future weekday in the list", () => {
    // Wed Sep 9 2026 (dayOfWeek=3). Target: [5] (Friday)
    const from = new Date("2026-09-09T10:00:00"); // Wednesday
    const next = getNextDueDate({ type: "custom_days", days: [5] }, from);
    // Next Friday = Sep 11
    expect(next.getDate()).toBe(11);
  });

  it("wraps around the week correctly", () => {
    // Friday (5). Target: [1] (Monday)
    const from = new Date("2026-09-11T10:00:00"); // Friday
    const next = getNextDueDate({ type: "custom_days", days: [1] }, from);
    // Next Monday = Sep 14
    expect(next.getDate()).toBe(14);
  });

  it("returns null for empty days array", () => {
    const next = getNextDueDate({ type: "custom_days", days: [] }, new Date());
    expect(next).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────

describe("spawnNextRecurringTask", () => {
  const baseTask = {
    id: "parent-id",
    userId: "user-1",
    title: "Weekly reading",
    description: "Chapter 5",
    priority: "MEDIUM",
    classId: "eng-101",
    className: "ENG 101",
    recurrence: { type: "weekly", dayOfWeek: 3 },
    dueDate: new Date("2026-09-09T23:59:00"), // Wednesday
    dueTime: null,
  };

  beforeEach(() => {
    mockAddDoc.mockClear();
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  });

  it("calls addDoc once with correct fields", async () => {
    await spawnNextRecurringTask(baseTask);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.title).toBe("Weekly reading");
    expect(payload.userId).toBe("user-1");
    expect(payload.parentTaskId).toBe("parent-id");
    expect(payload.completed).toBe(false);
    expect(payload.recurrence).toEqual({ type: "weekly", dayOfWeek: 3 });
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
  });

  it("spawns the next due date one week forward", async () => {
    await spawnNextRecurringTask(baseTask);
    const payload = mockAddDoc.mock.calls[0][1];
    const nextDate = payload.dueDate.toDate();
    // Sep 9 Wednesday → next Wednesday Sep 16
    expect(nextDate.getDate()).toBe(16);
  });

  it("does NOT call addDoc when a duplicate already exists", async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "existing" }] });
    await spawnNextRecurringTask(baseTask);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("does NOT call addDoc when recurrence is null", async () => {
    await spawnNextRecurringTask({ ...baseTask, recurrence: null });
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("does NOT call addDoc when recurrence is undefined", async () => {
    const { recurrence: _, ...noRec } = baseTask;
    await spawnNextRecurringTask(noRec);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("handles a task with no dueDate by using today as the base", async () => {
    await spawnNextRecurringTask({ ...baseTask, dueDate: null });
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
  });

  it("preserves description, priority, classId, className on spawn", async () => {
    await spawnNextRecurringTask(baseTask);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.description).toBe("Chapter 5");
    expect(payload.priority).toBe("MEDIUM");
    expect(payload.classId).toBe("eng-101");
    expect(payload.className).toBe("ENG 101");
  });

  it("stamps createdAt and lastTouchedAt as Timestamps on spawn", async () => {
    await spawnNextRecurringTask(baseTask);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.createdAt).toBeInstanceOf(MockTimestamp);
    expect(payload.lastTouchedAt).toBeInstanceOf(MockTimestamp);
  });
});
