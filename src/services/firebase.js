// ============================================================
// src/services/firebase.js
// FIXED: Email verification now sends properly
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
  sendPasswordResetEmail,
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

export const loginUser = async (email, password) => {
  // NOTE: Email verification gate removed — Firebase Dynamic Links is shut down,
  // which breaks the verification email flow for mobile apps.
  // Users can now log in without verifying their email.
  // To re-enable: set up a custom action URL in Firebase Console →
  // Authentication → Templates → Email address verification → Customize action URL
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred;
};

export const registerUser = async (email, password) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // NOT signing out after registration — Dynamic Links is shut down so
    // verification emails don't work for mobile. User goes straight into the app.
    // Re-enable email gate once you set up a custom action URL.
    return cred;
  } catch (err) {
    console.error("Registration error:", err);
    throw err;
  }
};

export const logoutUser = () => signOut(auth);

export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── Tasks ────────────────────────────────────────────────────

const resolveClassName = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.name) return String(v.name);
  return null;
};

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
        className: resolveClassName(data.className),
        createdAt: data.createdAt?.toDate(),
        dueDate: data.dueDate?.toDate(),
      };
    });
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
    className: resolveClassName(taskData.className),
    dueDate: taskData.dueDate
      ? Timestamp.fromDate(new Date(taskData.dueDate))
      : null,
  });

export const updateTask = (taskId, updates) => {
  const data = { ...updates, lastTouchedAt: Timestamp.now() };
  if (updates.dueDate instanceof Date)
    data.dueDate = Timestamp.fromDate(updates.dueDate);
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

// ── Task History ─────────────────────────────────────────────

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
      daysBeforeDeadline,
      createdAt: task.createdAt
        ? Timestamp.fromDate(new Date(task.createdAt))
        : null,
    });
  } catch (err) {
    console.warn("Failed to record task history:", err);
  }
};

export const loadTaskHistory = async (userId, limitCount = 100) => {
  try {
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

export const saveUserProfile = (userId, profileData) =>
  setDoc(doc(db, "userProfiles", userId), profileData, { merge: true });

export const getUserProfile = async (userId) => {
  try {
    const snap = await getDoc(doc(db, "userProfiles", userId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn("Failed to load user profile:", err);
    return null;
  }
};

export const subscribeUserProfile = (userId, callback) =>
  onSnapshot(doc(db, "userProfiles", userId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });

// ── Subscription ─────────────────────────────────────────────

export const setProStatus = (userId, isPro) =>
  setDoc(
    doc(db, "userProfiles", userId),
    {
      isPro,
      proSince: isPro ? Timestamp.now() : null,
    },
    { merge: true }
  );