// ============================================================
// src/navigation/AppNavigator.js
// ============================================================

import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuth }          from "../hooks/useAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUserProfile }   from "../hooks/useUserProfile";
import DashboardScreen      from "../screens/DashboardScreen";
import ProfileScreen        from "../screens/ProfileScreen";
import AuthScreen           from "../screens/AuthScreen";
import OnboardingScreen     from "../screens/OnboardingScreen";
import WeeklyBriefingScreen from "../screens/WeeklyBriefingScreen";
import PaywallScreen        from "../screens/PaywallScreen";
import { useTheme } from "../utils/ThemeContext";
import SyllabusParserScreen from "../screens/SyllabusParserScreen";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Custom Tab Bar ────────────────────────────────────────────

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[tabStyles.container, { paddingBottom: insets.bottom + 8, backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconName  = { Dashboard: "home", WeeklyTab: "calendar", Profile: "user" }[route.name] ?? "circle";
        const label     = { Dashboard: "Home", WeeklyTab: "Weekly",   Profile: "Profile" }[route.name] ?? route.name;

        const onPress = () => {
          if (route.name === "WeeklyTab") {
            navigation.navigate("WeeklyBriefing");
            return;
          }
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={tabStyles.tab} activeOpacity={0.7}>
            <View style={[tabStyles.iconWrap, isFocused && { backgroundColor: colors.accentGlow }]}>
              <Feather name={iconName} size={20} color={isFocused ? colors.accent : colors.textMuted} />
            </View>
            <Text style={[tabStyles.label, isFocused && { color: colors.accent }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 6,
  },
  tab:      { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  label:    { fontSize: 10, fontWeight: "600", color: "#44445A", textTransform: "uppercase", letterSpacing: 0.3 },
});

// ── Weekly tab — only navigates once per press, not on every focus ─

const WeeklyTabScreen = () => (
  <View style={{ flex: 1 }} />
);

// ── Main tab navigator ────────────────────────────────────────

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="WeeklyTab" component={WeeklyTabScreen} />
    <Tab.Screen name="Profile"   component={ProfileScreen} />
  </Tab.Navigator>
);

// ── Root navigator ────────────────────────────────────────────

const AppNavigator = () => {
  const { user, loading: authLoading }                              = useAuth();
  const { profile, hasCompletedOnboarding, loading: profileLoading } = useUserProfile();
  const { setTheme, setDark, colors }                               = useTheme();

  // Sync theme from profile whenever it loads/changes
  useEffect(() => {
    if (profile?.colorTheme) {
      setTheme(profile.colorTheme);
      AsyncStorage.setItem("@tf_accent", profile.colorTheme);
    }
    if (profile?.darkMode !== undefined) {
      setDark(profile.darkMode !== false);
      AsyncStorage.setItem("@tf_dark", String(profile.darkMode !== false));
    }
  }, [profile?.colorTheme, profile?.darkMode]);

  // Never flash onboarding: only redirect if profile is fully loaded AND onboarding is definitively incomplete.
  // If profileLoading is still true, treat as "we don't know yet" → show spinner.
  const loading = authLoading || (!!user && profileLoading);

  // Extra safety: if profile loaded but field is missing (e.g. very old user), treat as complete.
  // Only show onboarding for users where we have a loaded profile with onboardingComplete === false/undefined
  // AND the profile actually exists (profile !== null means Firestore returned a doc).
  const shouldOnboard = !!user && !loading && (profile === null || !profile?.onboardingComplete);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        colors: {
          background: colors.bg, primary: colors.accent,
          card: colors.bgCard,   text: colors.textPrimary,
          border: colors.border, notification: colors.accent,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : shouldOnboard ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"           component={MainTabs} />
            <Stack.Screen name="WeeklyBriefing" component={WeeklyBriefingScreen} />
            <Stack.Screen name="Onboarding"     component={OnboardingScreen} />
            <Stack.Screen name="Paywall"        component={PaywallScreen} options={{ presentation: "modal" }} />
            <Stack.Screen name="SyllabusParser" component={SyllabusParserScreen} options={{ presentation: "modal" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;