// ============================================================
// utils/ThemeContext.js — React Context for live theming
// Separated from theme.js to avoid circular imports.
// Import useTheme() here, NOT from theme.js
// ============================================================

import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildColors, COLOR_THEMES } from "./theme";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children, initialTheme = "purple", initialMode = "system" }) => {
  const [accentKey,  setAccentKey]  = useState(initialTheme);
  const [colorMode,  setColorModeState] = useState(initialMode); // "dark" | "light" | "system"
  const systemScheme = useColorScheme(); // "dark" | "light" | null

  const isDark = colorMode === "system"
    ? (systemScheme ?? "dark") === "dark"
    : colorMode === "dark";

  const colors = buildColors(isDark, accentKey);

  const setTheme = async (key) => {
    setAccentKey(key);
    await AsyncStorage.setItem("@tf_accent", key).catch(() => {});
  };

  const setColorMode = async (mode) => {
    setColorModeState(mode);
    await AsyncStorage.setItem("@tf_color_mode", mode).catch(() => {});
  };

  // Backward-compat shim for any code still calling setDarkMode(bool)
  const setDarkMode = async (dark) => setColorMode(dark ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ colors, accentKey, isDark, colorMode, setTheme, setColorMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
