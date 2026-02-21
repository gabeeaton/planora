import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/hooks/useAuth";
import { ThemeProvider } from "./src/utils/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Load saved theme prefs before first render to avoid flash
const useInitialTheme = () => {
  const [ready,      setReady]      = useState(false);
  const [savedTheme, setSavedTheme] = useState("purple");
  const [savedDark,  setSavedDark]  = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(["@tf_accent", "@tf_dark"]).then((pairs) => {
      const accent = pairs[0][1];
      const dark   = pairs[1][1];
      if (accent) setSavedTheme(accent);
      if (dark !== null) setSavedDark(dark !== "false");
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return { ready, savedTheme, savedDark };
};

export default function App() {
  const { ready, savedTheme, savedDark } = useInitialTheme();
  if (!ready) return null;

  return (
    <ThemeProvider initialTheme={savedTheme} initialDark={savedDark}>
      <AuthProvider>
        <StatusBar style={savedDark ? "light" : "dark"} />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}