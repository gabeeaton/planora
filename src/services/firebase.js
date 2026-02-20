import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, updateDoc,
  deleteDoc, doc, query, where, orderBy,
  onSnapshot, Timestamp,
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

// Now that metro.config.js fixes the .cjs resolution,
// initializeAuth works correctly
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

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, callback);

export const subscribeTasks = (userId, callback) => {
  const q = query(
    collection(db, "tasks"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt?.toDate(),
      dueDate: d.data().dueDate?.toDate(),
    }));
    callback(tasks);
  });
};

export const addTask = (userId, taskData) =>
  addDoc(collection(db, "tasks"), {
    ...taskData, userId, completed: false,
    createdAt: Timestamp.now(),
    dueDate: taskData.dueDate ? Timestamp.fromDate(new Date(taskData.dueDate)) : null,
  });

export const updateTask = (taskId, updates) => {
  const data = { ...updates };
  if (updates.dueDate instanceof Date) data.dueDate = Timestamp.fromDate(updates.dueDate);
  return updateDoc(doc(db, "tasks", taskId), data);
};

export const toggleTask = (taskId, currentStatus) =>
  updateDoc(doc(db, "tasks", taskId), {
    completed: !currentStatus,
    completedAt: !currentStatus ? Timestamp.now() : null,
  });

export const deleteTask = (taskId) => deleteDoc(doc(db, "tasks", taskId));