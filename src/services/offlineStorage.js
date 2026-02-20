// ============================================================
// services/offlineStorage.js
// Caches tasks locally using AsyncStorage so the app works
// without an internet connection. Firestore's own persistence
// handles most offline cases, but this adds an extra layer
// for immediate UI availability on app launch.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const TASKS_KEY = "@taskflow_tasks";
const USER_KEY = "@taskflow_user";

/**
 * Save tasks to local device storage.
 * Called every time Firestore snapshot updates.
 */
export const cacheTasksLocally = async (tasks) => {
  try {
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to cache tasks:", error);
  }
};

/**
 * Load tasks from local device storage.
 * Used on app launch before Firestore responds.
 * @returns {Promise<Array>} - Cached tasks or empty array
 */
export const loadCachedTasks = async () => {
  try {
    const data = await AsyncStorage.getItem(TASKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load cached tasks:", error);
    return [];
  }
};

/**
 * Save user session info locally for faster startup.
 */
export const cacheUserSession = async (user) => {
  try {
    if (user) {
      await AsyncStorage.setItem(
        USER_KEY,
        JSON.stringify({ uid: user.uid, email: user.email })
      );
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
  } catch (error) {
    console.error("Failed to cache user session:", error);
  }
};

/**
 * Load cached user session.
 * @returns {Promise<object|null>}
 */
export const loadCachedUser = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
};

/**
 * Clear all cached data (called on logout).
 */
export const clearCache = async () => {
  try {
    await AsyncStorage.multiRemove([TASKS_KEY, USER_KEY]);
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
};
