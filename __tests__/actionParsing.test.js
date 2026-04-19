// Tests for the %%ACTION%% parsing logic used in sendChatMessage.
// The regex and parse logic is extracted here for unit testing.

const ACTION_REGEX = /%%ACTION:(.+?)%%/s;

const parseAction = (raw) => {
  const match = raw.match(ACTION_REGEX);
  if (!match) return { text: raw.trim(), action: null };
  let action = null;
  try { action = JSON.parse(match[1]); } catch {}
  const text = raw.replace(/\n?%%ACTION:.+?%%/s, "").trim();
  return { text, action };
};

describe("%%ACTION%% parsing", () => {

  test("returns null action when no block present", () => {
    const { text, action } = parseAction("Here is my advice for you.");
    expect(action).toBeNull();
    expect(text).toBe("Here is my advice for you.");
  });

  test("parses createTask action", () => {
    const raw = `I'll add that for you.\n%%ACTION:{"type":"createTask","title":"Essay draft","dueDate":"2099-03-15","className":"HIST 201","priority":"HIGH"}%%`;
    const { text, action } = parseAction(raw);
    expect(action.type).toBe("createTask");
    expect(action.title).toBe("Essay draft");
    expect(action.dueDate).toBe("2099-03-15");
    expect(action.className).toBe("HIST 201");
    expect(action.priority).toBe("HIGH");
    expect(text).toBe("I'll add that for you.");
  });

  test("parses createTasks action with multiple tasks", () => {
    const tasks = [
      { title: "Outline", dueDate: "2099-03-10", className: "ENG 101", priority: "MEDIUM" },
      { title: "Draft",   dueDate: "2099-03-12", className: "ENG 101", priority: "HIGH" },
      { title: "Revise",  dueDate: "2099-03-14", className: "ENG 101", priority: "HIGH" },
    ];
    const raw = `Here are your subtasks.\n%%ACTION:{"type":"createTasks","tasks":${JSON.stringify(tasks)}}%%`;
    const { text, action } = parseAction(raw);
    expect(action.type).toBe("createTasks");
    expect(action.tasks).toHaveLength(3);
    expect(action.tasks[0].title).toBe("Outline");
    expect(text).toBe("Here are your subtasks.");
  });

  test("strips action block from text cleanly", () => {
    const raw = `Focus on this task first.\n%%ACTION:{"type":"createTask","title":"Lab report","dueDate":null,"className":null,"priority":"MEDIUM"}%%`;
    const { text } = parseAction(raw);
    expect(text).not.toContain("%%ACTION");
    expect(text).not.toContain("%%");
    expect(text).toBe("Focus on this task first.");
  });

  test("returns null action for malformed JSON", () => {
    const raw = `Some reply.\n%%ACTION:{bad json here}%%`;
    const { action } = parseAction(raw);
    expect(action).toBeNull();
  });

  test("handles createTask with null dueDate and className", () => {
    const raw = `Added it.\n%%ACTION:{"type":"createTask","title":"Misc task","dueDate":null,"className":null,"priority":"LOW"}%%`;
    const { action } = parseAction(raw);
    expect(action.dueDate).toBeNull();
    expect(action.className).toBeNull();
    expect(action.priority).toBe("LOW");
  });

  test("does not corrupt text when action is on same line", () => {
    const raw = `Sure!%%ACTION:{"type":"createTask","title":"Quiz prep","dueDate":null,"className":null,"priority":"MEDIUM"}%%`;
    const { text, action } = parseAction(raw);
    expect(action.title).toBe("Quiz prep");
    expect(text).toBe("Sure!");
  });
});
