// ============================================================
// src/navigation/AppNavigator.js
// Updated: Stats tab added, ICSReviewScreen registered,
//          safe-area bottom inset fix for black bar
// ============================================================

import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from "react";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text, Animated, Dimensions, Image } from "react-native";
import * as Haptics from "expo-haptics";
import { NavigationContainer, useNavigation, useNavigationState } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
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
import PaywallScreen        from "../screens/PaywallScreen";
import SyllabusParserScreen from "../screens/SyllabusParserScreen";
import ICSReviewScreen      from "../screens/ICSReviewScreen";
import FocusModeScreen       from "../screens/FocusModeScreen";
import ChatScreen            from "../screens/ChatScreen";
import ResetPasswordScreen   from "../screens/ResetPasswordScreen";
import StudyPlanScreen       from "../screens/StudyPlanScreen";
import { useTheme } from "../utils/ThemeContext";
import TaskModal from "../components/TaskModal";
import WalkthroughOverlay from "../components/WalkthroughOverlay";
import { WalkthroughProvider, useSetWalkthroughTarget } from "../utils/WalkthroughContext";
import { useTasks } from "../hooks/useTasks";
import { invalidateTodayFocusCache } from "../services/openai";
import { FEATURE_FLAGS } from "../config";

export const AddTaskContext = React.createContext({ openAddTask: () => {} });

const linking = {
  prefixes: ["planora://"],
  config: {
    screens: {
      ResetPassword: "reset-password",
      Auth:          "auth",
    },
  },
};

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Custom Tab Bar ────────────────────────────────────────────

const TAB_ICONS  = { Dashboard: "home", Stats: "bar-chart-2", Chat: "message-circle", Profile: "user" };
const TAB_LABELS = { Dashboard: "Home", Stats: "Progress",    Chat: "Coach",          Profile: "Profile" };

const TAB_TARGET_NAMES = { Dashboard: "homeTab", Stats: "statsTab", Chat: "chatTab", Profile: "profileTab" };

const TabItem = ({ route, isFocused, onPress, colors, onMeasure }) => {
  const outerRef   = useRef(null);
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const nativeAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(nativeAnim, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [isFocused]);

  const iconName         = TAB_ICONS[route.name]  ?? "circle";
  const label            = TAB_LABELS[route.name] ?? route.name;
  const unfocusedOpacity = nativeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.90, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  const handlePress    = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      ref={outerRef}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={tabStyles.tab}
      activeOpacity={1}
      onLayout={() => {
        outerRef.current?.measureInWindow((x, y, w, h) => {
          onMeasure?.({ cx: x + w / 2, cy: y + h / 2, w, h, r: 12 });
        });
      }}
    >
      <View style={tabStyles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, {
          borderRadius: 12,
          backgroundColor: colors.isDark ? colors.accentGlow : colors.accent + "22",
          opacity: nativeAnim,
        }]} />
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: 20, height: 20 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", opacity: unfocusedOpacity }]}>
            <Feather name={iconName} size={20} color={colors.textMuted} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", opacity: nativeAnim }]}>
            <Feather name={iconName} size={20} color={colors.accent} />
          </Animated.View>
        </Animated.View>
      </View>
      <View style={{ height: 14 }}>
        <Animated.Text style={[tabStyles.label, { color: colors.textMuted, opacity: unfocusedOpacity }]}>
          {label}
        </Animated.Text>
        <Animated.Text style={[tabStyles.label, { color: colors.accent, opacity: nativeAnim, position: "absolute" }]}>
          {label}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { openAddTask } = useContext(AddTaskContext);
  const setTarget = useSetWalkthroughTarget();
  const plusScale = useRef(new Animated.Value(1)).current;
  const plusRef   = useRef(null);

  const [localIndex, setLocalIndex] = useState(state.index);
  useEffect(() => { setLocalIndex(state.index); }, [state.index]);

  const mid = Math.floor(state.routes.length / 2);

  const renderTab = (route, index) => {
    const isFocused = localIndex === index;
    const onPress = () => {
      if (isFocused) return;
      setLocalIndex(index);
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!event.defaultPrevented) navigation.navigate(route.name);
    };
    const targetName = TAB_TARGET_NAMES[route.name];
    return (
      <TabItem
        key={route.key}
        route={route}
        isFocused={isFocused}
        onPress={onPress}
        colors={colors}
        onMeasure={targetName ? (rect) => setTarget(targetName, rect) : undefined}
      />
    );
  };

  return (
    <View style={[
      tabStyles.container,
      {
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
        borderTopColor: colors.isDark ? colors.border : "#E0E0E8",
      }
    ]}>
      {state.routes.slice(0, mid).map((route, index) => renderTab(route, index))}

      <View
        ref={plusRef}
        style={tabStyles.plusWrap}
        onLayout={() => {
          plusRef.current?.measureInWindow((x, y, w, h) => {
            setTarget("plus", { cx: x + w / 2, cy: y + h / 2, w: 44, h: 40, r: 12 });
          });
        }}
      >
        <Animated.View style={{ transform: [{ scale: plusScale }] }}>
          <TouchableOpacity
            style={[tabStyles.plusBtn, { backgroundColor: colors.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              openAddTask();
            }}
            onPressIn={() => Animated.spring(plusScale, { toValue: 0.88, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
            onPressOut={() => Animated.spring(plusScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start()}
            activeOpacity={1}
          >
            <Feather name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={[tabStyles.label, { color: colors.accent }]}>Add</Text>
      </View>

      {state.routes.slice(mid).map((route, index) => renderTab(route, mid + index))}
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
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  tab:      { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  label:    { fontSize: 10, fontFamily: "Outfit-SemiBold", letterSpacing: 0.3 },
  plusWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  plusBtn: {
    width: 40, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
});

const QUICK_ASKS = [
  "Am I going to be okay this week?",
  "Which class should I worry about?",
  "I've been procrastinating — be honest.",
  "Where should I start?",
];

const aiBarStyles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  inputArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: "100%",
  },
  barLogo: {
    width: 24,
    height: 24,
    borderRadius: 7,
  },
  placeholder: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    flex: 1,
  },
  zapBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestCard: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  suggestHeader: {
    fontSize: 10,
    fontFamily: "Outfit-ExtraBold",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  suggestItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  suggestText: {
    fontSize: 14,
    fontFamily: "Outfit-Medium",
    flex: 1,
  },
});

// ── Main tab navigator ────────────────────────────────────────

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
    sceneContainerStyle={{ backgroundColor: "transparent" }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Stats"     component={StatsScreen} />
    <Tab.Screen name="Chat"      component={ChatScreen} />
    <Tab.Screen name="Profile"   component={ProfileScreen} />
  </Tab.Navigator>
);

const MainTabsMemo = React.memo(MainTabs);

const MainTabsWithModal = () => {
  const [visible, setVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestAnim = useRef(new Animated.Value(0)).current;
  const { createTask, editTask } = useTasks();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const navigation = useNavigation();
  const walkthroughTriggered = useRef(false);

  useEffect(() => {
    if (walkthroughTriggered.current || profile == null) return;
    walkthroughTriggered.current = true;
    if (FEATURE_FLAGS.FORCE_WALKTHROUGH || !profile.walkthroughComplete) {
      setTimeout(() => {
        navigation.navigate("Dashboard");
        setShowWalkthrough(true);
      }, 900);
    }
  }, [profile]);

  const handleWalkthroughDone = useCallback(() => {
    setShowWalkthrough(false);
    if (!FEATURE_FLAGS.FORCE_WALKTHROUGH && user?.uid) {
      saveUserProfile(user.uid, { walkthroughComplete: true }).catch(() => {});
    }
  }, [user?.uid]);

  // Open StudyPlan when user taps a study-plan-reminder notification
  const lastNotifResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastNotifResponse?.notification?.request?.content?.data?.type === "study-plan-reminder") {
      navigation.navigate("StudyPlan");
    }
  }, [lastNotifResponse]);

  const openAddTask = useCallback((task = null) => {
    setEditingTask(task ?? null);
    setVisible(true);
  }, []);

  const handleSave = useCallback(async (taskData) => {
    if (editingTask) await editTask(editingTask.id, taskData);
    else await createTask(taskData);
    invalidateTodayFocusCache();
  }, [editingTask, editTask, createTask]);

  const contextValue = useMemo(() => ({ openAddTask }), [openAddTask]);

  const insets   = useSafeAreaInsets();
  const tabIndex = useNavigationState((s) => s?.routes?.[s.index]?.state?.index ?? 0);
  const onChatTab = tabIndex === 2; // Chat is index 2: Dashboard(0), Stats(1), Chat(2), Profile(3)
  const { colors } = useTheme();

  const barBottom  = Math.max(insets.bottom, 8) + 62 + 8;
  const cardBottom = barBottom + 50 + 8;

  const openSuggestions = useCallback(() => {
    setShowSuggestions(true);
    Haptics.selectionAsync().catch(() => {});
    Animated.spring(suggestAnim, { toValue: 1, speed: 22, bounciness: 5, useNativeDriver: true }).start();
  }, [suggestAnim]);

  const closeSuggestions = useCallback(() => {
    Animated.timing(suggestAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(
      () => setShowSuggestions(false)
    );
  }, [suggestAnim]);

  const handleSuggestion = useCallback((text) => {
    closeSuggestions();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate("ChatModal", { initialText: text });
  }, [closeSuggestions, navigation]);

  return (
    <WalkthroughProvider>
      <AddTaskContext.Provider value={contextValue}>
        <MainTabsMemo />
        <TaskModal
          visible={visible}
          task={editingTask}
          onClose={() => setVisible(false)}
          onSave={handleSave}
        />
        {showWalkthrough && <WalkthroughOverlay onDone={handleWalkthroughDone} />}

        {/* Floating AI bar — hidden on Chat tab */}
        {!onChatTab && (
          <>
            {/* Backdrop to dismiss suggestions */}
              {showSuggestions && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={closeSuggestions}
                />
              )}

              {/* Suggestions card */}
              {showSuggestions && (
                <Animated.View
                  style={[
                    aiBarStyles.suggestCard,
                    {
                      bottom: cardBottom,
                      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
                      borderColor: colors.isDark ? colors.border : "#E8E8F2",
                      opacity: suggestAnim,
                      transform: [{ translateY: suggestAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                    },
                  ]}
                >
                  <Text style={[aiBarStyles.suggestHeader, { color: colors.textMuted }]}>QUICK ASKS</Text>
                  {QUICK_ASKS.map((q, i) => (
                    <TouchableOpacity
                      key={q}
                      style={[
                        aiBarStyles.suggestItem,
                        { borderBottomColor: colors.isDark ? colors.border : "#F0F0F8" },
                        i === QUICK_ASKS.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      onPress={() => handleSuggestion(q)}
                      activeOpacity={0.6}
                    >
                      <Text style={[aiBarStyles.suggestText, { color: colors.textPrimary }]}>{q}</Text>
                      <Feather name="arrow-up-right" size={13} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </Animated.View>
              )}

              {/* AI bar */}
              <View
                style={[
                  aiBarStyles.bar,
                  {
                    bottom: barBottom,
                    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
                    borderColor: colors.isDark ? colors.border : "#E8E8F2",
                    shadowColor: colors.isDark ? "#000" : "#6B6B8A",
                  },
                ]}
              >
                <TouchableOpacity
                  style={aiBarStyles.inputArea}
                  onPress={() => {
                    closeSuggestions();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    navigation.navigate("ChatModal");
                  }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={require("../assets/logo.png")}
                    style={aiBarStyles.barLogo}
                  />
                  <Text style={[aiBarStyles.placeholder, { color: colors.textMuted }]}>
                    Ask your sidekick...
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[aiBarStyles.zapBtn, { backgroundColor: colors.accentGlow }]}
                  onPress={showSuggestions ? closeSuggestions : openSuggestions}
                  activeOpacity={0.7}
                >
                  <Feather name="help-circle" size={16} color={colors.accent} />
                </TouchableOpacity>
              </View>
          </>
        )}
      </AddTaskContext.Provider>
    </WalkthroughProvider>
  );
};

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

  const loading = authLoading || (!!user && (profileLoading || !firestoreReady));

  // Firestore is the source of truth — only show onboarding once Firestore confirms no profile
  const shouldOnboard = !!user && !loading && firestoreReady &&
    (FEATURE_FLAGS.FORCE_ONBOARDING || profile?.onboardingComplete !== true);

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
        ) : shouldOnboard && !FEATURE_FLAGS.FORCE_ONBOARDING && !FEATURE_FLAGS.DEMO_MODE ? (
          // Genuine first-time user: isolated stack — can't escape onboarding
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Authenticated + (onboarding complete OR dev force flags):
          // Full stack, Onboarding listed first so FORCE_ONBOARDING lands there
          // while navigate("Main") / navigate("Paywall") still resolve correctly.
          <>
            {(FEATURE_FLAGS.FORCE_ONBOARDING || FEATURE_FLAGS.DEMO_MODE) && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            <Stack.Screen name="Main"           component={MainTabsWithModal} />
            {!FEATURE_FLAGS.FORCE_ONBOARDING && !FEATURE_FLAGS.DEMO_MODE && (
              <Stack.Screen name="Onboarding"   component={OnboardingScreen} />
            )}
            <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} options={{ presentation: "modal" }} />
            <Stack.Screen name="ICSReview"      component={ICSReviewScreen} />
            <Stack.Screen
              name="FocusMode"
              component={FocusModeScreen}
              options={{ presentation: "fullScreenModal", headerShown: false }}
            />
            <Stack.Screen
              name="ChatModal"
              component={ChatScreen}
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ presentation: "transparentModal", headerShown: false }}
            />
            <Stack.Screen
              name="StudyPlan"
              component={StudyPlanScreen}
              options={{ presentation: "modal", headerShown: false }}
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