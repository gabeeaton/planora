import React, { useState, useEffect } from "react";
import { Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTasks } from "./src/hooks/useTasks";
import CompletionShareSheet from "./src/components/CompletionShareSheet";

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: "Outfit-Regular" };

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = { fontFamily: "Outfit-Regular" };
import * as Sentry from "@sentry/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./src/hooks/useAuth";
import { UserProfileProvider } from "./src/hooks/useUserProfile";
import { TasksProvider } from "./src/hooks/useTasks";
import { ThemeProvider } from "./src/utils/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configurePurchases } from "./src/services/purchases";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";

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
  const [savedMode,  setSavedMode]  = useState("system");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("@tf_accent"),
      AsyncStorage.getItem("@tf_color_mode"),
      AsyncStorage.getItem("@tf_dark"), // legacy key for migration
    ]).then(([accent, colorMode, legacyDark]) => {
      if (accent) setSavedTheme(accent);
      if (colorMode) {
        setSavedMode(colorMode);
      } else if (legacyDark !== null) {
        // Migrate old boolean key → explicit mode (never "system" — they opted in)
        setSavedMode(legacyDark !== "0" ? "dark" : "light");
      }
      // else: no saved pref → default "system" stays
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return { ready, savedTheme, savedMode };
};

// Renders inside TasksProvider so it can read recentlyCompleted from context
function ShareSheetOverlay() {
  const { recentlyCompleted, clearRecentlyCompleted, streak } = useTasks();
  if (!recentlyCompleted) return null;
  return (
    <CompletionShareSheet
      task={recentlyCompleted}
      streak={recentlyCompleted._streakAtCompletion ?? streak}
      onDismiss={clearRecentlyCompleted}
    />
  );
}

function App() {
  const { ready, savedTheme, savedMode } = useInitialTheme();
  const [fontsLoaded] = useFonts({
    "Outfit-Regular":   Outfit_400Regular,
    "Outfit-Medium":    Outfit_500Medium,
    "Outfit-SemiBold":  Outfit_600SemiBold,
    "Outfit-Bold":      Outfit_700Bold,
    "Outfit-ExtraBold": Outfit_800ExtraBold,
  });
  if (!ready || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
    <ThemeProvider initialTheme={savedTheme} initialMode={savedMode}>
      <AuthProvider>
        <UserProfileProvider>
          <TasksProvider>
            <StatusBar style="auto" />
            <AppNavigator />
            <ShareSheetOverlay />
          </TasksProvider>
        </UserProfileProvider>
      </AuthProvider>
    </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
