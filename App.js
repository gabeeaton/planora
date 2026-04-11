import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { AuthProvider } from "./src/hooks/useAuth";
import { ThemeProvider } from "./src/utils/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configurePurchases } from "./src/services/purchases";

// Configure RevenueCat early — before any purchase calls
configurePurchases(null);

Sentry.init({
  dsn: "https://692a36ec23dd2a1bffca312ca67131a3@o4511198085971968.ingest.us.sentry.io/4511199536676864",
  tracesSampleRate: 0.2, // capture 20% of transactions for performance monitoring
  enableAutoSessionTracking: true,
  _experiments: { profilesSampleRate: 0.1 },
});

// Load saved theme prefs before first render to avoid flash
const useInitialTheme = () => {
  const [ready,      setReady]      = useState(false);
  const [savedTheme, setSavedTheme] = useState("purple");

  useEffect(() => {
    AsyncStorage.getItem("@tf_accent").then((accent) => {
      if (accent) setSavedTheme(accent);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return { ready, savedTheme };
};

function App() {
  const { ready, savedTheme } = useInitialTheme();
  if (!ready) return null;

  return (
    <ThemeProvider initialTheme={savedTheme}>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(App);
