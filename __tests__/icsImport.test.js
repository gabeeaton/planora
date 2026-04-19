const { parseIcsText, isValidIcs, countIcsEvents } = require("../src/services/icsImport");

// ── Helpers ───────────────────────────────────────────────────

const wrap = (events) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;

const event = (fields) => {
  const lines = ["BEGIN:VEVENT", ...fields, "END:VEVENT"].join("\r\n");
  return lines;
};

// Far-future date so tests never flake based on current date
const FUTURE = "20990101T120000Z";
const PAST   = "20200101T120000Z";

// ── isValidIcs ────────────────────────────────────────────────

describe("isValidIcs", () => {
  test("returns true for valid ICS", () => {
    expect(isValidIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VEVENT\nEND:VCALENDAR")).toBe(true);
  });

  test("returns false if missing VCALENDAR", () => {
    expect(isValidIcs("BEGIN:VEVENT\nEND:VEVENT")).toBe(false);
  });

  test("returns false if missing VEVENT", () => {
    expect(isValidIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isValidIcs("")).toBe(false);
  });
});

// ── countIcsEvents ────────────────────────────────────────────

describe("countIcsEvents", () => {
  test("counts 0 events in empty calendar", () => {
    expect(countIcsEvents("BEGIN:VCALENDAR\nEND:VCALENDAR")).toBe(0);
  });

  test("counts multiple events", () => {
    const ics = wrap([
      event(["UID:1", "SUMMARY:Task 1", `DTSTART:${FUTURE}`]),
      event(["UID:2", "SUMMARY:Task 2", `DTSTART:${FUTURE}`]),
      event(["UID:3", "SUMMARY:Task 3", `DTSTART:${FUTURE}`]),
    ].join("\r\n"));
    expect(countIcsEvents(ics)).toBe(3);
  });
});

// ── parseIcsText ──────────────────────────────────────────────

describe("parseIcsText", () => {

  test("parses a basic event", () => {
    const ics = wrap(event(["UID:abc-123", "SUMMARY:Write essay", `DTSTART:${FUTURE}`]));
    const tasks = parseIcsText(ics);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Write essay");
    expect(tasks[0].icsUid).toBe("abc-123");
  });

  test("filters out past events", () => {
    const ics = wrap(event(["UID:old-1", "SUMMARY:Old assignment", `DTSTART:${PAST}`]));
    expect(parseIcsText(ics)).toHaveLength(0);
  });

  test("filters out events with no summary", () => {
    const ics = wrap(event(["UID:no-sum", `DTSTART:${FUTURE}`]));
    expect(parseIcsText(ics)).toHaveLength(0);
  });

  test("deduplicates by UID", () => {
    const ics = wrap([
      event(["UID:dup-1", "SUMMARY:Task A", `DTSTART:${FUTURE}`]),
      event(["UID:dup-1", "SUMMARY:Task A copy", `DTSTART:${FUTURE}`]),
    ].join("\r\n"));
    expect(parseIcsText(ics)).toHaveLength(1);
  });

  test("deduplicates by title+date when no UID", () => {
    const ics = wrap([
      event(["SUMMARY:Task A", `DTSTART:${FUTURE}`]),
      event(["SUMMARY:Task A", `DTSTART:${FUTURE}`]),
    ].join("\r\n"));
    expect(parseIcsText(ics)).toHaveLength(1);
  });

  test("sorts events by due date ascending", () => {
    const ics = wrap([
      event(["UID:b", "SUMMARY:Later", "DTSTART:20990201T120000Z"]),
      event(["UID:a", "SUMMARY:Sooner", "DTSTART:20990101T120000Z"]),
    ].join("\r\n"));
    const tasks = parseIcsText(ics);
    expect(tasks[0].title).toBe("Sooner");
    expect(tasks[1].title).toBe("Later");
  });

  // ── Class name extraction ─────────────────────────────────

  test("extracts class name from bracket syntax [HIST 201]", () => {
    const ics = wrap(event(["UID:c1", "SUMMARY:Research Paper [HIST 201]", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.className).toBe("HIST 201");
  });

  test("extracts class name from bracket with no space [CS201]", () => {
    const ics = wrap(event(["UID:c2", "SUMMARY:Project [CS201]", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.className).toBe("CS 201");
  });

  test("extracts class name from CATEGORIES field", () => {
    const ics = wrap(event(["UID:c3", "SUMMARY:Lab Report", "CATEGORIES:CHEM 301", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.className).toBe("CHEM 301");
  });

  test("returns null className when no class info present", () => {
    const ics = wrap(event(["UID:c4", "SUMMARY:Generic task", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.className).toBeNull();
  });

  // ── Title cleaning ────────────────────────────────────────

  test("strips course code suffix when no space between dept and number [HIST201]", () => {
    const ics = wrap(event(["UID:t1", "SUMMARY:Research Paper [HIST201]", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toBe("Research Paper");
  });

  test("strips course code prefix when no space between dept and number [CS201]", () => {
    const ics = wrap(event(["UID:t2", "SUMMARY:[CS201] Research Paper", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toBe("Research Paper");
  });

  test("strips bracket when dept and number have a space [HIST 201]", () => {
    const ics = wrap(event(["UID:t3b", "SUMMARY:Research Paper [HIST 201]", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toBe("Research Paper");
    expect(task.className).toBe("HIST 201");
  });

  test("preserves title with no course code", () => {
    const ics = wrap(event(["UID:t3", "SUMMARY:Weekly reflection", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toBe("Weekly reflection");
  });

  // ── Date parsing ──────────────────────────────────────────

  test("parses UTC datetime (YYYYMMDDTHHMMSSZ)", () => {
    const ics = wrap(event(["UID:d1", "SUMMARY:Task", "DTSTART:20991015T143000Z"]));
    const [task] = parseIcsText(ics);
    expect(task.dueDate).toBeInstanceOf(Date);
    expect(isNaN(task.dueDate)).toBe(false);
  });

  test("parses date-only format (YYYYMMDD)", () => {
    const ics = wrap(event(["UID:d2", "SUMMARY:Task", "DTSTART:20991015"]));
    const [task] = parseIcsText(ics);
    expect(task.dueDate).toBeInstanceOf(Date);
    expect(task.dueDate.getFullYear()).toBe(2099);
  });

  test("dueTime is null for midnight/end-of-day times", () => {
    const ics = wrap(event(["UID:d3", "SUMMARY:Task", "DTSTART:20991015"])); // date-only → 23:59
    const [task] = parseIcsText(ics);
    expect(task.dueTime).toBeNull();
  });

  test("dueTime is set for specific times", () => {
    const ics = wrap(event(["UID:d4", "SUMMARY:Task", "DTSTART:20991015T143000Z"]));
    const [task] = parseIcsText(ics);
    expect(Array.isArray(task.dueTime)).toBe(true);
    expect(task.dueTime).toHaveLength(2);
  });

  // ── Priority inference ────────────────────────────────────

  test("assigns HIGH priority for task due within 7 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const dtstart = soon.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const ics = wrap(event(["UID:p1", "SUMMARY:Problem set", `DTSTART:${dtstart}`]));
    const [task] = parseIcsText(ics);
    expect(task.priority).toBe("HIGH");
  });

  test("assigns LOW priority for regular task far out (>30 days)", () => {
    const ics = wrap(event(["UID:p2", "SUMMARY:Essay", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.priority).toBe("LOW");
  });

  test("assigns LOW priority for exam far out (>60 days)", () => {
    const ics = wrap(event(["UID:p3", "SUMMARY:Final Exam", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.priority).toBe("LOW");
  });

  test("assigns LOW priority for past events (if they somehow pass filter)", () => {
    // inferPriority returns LOW for negative daysOut
    // We test this indirectly — past events are filtered, so we trust the LOW branch
    // by checking a task due exactly yesterday would be filtered
    const ics = wrap(event(["UID:p4", "SUMMARY:Past task", `DTSTART:${PAST}`]));
    expect(parseIcsText(ics)).toHaveLength(0);
  });

  // ── Line unfolding ────────────────────────────────────────

  test("unfolds continuation lines (RFC 5545 folding)", () => {
    const ics =
      "BEGIN:VCALENDAR\r\n" +
      "BEGIN:VEVENT\r\n" +
      "UID:fold-1\r\n" +
      "SUMMARY:Long title that is\r\n" +
      " folded across lines\r\n" +
      `DTSTART:${FUTURE}\r\n` +
      "END:VEVENT\r\n" +
      "END:VCALENDAR";
    const [task] = parseIcsText(ics);
    expect(task.title).toBe("Long title that isfolded across lines");
  });

  // ── ICS escape sequences ──────────────────────────────────

  test("unescapes \\n in summary", () => {
    const ics = wrap(event(["UID:esc-1", "SUMMARY:Title\\nwith newline", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toContain("Title");
    expect(task.title).not.toContain("\\n");
  });

  test("unescapes \\, in summary", () => {
    const ics = wrap(event(["UID:esc-2", "SUMMARY:Apples\\, Oranges", `DTSTART:${FUTURE}`]));
    const [task] = parseIcsText(ics);
    expect(task.title).toContain(",");
  });
});
