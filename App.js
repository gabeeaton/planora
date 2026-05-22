import React, { useState, useEffect } from "react";
import { Text, TextInput, View, Appearance } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTasks } from "./src/hooks/useTasks";
import CompletionShareSheet from "./src/components/CompletionShareSheet";

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: "Outfit-Regular" };

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = { fontFamily: "Outfit-Regular" };
import * as Sentry from "@sentry/react-native";
import { PostHogProvider } from "posthog-react-native";
import { posthog } from "./src/services/analytics";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./src/hooks/useAuth";
import { UserProfileProvider } from "./src/hooks/useUserProfile";
import { TasksProvider } from "./src/hooks/useTasks";
import { ThemeProvider } from "./src/utils/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configurePurchases } from "./src/services/purchases";
import { Asset } from "expo-asset";
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from "@expo-google-fonts/outfit";

// Preload critical assets — promise held so App can block on it
const assetsReady = Asset.loadAsync([
  require("./src/assets/logo.png"),
  require("./src/assets/planora-brand.jpg"),
  require("./src/assets/spotify-logo.png"),
  require("./src/assets/apple-music-logo.jpg"),
]).catch(() => {});

// Configure RevenueCat early — before any purchase calls
configurePurchases(null);

Sentry.init({
  dsn: "https://692a36ec23dd2a1bffca312ca67131a3@o4511198085971968.ingest.us.sentry.io/4511199536676864",
  tracesSampleRate: 0.2, // capture 20% of transactions for performance monitoring
  enableAutoSessionTracking: true,
  _experiments: { profilesSampleRate: 0.1 },
});

// Load saved theme prefs + critical assets before first render to avoid flash
const useInitialTheme = () => {
  const [ready,      setReady]      = useState(false);
  const [savedTheme, setSavedTheme] = useState("purple");
  const [savedMode,  setSavedMode]  = useState("system");

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("@tf_accent"),
      AsyncStorage.getItem("@tf_color_mode"),
      AsyncStorage.getItem("@tf_dark"),
      assetsReady,
    ]).then(([accent, colorMode, legacyDark]) => {
      if (accent) setSavedTheme(accent);
      if (colorMode) {
        setSavedMode(colorMode);
      } else if (legacyDark !== null) {
        setSavedMode(legacyDark !== "0" ? "dark" : "light");
      }
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
  // Timeout fallback: if fonts hang for >4s in production, proceed anyway
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!ready || (!fontsLoaded && !fontTimeout)) {
    const bg = Appearance.getColorScheme() === "dark" ? "#0A0A0F" : "#F7F7F9";
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }

  return (
    <PostHogProvider client={posthog}>
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
    </PostHogProvider>
  );
}

export default Sentry.wrap(App);
