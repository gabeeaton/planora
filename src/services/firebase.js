// ============================================================
// src/services/firebase.js
// ============================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, updateDoc,
  deleteDoc, doc, query, where, orderBy,
  onSnapshot, Timestamp, setDoc, getDoc, getDocs, limit,
} from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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

export const loginUser    = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const registerUser = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const logoutUser   = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── Tasks ────────────────────────────────────────────────────

export const subscribeTasks = (userId, callback) => {
  const q = query(
    collection(db, "tasks"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate(),
      dueDate:   d.data().dueDate?.toDate(),
    }));
    callback(tasks);
  });
};

export const addTask = (userId, taskData) =>
  addDoc(collection(db, "tasks"), {
    ...taskData,
    userId,
    completed: false,
    createdAt: Timestamp.now(),
    lastTouchedAt: Timestamp.now(),
    dueDate: taskData.dueDate ? Timestamp.fromDate(new Date(taskData.dueDate)) : null,
  });

export const updateTask = (taskId, updates) => {
  const data = { ...updates, lastTouchedAt: Timestamp.now() };
  if (updates.dueDate instanceof Date) data.dueDate = Timestamp.fromDate(updates.dueDate);
  return updateDoc(doc(db, "tasks", taskId), data);
};

export const toggleTask = async (taskId, currentStatus) => {
  await updateDoc(doc(db, "tasks", taskId), {
    completed:    !currentStatus,
    completedAt:  !currentStatus ? Timestamp.now() : null,
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
      userId:             task.userId,
      taskId:             task.id,
      title:              task.title,
      classId:            task.classId   ?? null,
      className:          task.className ?? null,
      priority:           task.priority  ?? null,
      completedAt:        Timestamp.now(),
      dueDate:            dueDate ? Timestamp.fromDate(dueDate) : null,
      daysBeforeDeadline, // negative = completed late
      createdAt:          task.createdAt ? Timestamp.fromDate(new Date(task.createdAt)) : null,
    });
  } catch (err) {
    // Non-critical — don't surface to user
    console.warn("Failed to record task history:", err);
  }
};

/**
 * Load last N completed task history records for pattern analysis.
 */
export const loadTaskHistory = async (userId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, "taskHistory"),
      where("userId", "==", userId),
      orderBy("completedAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      completedAt: d.data().completedAt?.toDate(),
      dueDate:     d.data().dueDate?.toDate(),
    }));
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