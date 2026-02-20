// ============================================================
// navigation/AppNavigator.js
// Handles routing between Auth and Dashboard.
// If user is logged in → show Dashboard
// If not → show Auth screen
// ============================================================

import React from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import DashboardScreen from "../screens/DashboardScreen";
import AuthScreen from "../screens/AuthScreen";
import { colors } from "../utils/theme";

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Show a spinner while Firebase checks auth state
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        colors: {
          background: colors.bg,
          primary: colors.accent,
          card: colors.bgCard,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.accent,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // Authenticated routes
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        ) : (
          // Unauthenticated routes
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
