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
  writeBatch,
} from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  confirmPasswordReset,
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
export { auth, confirmPasswordReset };

// ── Auth ─────────────────────────────────────────────────────

export const loginUser = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  if (!cred.user.emailVerified) {
    await signOut(auth);
    throw new Error("Please verify your email before logging in. Check your inbox for a verification link.");
  }
  return cred;
};

export const registerUser = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await signOut(auth);
  return cred;
};

export const logoutUser = async () => {
  const { cancelAllNotifications } = await import("./notifications");
  await cancelAllNotifications().catch(() => {});
  return signOut(auth);
};

export const resetPassword = async (email) => {
  const { VERCEL_API_URL } = await import("../config");
  const res = await fetch(`${VERCEL_API_URL}/api/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-secret": process.env.EXPO_PUBLIC_EMAIL_API_SECRET ?? "",
    },
    body: JSON.stringify({ type: "reset", email }),
  });
  if (!res.ok) throw new Error("Failed to send reset email");
};

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

// Batch-delete all completed tasks for a user
export const clearCompletedTasks = async (userId) => {
  const q = query(
    collection(db, "tasks"),
    where("userId", "==", userId),
    where("completed", "==", true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
};

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

// ── Chat history (Scholar only — cross-device persistence) ───

const CHAT_HISTORY_MAX = 40; // messages stored in Firestore

export const loadChatHistory = async (userId) => {
  try {
    const snap = await getDoc(doc(db, "userProfiles", userId));
    if (!snap.exists()) return [];
    return snap.data().chatHistory ?? [];
  } catch {
    return [];
  }
};

export const saveChatHistory = (userId, messages) => {
  const toStore = messages.slice(-CHAT_HISTORY_MAX);
  return setDoc(
    doc(db, "userProfiles", userId),
    { chatHistory: toStore },
    { merge: true }
  ).catch(() => {});
};

export const clearChatHistory = (userId) =>
  setDoc(
    doc(db, "userProfiles", userId),
    { chatHistory: [] },
    { merge: true }
  ).catch(() => {});

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