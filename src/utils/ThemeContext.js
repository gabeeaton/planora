// ============================================================
// utils/ThemeContext.js — React Context for live theming
// Separated from theme.js to avoid circular imports.
// Import useTheme() here, NOT from theme.js
// ============================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildColors, COLOR_THEMES } from "./theme";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children, initialTheme = "purple", initialDark = true }) => {
  const [accentKey, setAccentKey] = useState(initialTheme);
  const [isDark,    setIsDark]    = useState(initialDark);

  const colors = buildColors(isDark, accentKey);

  const setTheme = async (key) => {
    setAccentKey(key);
    await AsyncStorage.setItem("@tf_accent", key).catch(() => {});
  };

  const setDark = async (dark) => {
    setIsDark(dark);
    await AsyncStorage.setItem("@tf_dark", String(dark)).catch(() => {});
  };

  const toggleDark = () => setDark(!isDark);

  return (
    <ThemeContext.Provider value={{ colors, accentKey, isDark, setTheme, setDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};