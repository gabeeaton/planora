// ============================================================
// utils/ThemeContext.js — React Context for live theming
// Separated from theme.js to avoid circular imports.
// Import useTheme() here, NOT from theme.js
// ============================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildColors, COLOR_THEMES } from "./theme";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children, initialTheme = "purple" }) => {
  const [accentKey, setAccentKey] = useState(initialTheme);

  const colors = buildColors(true, accentKey);

  const setTheme = async (key) => {
    setAccentKey(key);
    await AsyncStorage.setItem("@tf_accent", key).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ colors, accentKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};