// ============================================================
// src/services/offlineStorage.js
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const TASKS_KEY   = "@taskflow_tasks";
const USER_KEY    = "@taskflow_user";
const PROFILE_KEY = "@taskflow_profile";
const HISTORY_KEY = "@taskflow_history";

export const cacheTasksLocally = async (tasks) => {
  try { await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
  catch (e) { console.error("Failed to cache tasks:", e); }
};

export const loadCachedTasks = async () => {
  try {
    const data = await AsyncStorage.getItem(TASKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const cacheUserSession = async (user) => {
  try {
    if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify({ uid: user.uid, email: user.email }));
    else       await AsyncStorage.removeItem(USER_KEY);
  } catch (e) { console.error("Failed to cache user session:", e); }
};

export const loadCachedUser = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

export const cacheUserProfile = async (profile) => {
  try {
    if (profile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else         await AsyncStorage.removeItem(PROFILE_KEY);
  } catch (e) { console.error("Failed to cache profile:", e); }
};

export const loadCachedProfile = async () => {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

export const cacheTaskHistory = async (history) => {
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch (e) { console.error("Failed to cache history:", e); }
};

export const loadCachedHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const clearCache = async () => {
  try { await AsyncStorage.multiRemove([TASKS_KEY, USER_KEY, PROFILE_KEY, HISTORY_KEY]); }
  catch (e) { console.error("Failed to clear cache:", e); }
};