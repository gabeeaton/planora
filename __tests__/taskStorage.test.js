// __tests__/taskStorage.test.js
//
// Verifies that addTask and updateTask correctly convert, store, and
// pass through all task fields to Firestore — especially dueDate (→
// Timestamp), dueTime (array, stored as-is), and optional null values.

const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// ── Timestamp mock ────────────────────────────────────────────
class MockTimestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() { return new Date(this.seconds * 1000); }
  static now() { return new MockTimestamp(Math.floor(Date.now() / 1000)); }
  static fromDate(d) { return new MockTimestamp(Math.floor(d.getTime() / 1000)); }
}

// ── Firestore mock ────────────────────────────────────────────
const mockAddDoc   = jest.fn(async () => ({ id: "new-task-id" }));
const mockUpdateDoc = jest.fn(async () => {});
const mockCollection = jest.fn(() => "col-ref");
const mockDoc       = jest.fn(() => "doc-ref");

jest.mock("firebase/firestore", () => ({
  addDoc:       (...a) => mockAddDoc(...a),
  updateDoc:    (...a) => mockUpdateDoc(...a),
  deleteDoc:    jest.fn(),
  doc:          (...a) => mockDoc(...a),
  collection:   (...a) => mockCollection(...a),
  query:        jest.fn(() => "query"),
  where:        jest.fn(() => "where"),
  orderBy:      jest.fn(() => "orderBy"),
  limit:        jest.fn(() => "limit"),
  onSnapshot:   jest.fn(() => () => {}),
  getDocs:      jest.fn(async () => ({ empty: true, docs: [] })),
  getDoc:       jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  setDoc:       jest.fn(async () => {}),
  getFirestore: jest.fn(() => ({ type: "firestore" })),
  writeBatch:   jest.fn(() => ({ update: jest.fn(), commit: jest.fn(async () => {}) })),
  Timestamp:    MockTimestamp,
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({})),
  getApps:       jest.fn(() => [{}]),
  getApp:        jest.fn(() => ({})),
}));

jest.mock("firebase/auth", () => ({
  initializeAuth:              jest.fn(() => ({})),
  getReactNativePersistence:   jest.fn(),
  getAuth:                     jest.fn(() => ({})),
  signInWithEmailAndPassword:  jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  confirmPasswordReset:        jest.fn(),
  signOut:                     jest.fn(),
  onAuthStateChanged:          jest.fn(() => () => {}),
  deleteUser:                  jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider:           { credential: jest.fn() },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem:  jest.fn(async () => null),
  setItem:  jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
  multiGet: jest.fn(async () => []),
  multiSet: jest.fn(async () => {}),
}));

jest.mock("../src/config", () => ({
  FIREBASE_CONFIG: { apiKey: "test", projectId: "test" },
  FEATURE_FLAGS:   { DEMO_MODE: false },
}));

const { addTask, updateTask } = require("../src/services/firebase");

// ─────────────────────────────────────────────────────────────

describe("addTask — Firestore field conversion", () => {
  beforeEach(() => { mockAddDoc.mockClear(); });

  it("converts a Date dueDate to a Timestamp", async () => {
    const date = new Date("2026-09-15T14:00:00");
    await addTask("user1", { title: "Essay", dueDate: date, dueTime: null });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
    expect(payload.dueDate.toDate().toDateString()).toBe(date.toDateString());
  });

  it("stores dueDate as null when not provided", async () => {
    await addTask("user1", { title: "No date task", dueDate: null });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeNull();
  });

  it("stores dueTime array exactly as supplied ([14, 30])", async () => {
    await addTask("user1", { title: "Timed task", dueDate: new Date(), dueTime: [14, 30] });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueTime).toEqual([14, 30]);
  });

  it("stores dueTime as null when not provided", async () => {
    await addTask("user1", { title: "No time", dueDate: new Date(), dueTime: null });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueTime).toBeNull();
  });

  it("always sets completed: false regardless of input", async () => {
    await addTask("user1", { title: "Task", completed: true });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.completed).toBe(false);
  });

  it("stamps createdAt and lastTouchedAt as Timestamps", async () => {
    await addTask("user1", { title: "Task" });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.createdAt).toBeInstanceOf(MockTimestamp);
    expect(payload.lastTouchedAt).toBeInstanceOf(MockTimestamp);
  });

  it("includes the userId on the document", async () => {
    await addTask("uid-abc", { title: "Owned task" });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.userId).toBe("uid-abc");
  });

  it("stores className, classId, priority, and recurrence verbatim", async () => {
    await addTask("user1", {
      title: "CHEM lab",
      className: "CHEM 101",
      classId: "chem-id",
      priority: "HIGH",
      recurrence: { type: "weekly", dayOfWeek: 3 },
    });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.className).toBe("CHEM 101");
    expect(payload.classId).toBe("chem-id");
    expect(payload.priority).toBe("HIGH");
    expect(payload.recurrence).toEqual({ type: "weekly", dayOfWeek: 3 });
  });

  it("converts a dueDate passed as a string to a Timestamp", async () => {
    await addTask("user1", { title: "String date", dueDate: "2026-12-01T00:00:00" });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
  });
});

// ─────────────────────────────────────────────────────────────

describe("updateTask — Firestore field conversion", () => {
  beforeEach(() => { mockUpdateDoc.mockClear(); });

  it("converts a Date dueDate to Timestamp on edit", async () => {
    const date = new Date("2026-11-20T09:00:00");
    await updateTask("task-1", { title: "Updated", dueDate: date });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
    expect(payload.dueDate.toDate().toDateString()).toBe(date.toDateString());
  });

  it("passes null dueDate through without conversion", async () => {
    await updateTask("task-1", { title: "Cleared date", dueDate: null });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeNull();
  });

  it("does not touch dueDate field when not in updates", async () => {
    await updateTask("task-1", { title: "Title only" });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect("dueDate" in payload).toBe(false);
  });

  it("preserves a dueTime update as-is", async () => {
    await updateTask("task-1", { dueDate: new Date(), dueTime: [8, 45] });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.dueTime).toEqual([8, 45]);
  });

  it("stamps lastTouchedAt on every edit", async () => {
    await updateTask("task-1", { title: "Touch test" });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.lastTouchedAt).toBeInstanceOf(MockTimestamp);
  });

  it("skips Timestamp conversion for an invalid dueDate string", async () => {
    await updateTask("task-1", { dueDate: "not-a-date" });
    const payload = mockUpdateDoc.mock.calls[0][1];
    // isNaN check in updateTask prevents storing a broken Timestamp
    expect(payload.dueDate).toBe("not-a-date");
  });

  it("converts a dueDate string to Timestamp when valid", async () => {
    await updateTask("task-1", { dueDate: "2026-10-01" });
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeInstanceOf(MockTimestamp);
  });

  it("routes the call to the correct task doc ref", async () => {
    await updateTask("task-xyz", { title: "Test" });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), "tasks", "task-xyz");
  });
});
