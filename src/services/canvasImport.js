// ============================================================
// src/services/canvasImport.js
// Canvas LMS REST API integration.
// No OAuth needed — students generate a personal access token
// from Canvas Account Settings in ~30 seconds.
// Supports: canvas.instructure.com hosted and self-hosted instances.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY  = "@taskflow_canvas_token";
const DOMAIN_KEY = "@taskflow_canvas_domain";

// ── Credential storage ────────────────────────────────────────

export const saveCanvasCredentials = async (domain, token) => {
  // Normalize domain — strip https://, trailing slashes
  const clean = domain.replace(/^https?:\/\//i, "").replace(/\/$/, "").trim();
  await AsyncStorage.setItem(DOMAIN_KEY, clean);
  await AsyncStorage.setItem(TOKEN_KEY, token.trim());
};

export const loadCanvasCredentials = async () => {
  const [domain, token] = await Promise.all([
    AsyncStorage.getItem(DOMAIN_KEY),
    AsyncStorage.getItem(TOKEN_KEY),
  ]);
  return { domain, token };
};

export const clearCanvasCredentials = async () => {
  await AsyncStorage.multiRemove([DOMAIN_KEY, TOKEN_KEY]);
};

export const hasCanvasCredentials = async () => {
  const { domain, token } = await loadCanvasCredentials();
  return !!(domain && token);
};

// ── API helpers ───────────────────────────────────────────────

const canvasFetch = async (domain, token, path) => {
  const url = `https://${domain}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) throw new Error("Invalid Canvas token. Please check your access token and try again.");
  if (res.status === 404) throw new Error("Canvas domain not found. Check your institution's Canvas URL.");
  if (!res.ok)            throw new Error(`Canvas API error (${res.status}). Please try again.`);

  return res.json();
};

// Handle Canvas pagination (Link header)
const canvasFetchAll = async (domain, token, path) => {
  const results = [];
  let url = `https://${domain}${path}`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (res.status === 401) throw new Error("Invalid Canvas token. Please check your access token and try again.");
    if (!res.ok)            throw new Error(`Canvas API error (${res.status}).`);

    const data = await res.json();
    results.push(...(Array.isArray(data) ? data : []));

    // Parse Link header for next page
    const linkHeader = res.headers.get("Link") ?? "";
    const nextMatch  = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return results;
};

// ── Priority inference ────────────────────────────────────────

const inferPriority = (title = "", submissionTypes = []) => {
  const t = title.toLowerCase();
  if (t.includes("exam") || t.includes("final") || t.includes("midterm") || t.includes("test"))
    return "HIGH";
  if (t.includes("project") || t.includes("paper") || t.includes("essay") || t.includes("presentation"))
    return "MEDIUM";
  if (submissionTypes?.includes("online_quiz"))
    return "MEDIUM";
  return "LOW";
};

// ── Main import function ──────────────────────────────────────

/**
 * Fetches all upcoming assignments from Canvas.
 * Returns array of TaskFlow-compatible task objects.
 *
 * @param {string} domain - e.g. "university.instructure.com"
 * @param {string} token  - Canvas personal access token
 * @returns {Promise<Array>} tasks ready for createManyTasks()
 */
export const fetchCanvasAssignments = async (domain, token) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 1. Get active courses so we can map courseId → courseName
  const courses = await canvasFetch(domain, token,
    "/api/v1/courses?enrollment_state=active&per_page=50"
  );

  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error("No active courses found in Canvas. Make sure you're enrolled in current courses.");
  }

  const courseMap = {};
  courses.forEach((c) => {
    if (c.id && c.name) courseMap[c.id] = c.name;
  });

  // 2. Fetch upcoming assignments for each active course
  const assignmentPromises = courses
    .filter((c) => c.id && !c.access_restricted_by_date)
    .map((c) =>
      canvasFetchAll(domain, token,
        `/api/v1/courses/${c.id}/assignments?per_page=50&order_by=due_at&bucket=future`
      ).catch(() => []) // skip courses that fail (access restrictions, etc.)
    );

  const allAssignmentArrays = await Promise.all(assignmentPromises);
  const allAssignments = allAssignmentArrays.flat();

  if (allAssignments.length === 0) {
    throw new Error("No upcoming assignments found. Either there are none due, or Canvas assignments may not be enabled for your courses.");
  }

  // 3. Transform to TaskFlow format
  const tasks = allAssignments
    .filter((a) => {
      if (!a || !a.name) return false;
      if (a.submission?.submitted_at) return false; // already submitted
      // Only include assignments with a future due date, or undated
      if (a.due_at) {
        const due = new Date(a.due_at);
        return due >= now;
      }
      return true; // include undated assignments
    })
    .map((a) => {
      const courseName = courseMap[a.course_id] ?? null;
      const dueDate    = a.due_at ? new Date(a.due_at) : null;

      // Strip HTML from description
      const rawDesc  = a.description ?? "";
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

      return {
        title:       a.name.trim(),
        description: cleanDesc,
        dueDate,
        priority:    inferPriority(a.name, a.submission_types),
        className:   courseName,
        canvasId:    String(a.id), // store for deduplication
      };
    })
    // Deduplicate by title + course (Canvas sometimes returns duplicates)
    .filter((task, idx, arr) =>
      arr.findIndex((t) => t.title === task.title && t.className === task.className) === idx
    )
    // Sort by due date
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    });

  return tasks;
};

/**
 * Quick connection test — verifies domain and token are valid.
 * Returns the user's Canvas display name on success.
 */
export const testCanvasConnection = async (domain, token) => {
  const user = await canvasFetch(domain, token, "/api/v1/users/self/profile");
  return user?.name ?? "Connected";
};