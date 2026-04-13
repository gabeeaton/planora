// ============================================================
// src/navigation/AppNavigator.js
// Updated: Stats tab added, ICSReviewScreen registered,
//          safe-area bottom inset fix for black bar
// ============================================================

import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth }          from "../hooks/useAuth";
import { useUserProfile }   from "../hooks/useUserProfile";
import { saveUserProfile }  from "../services/firebase";
import DashboardScreen      from "../screens/DashboardScreen";
import ProfileScreen        from "../screens/ProfileScreen";
import StatsScreen          from "../screens/StatsScreen";
import AuthScreen, { EmailVerificationScreen } from "../screens/AuthScreen";
import OnboardingScreen     from "../screens/OnboardingScreen";
import WeeklyBriefingScreen from "../screens/WeeklyBriefingScreen";
import PaywallScreen        from "../screens/PaywallScreen";
import SyllabusParserScreen from "../screens/SyllabusParserScreen";
import ICSReviewScreen      from "../screens/ICSReviewScreen";
import FocusModeScreen       from "../screens/FocusModeScreen";
import ChatScreen            from "../screens/ChatScreen";
import ResetPasswordScreen   from "../screens/ResetPasswordScreen";
import { useTheme } from "../utils/ThemeContext";

const linking = {
  prefixes: ["planora://"],
  config: {
    screens: {
      ResetPassword: "reset-password",
    },
  },
};

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Custom Tab Bar ────────────────────────────────────────────

const TAB_ICONS  = { Dashboard: "home", Stats: "bar-chart-2", Chat: "message-circle", Profile: "user" };
const TAB_LABELS = { Dashboard: "Home", Stats: "Progress",    Chat: "Coach",          Profile: "Profile" };

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[
      tabStyles.container,
      {
        paddingBottom: Math.max(insets.bottom, 8), // respect home indicator
        backgroundColor: colors.bgCard,
        borderTopColor:  colors.border,
      }
    ]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconName  = TAB_ICONS[route.name]  ?? "circle";
        const label     = TAB_LABELS[route.name] ?? route.name;

        const onPress = () => {
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
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 8,
    // Prevent dark strip: ensure bg covers all the way to screen bottom
    marginBottom: 0,
  },
  tab:      { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  label:    { fontSize: 10, fontWeight: "600", color: "#44445A", textTransform: "uppercase", letterSpacing: 0.3 },
});

// ── Main tab navigator ────────────────────────────────────────

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false, lazy: false }}
    sceneContainerStyle={{ backgroundColor: "transparent" }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Chat"      component={ChatScreen} />
    <Tab.Screen name="Stats"     component={StatsScreen} />
    <Tab.Screen name="Profile"   component={ProfileScreen} />
  </Tab.Navigator>
);

// ── Root navigator ────────────────────────────────────────────

const AppNavigator = () => {
  const { user, loading: authLoading }                                 = useAuth();
  const { profile, hasCompletedOnboarding, firestoreReady, loading: profileLoading } = useUserProfile();
  const { setTheme, colors }                                          = useTheme();

  useEffect(() => {
    if (profile?.colorTheme) {
      setTheme(profile.colorTheme);
      AsyncStorage.setItem("@tf_accent", profile.colorTheme).catch(() => {});
    }
  }, [profile?.colorTheme]);

  // Backfill timezone for existing users who don't have it yet
  useEffect(() => {
    if (!user || !profile || profile.timezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    saveUserProfile(user.uid, { timezone: tz }).catch(() => {});
  }, [user?.uid, profile?.timezone]);

  const loading = authLoading || (!!user && profileLoading);

  // Once we see onboardingComplete:true, latch it for the session so a
  // momentary Firestore null (cache miss) never bounces the user back to onboarding.
  const onboardedRef = useRef(false);
  if (profile?.onboardingComplete === true) onboardedRef.current = true;

  const shouldOnboard = !!user && !loading && firestoreReady && !onboardedRef.current && profile?.onboardingComplete !== true;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
      linking={linking}
      theme={{
        colors: {
          background:   colors.bg,     primary:      colors.accent,
          card:         colors.bgCard, text:         colors.textPrimary,
          border:       colors.border, notification: colors.accent,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ presentation: "modal" }} />
          </>
        ) : shouldOnboard ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"           component={MainTabs} />
            <Stack.Screen name="WeeklyBriefing" component={WeeklyBriefingScreen} />
            <Stack.Screen name="Onboarding"     component={OnboardingScreen} />
            <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} options={{ presentation: "modal" }} />
            <Stack.Screen name="ICSReview"      component={ICSReviewScreen} />
            <Stack.Screen
              name="FocusMode"
              component={FocusModeScreen}
              options={{ presentation: "fullScreenModal", headerShown: false }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="SyllabusParser"
              component={SyllabusParserScreen}
              options={{ presentation: "modal" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;