// ============================================================
// src/navigation/AppNavigator.js
// ============================================================

import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useAuth }          from "../hooks/useAuth";
import { useUserProfile }   from "../hooks/useUserProfile";
import DashboardScreen      from "../screens/DashboardScreen";
import ProfileScreen        from "../screens/ProfileScreen";
import AuthScreen           from "../screens/AuthScreen";
import OnboardingScreen     from "../screens/OnboardingScreen";
import WeeklyBriefingScreen from "../screens/WeeklyBriefingScreen";
import PaywallScreen        from "../screens/PaywallScreen";
import { colors, shadows, setActiveTheme, getAccentColors } from "../utils/theme";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Custom Tab Bar ────────────────────────────────────────────

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const ac = getAccentColors();
  return (
    <View style={tabStyles.container}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconName  = { Dashboard: "home", WeeklyTab: "calendar", Profile: "user" }[route.name] ?? "circle";
        const label     = { Dashboard: "Home", WeeklyTab: "Weekly",   Profile: "Profile" }[route.name] ?? route.name;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={tabStyles.tab} activeOpacity={0.7}>
            <View style={[tabStyles.iconWrap, isFocused && { backgroundColor: ac.accentGlow }]}>
              <Feather name={iconName} size={20} color={isFocused ? ac.accent : colors.textMuted} />
            </View>
            <Text style={[tabStyles.label, isFocused && { color: ac.accent }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 28,   // enough for home indicator
    paddingTop: 10,
    paddingHorizontal: 16,
    ...shadows.card,
  },
  tab:      { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  label:    { fontSize: 10, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
});

// ── Weekly tab — only navigates once per press, not on every focus ─

const WeeklyTabScreen = ({ navigation }) => {
  const didNavigateRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      // Navigate to WeeklyBriefing on tab press
      navigation.navigate("WeeklyBriefing");
    });
    return unsubscribe;
  }, [navigation]);

  // Blank screen — user is immediately taken to WeeklyBriefing
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
};

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

  // Apply saved color theme whenever profile loads
  useEffect(() => {
    if (profile?.colorTheme) setActiveTheme(profile.colorTheme);
  }, [profile?.colorTheme]);

  const loading = authLoading || (!!user && profileLoading);

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
        ) : !hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"           component={MainTabs} />
            <Stack.Screen name="WeeklyBriefing" component={WeeklyBriefingScreen} />
            <Stack.Screen name="Onboarding"     component={OnboardingScreen} />
            <Stack.Screen name="Paywall"        component={PaywallScreen} options={{ presentation: "modal" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;