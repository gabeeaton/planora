// ============================================================
// src/services/firebase.js
// ============================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  setDoc,
  getDoc,
  getDocs,
  limit,
} from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "../config";

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

export const db = getFirestore(app);
export { auth };

// ── Auth ─────────────────────────────────────────────────────

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);
export const registerUser = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred;
};
export const logoutUser = () => signOut(auth);
export const resendVerificationEmail = () =>
  sendEmailVerification(auth.currentUser);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── Tasks ────────────────────────────────────────────────────

export const subscribeTasks = (userId, callback) => {
  const q = query(
    collection(db, "tasks"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        // Sanitize className on READ so any old bad data in Firestore is fixed immediately
        className: resolveClassName(data.className),
        createdAt: data.createdAt?.toDate(),
        dueDate: data.dueDate?.toDate(),
      };
    });
    callback(tasks);
  });
};

// Normalise className — guard against accidentally passing a full class object
// e.g. {name, id, creditHours, grade} instead of just a name string.
const resolveClassName = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.name) return String(v.name);
  return null;
};

export const addTask = (userId, taskData) =>
  addDoc(collection(db, "tasks"), {
    ...taskData,
    userId,
    completed: false,
    createdAt: Timestamp.now(),
    lastTouchedAt: Timestamp.now(),
    className: resolveClassName(taskData.className),
    dueDate: taskData.dueDate
      ? Timestamp.fromDate(new Date(taskData.dueDate))
      : null,
  });

export const updateTask = (taskId, updates) => {
  const data = { ...updates, lastTouchedAt: Timestamp.now() };
  if (updates.dueDate instanceof Date)
    data.dueDate = Timestamp.fromDate(updates.dueDate);
  // Sanitise className on edits too
  if ("className" in updates)
    data.className = resolveClassName(updates.className);
  return updateDoc(doc(db, "tasks", taskId), data);
};

export const toggleTask = async (taskId, currentStatus) => {
  await updateDoc(doc(db, "tasks", taskId), {
    completed: !currentStatus,
    completedAt: !currentStatus ? Timestamp.now() : null,
    lastTouchedAt: Timestamp.now(),
  });
};

export const deleteTask = (taskId) => deleteDoc(doc(db, "tasks", taskId));

// ── Task History (for pattern analysis) ──────────────────────

/**
 * Called when a task is completed. Writes a history record
 * so the AI can learn the user's patterns over time.
 */
export const recordTaskCompletion = async (task) => {
  try {
    const now = new Date();
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const daysBeforeDeadline = dueDate
      ? Math.round((dueDate - now) / (1000 * 60 * 60 * 24))
      : null;

    await addDoc(collection(db, "taskHistory"), {
      userId: task.userId,
      taskId: task.id,
      title: task.title,
      classId: task.classId ?? null,
      className: resolveClassName(task.className),
      priority: task.priority ?? null,
      completedAt: Timestamp.now(),
      dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
      daysBeforeDeadline, // negative = completed late
      createdAt: task.createdAt
        ? Timestamp.fromDate(new Date(task.createdAt))
        : null,
    });
  } catch (err) {
    // Non-critical — don't surface to user
    console.warn("Failed to record task history:", err);
  }
};

/**
 * Load last N completed task history records for pattern analysis.
 * Uses a simple where-only query (no orderBy) to avoid requiring a
 * composite Firestore index. Results are sorted client-side.
 */
export const loadTaskHistory = async (userId, limitCount = 100) => {
  try {
    // Simple single-field query — no composite index needed
    const q = query(
      collection(db, "taskHistory"),
      where("userId", "==", userId),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const records = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      completedAt: d.data().completedAt?.toDate() ?? null,
      dueDate: d.data().dueDate?.toDate() ?? null,
    }));
    // Sort client-side: most recent first
    records.sort((a, b) => {
      if (!a.completedAt && !b.completedAt) return 0;
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return b.completedAt - a.completedAt;
    });
    return records;
  } catch (err) {
    console.warn("Failed to load task history:", err);
    return [];
  }
};

// ── User Profile ─────────────────────────────────────────────

/**
 * Save or update user's academic profile (classes, preferences).
 * Uses setDoc with merge so partial updates work.
 */
export const saveUserProfile = (userId, profileData) =>
  setDoc(doc(db, "userProfiles", userId), profileData, { merge: true });

/**
 * Fetch user's academic profile once.
 */
export const getUserProfile = async (userId) => {
  try {
    const snap = await getDoc(doc(db, "userProfiles", userId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn("Failed to load user profile:", err);
    return null;
  }
};

/**
 * Subscribe to real-time profile updates.
 */
export const subscribeUserProfile = (userId, callback) =>
  onSnapshot(doc(db, "userProfiles", userId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });

// ── Subscription ─────────────────────────────────────────────

/**
 * Upgrade user to Pro. In production this would be triggered
 * server-side via RevenueCat webhook — not from the client.
 * For now, used during development/beta testing only.
 */
export const setProStatus = (userId, isPro) =>
  setDoc(
    doc(db, "userProfiles", userId),
    { isPro, proSince: isPro ? Timestamp.now() : null },
    { merge: true }
  );