// ============================================================
// src/navigation/AppNavigator.js
// Updated: Stats tab added, ICSReviewScreen registered,
//          safe-area bottom inset fix for black bar
// ============================================================

import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from "react";
import { View, ActivityIndicator, TouchableOpacity, StyleSheet, Text, Animated, Image } from "react-native";
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
import TasksScreen          from "../screens/TasksScreen";
import FocusScreen          from "../screens/FocusScreen";
import AuthScreen, { EmailVerificationScreen } from "../screens/AuthScreen";
import OnboardingScreen     from "../screens/OnboardingScreen";
import PaywallScreen        from "../screens/PaywallScreen";
import SyllabusParserScreen from "../screens/SyllabusParserScreen";
import ICSReviewScreen      from "../screens/ICSReviewScreen";
import FocusModeScreen       from "../screens/FocusModeScreen";
import ChatScreen            from "../screens/ChatScreen";
import CalendarScreen        from "../screens/CalendarScreen";
import ResetPasswordScreen   from "../screens/ResetPasswordScreen";
import StudyPlanScreen       from "../screens/StudyPlanScreen";
import { useTheme } from "../utils/ThemeContext";
import TaskModal from "../components/TaskModal";
import AcePopup from "../components/AcePopup";
import WalkthroughOverlay from "../components/WalkthroughOverlay";
import NewSemesterPrompt  from "../components/NewSemesterPrompt";
import { getSemesterEnd }  from "../utils/termHelpers";
import { WalkthroughProvider, useSetWalkthroughTarget } from "../utils/WalkthroughContext";
import { useTasks } from "../hooks/useTasks";
import { useSubscription } from "../hooks/useSubscription";
import { invalidateTodayFocusCache } from "../services/openai";
import { FEATURE_FLAGS } from "../config";
const ACE_LOGO = require("../assets/logo.png");

export const AddTaskContext = React.createContext({ openAddTask: () => {}, openQuickAdd: () => {} });

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

const COACH_NAME = "Ace"; // ← change to rename the AI character everywhere

const TAB_ICONS  = { Dashboard: "home", Chat: "message-circle", Tasks: "check-square", Calendar: "calendar", Focus: "target" };
const TAB_LABELS = { Dashboard: "Home", Chat: COACH_NAME, Tasks: "Tasks", Calendar: "Calendar", Focus: "Focus" };

const TAB_TARGET_NAMES = { Dashboard: "homeTab", Chat: "chatTab", Tasks: "tasksTab", Calendar: "calendarTab", Focus: "focusTab" };

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
  const setTarget = useSetWalkthroughTarget();

  const [localIndex, setLocalIndex] = useState(state.index);
  useEffect(() => { setLocalIndex(state.index); }, [state.index]);

  return (
    <View style={[
      tabStyles.container,
      {
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
        borderTopColor: colors.isDark ? colors.border : "#E0E0E8",
      }
    ]}>
      {state.routes.map((route, index) => {
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
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
  },
  tab:      { flex: 1, alignItems: "center", gap: 4 },
  iconWrap: { width: 40, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  label:    { fontSize: 10, fontFamily: "Outfit-SemiBold", letterSpacing: 0.3 },
});


const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const MILESTONE_COPY = {
  3:   { emoji: "🔥", title: "3-day streak",      sub: "You're building something real." },
  7:   { emoji: "🔥", title: "One week straight", sub: "That's serious consistency." },
  14:  { emoji: "⚡", title: "Two weeks strong",  sub: "You're in the zone." },
  30:  { emoji: "💎", title: "30-day streak",     sub: "A full month of showing up." },
  60:  { emoji: "🚀", title: "60-day streak",     sub: "You're built different." },
  100: { emoji: "👑", title: "100 days",          sub: "This is legendary." },
};

const aceStyles = StyleSheet.create({
  aceBtnWrap: {
    position: "absolute",
    right: 16,
    zIndex: 99,
  },
  aceBtn: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  aceBtnLogo: {
    width: 44, height: 44,
  },
  milestoneBanner: {
    position: "absolute",
    left: 14,
    right: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 14,
    zIndex: 9999,
  },
  milestoneEmoji: { fontSize: 26 },
  milestoneTitle: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#fff" },
  milestoneSub:   { fontSize: 12, fontFamily: "Outfit-Medium", color: "rgba(255,255,255,0.78)", marginTop: 1 },
});

// ── Floating Ace / Planora FAB ────────────────────────────────
// Separate component so it can call useSetWalkthroughTarget inside WalkthroughProvider

const AceFabInner = ({ bottom, aceBtnScale, acePulse, colors, onPress, onPressIn, onPressOut }) => {
  const setTarget = useSetWalkthroughTarget();
  const fabRef    = useRef(null);
  return (
    <View
      ref={fabRef}
      style={[aceStyles.aceBtnWrap, { bottom }]}
      onLayout={() => {
        fabRef.current?.measureInWindow((x, y, w, h) => {
          if (w > 0 && h > 0) setTarget("aceBtn", { cx: x + w / 2, cy: y + h / 2, w, h, r: 25 });
        });
      }}
    >
      <Animated.View style={{ transform: [{ scale: aceBtnScale }] }}>
        <Animated.View style={{ transform: [{ scale: acePulse }] }}>
          <TouchableOpacity
            style={[aceStyles.aceBtn, {
              backgroundColor: colors.accent,
              borderColor: "rgba(255,255,255,0.25)",
              shadowColor: colors.accent,
            }]}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <Image source={ACE_LOGO} style={aceStyles.aceBtnLogo} resizeMode="contain" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ── Main tab navigator ────────────────────────────────────────

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
    sceneContainerStyle={{ backgroundColor: "transparent" }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Chat"      component={ChatScreen} />
    <Tab.Screen name="Tasks"     component={TasksScreen} />
    <Tab.Screen name="Calendar"  component={CalendarScreen} />
    <Tab.Screen name="Focus"     component={FocusScreen} />
  </Tab.Navigator>
);

const MainTabsMemo = React.memo(MainTabs);

const MainTabsWithModal = () => {
  const [visible, setVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [acePopupVisible, setAcePopupVisible] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const aceBtnScale = useRef(new Animated.Value(1)).current;
  const { createTask, editTask, tasks, patterns, streak } = useTasks();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isPro } = useSubscription();
  const navigation = useNavigation();
  const walkthroughTriggered = useRef(false);
  const [showNewSemester, setShowNewSemester] = useState(false);
  const semesterChecked = useRef(false);

  // Subtle idle breathing pulse
  const acePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(acePulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(acePulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Streak milestone banner ───────────────────────────────────
  const [milestoneBanner, setMilestoneBanner] = useState(null);
  const bannerAnim      = useRef(new Animated.Value(0)).current;
  const bannerTimer     = useRef(null);
  const prevStreakRef   = useRef(streak);

  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak;
    if (streak <= prev || streak === 0) return;
    const milestone = STREAK_MILESTONES.find((m) => m === streak);
    if (!milestone) return;
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setMilestoneBanner(MILESTONE_COPY[milestone]);
    bannerAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(bannerAnim, { toValue: 1, speed: 16, bounciness: 10, useNativeDriver: true }).start();
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        () => setMilestoneBanner(null)
      );
    }, 5000);
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, [streak]);

  const showPendingPaywall = useCallback(() => {
    AsyncStorage.getItem("@planora_paywall_pending")
      .then((flag) => {
        if (!flag) return;
        AsyncStorage.removeItem("@planora_paywall_pending").catch(() => {});
        setTimeout(() => navigation.navigate("Paywall"), 350);
      })
      .catch(() => {});
  }, [navigation]);

  useEffect(() => {
    if (walkthroughTriggered.current || profile == null) return;
    walkthroughTriggered.current = true;
    if (FEATURE_FLAGS.FORCE_WALKTHROUGH || !profile.walkthroughComplete) {
      setTimeout(() => {
        navigation.navigate("Dashboard");
        setShowWalkthrough(true);
      }, 900);
    } else {
      // Walkthrough already done — check for a paywall that was deferred from onboarding
      showPendingPaywall();
    }
  }, [profile]);

  // ── Semester-end prompt ───────────────────────────────────────
  useEffect(() => {
    if (semesterChecked.current || !profile?.semester || !profile?.walkthroughComplete) return;
    semesterChecked.current = true;
    const sem = profile.semester;
    const end = getSemesterEnd(sem, profile.schoolSystem ?? "semester");
    if (!end || Date.now() < end.getTime()) return;
    // Semester has ended — check if already prompted or snoozed
    if (FEATURE_FLAGS.FORCE_SEMESTER_PROMPT) {
      setTimeout(() => setShowNewSemester(true), 1200);
      return;
    }
    Promise.all([
      AsyncStorage.getItem(`@planora_semester_prompted_${sem}`),
      AsyncStorage.getItem(`@planora_semester_snooze_${sem}`),
    ]).then(([prompted, snooze]) => {
      if (prompted) return;
      if (snooze && Date.now() < parseInt(snooze)) return;
      setTimeout(() => setShowNewSemester(true), 1200);
    }).catch(() => {});
  }, [profile]);

  const handleWalkthroughDone = useCallback(() => {
    setShowWalkthrough(false);
    if (!FEATURE_FLAGS.FORCE_WALKTHROUGH && user?.uid) {
      saveUserProfile(user.uid, { walkthroughComplete: true }).catch(() => {});
    }
    // Show paywall now that the walkthrough is out of the way
    showPendingPaywall();
  }, [user?.uid, showPendingPaywall]);

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
    if (editingTask?.id) await editTask(editingTask.id, taskData);
    else await createTask(taskData);
    invalidateTodayFocusCache();
  }, [editingTask, editTask, createTask]);

  const openQuickAdd = useCallback(() => openAddTask(null), [openAddTask]);
  const contextValue = useMemo(() => ({ openAddTask, openQuickAdd }), [openAddTask, openQuickAdd]);

  const insets = useSafeAreaInsets();
  const tabIndex = useNavigationState((s) => s?.routes?.[s.index]?.state?.index ?? 0);
  const onChatTab = tabIndex === 1; // Dashboard(0), Chat(1), Tasks(2), Calendar(3), Focus(4)
  const { colors } = useTheme();

  const aceBtnBottom = Math.max(insets.bottom, 8) + 62 + 14;

  return (
    <WalkthroughProvider>
      <AddTaskContext.Provider value={contextValue}>
        <View style={{ flex: 1 }}>
        <MainTabsMemo />

        {/* Streak milestone banner — slides in from top */}
        {milestoneBanner && (
          <Animated.View
            pointerEvents="none"
            style={[
              aceStyles.milestoneBanner,
              {
                top: insets.top + 10,
                backgroundColor: colors.accent,
                shadowColor: colors.accent,
                opacity: bannerAnim,
                transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }],
              },
            ]}
          >
            <Text style={aceStyles.milestoneEmoji}>{milestoneBanner.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={aceStyles.milestoneTitle}>{milestoneBanner.title}</Text>
              <Text style={aceStyles.milestoneSub}>{milestoneBanner.sub}</Text>
            </View>
          </Animated.View>
        )}

        <TaskModal
          visible={visible}
          task={editingTask}
          onClose={() => setVisible(false)}
          onSave={handleSave}
        />

        {/* Floating Planora FAB — hidden on Chat tab */}
        {!onChatTab && (
          <AceFabInner
            bottom={aceBtnBottom}
            aceBtnScale={aceBtnScale}
            acePulse={acePulse}
            colors={colors}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setAcePopupVisible(true);
            }}
            onPressIn={() => Animated.spring(aceBtnScale, { toValue: 0.88, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
            onPressOut={() => Animated.spring(aceBtnScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()}
          />
        )}

        <AcePopup
          visible={acePopupVisible}
          onClose={() => setAcePopupVisible(false)}
          onOpenFullChat={() => navigation.navigate("Chat")}
        />

        {showWalkthrough && <WalkthroughOverlay onDone={handleWalkthroughDone} fabBottom={aceBtnBottom + 54 + 12} />}

        <NewSemesterPrompt
          visible={showNewSemester}
          oldSemester={profile?.semester}
          userId={user?.uid}
          schoolSystem={profile?.schoolSystem}
          onDone={() => setShowNewSemester(false)}
        />
        </View>
      </AddTaskContext.Provider>
    </WalkthroughProvider>
  );
};

// ── Branded splash screen ─────────────────────────────────────

const PlanoraSplash = ({ colors }) => {
  const logoAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(textAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[splashStyles.container, { backgroundColor: colors.bg }]}>
      <View style={[splashStyles.orb1, { backgroundColor: colors.accent + "18" }]} />
      <View style={[splashStyles.orb2, { backgroundColor: colors.accent + "10" }]} />
      <Animated.View style={[splashStyles.logoWrap, { opacity: logoAnim, backgroundColor: colors.isDark ? colors.bgCard : "#fff", shadowColor: colors.accent }]}>
        <Image source={require("../assets/planora-brand.jpg")} style={splashStyles.logo} resizeMode="cover" />
      </Animated.View>
      <Animated.View style={{ opacity: textAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}>
        <Text style={[splashStyles.wordmark, { color: colors.textPrimary }]}>Planora</Text>
        <Text style={[splashStyles.tagline, { color: colors.textMuted }]}>Your AI study coach</Text>
      </Animated.View>
    </View>
  );
};

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  orb1: {
    position: "absolute",
    width: 280, height: 280, borderRadius: 140,
    top: -60, right: -80,
  },
  orb2: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 100,
    bottom: -40, left: -60,
  },
  logoWrap: {
    width: 84, height: 84, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: { width: 52, height: 52, borderRadius: 12 },
  wordmark: { fontSize: 30, fontFamily: "Outfit-ExtraBold", letterSpacing: -0.5, marginTop: 4 },
  tagline:  { fontSize: 14, fontFamily: "Outfit-Regular", marginTop: 4 },
});

// ── Root navigator ────────────────────────────────────────────

const SPLASH_MIN_MS = 1400; // always show splash for at least this long

const AppNavigator = () => {
  const { user, loading: authLoading }                                 = useAuth();
  const { profile, hasCompletedOnboarding, firestoreReady, loading: profileLoading } = useUserProfile();
  const { setTheme, colors }                                          = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  // Minimum splash duration
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

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

  if (loading || !splashDone) {
    return <PlanoraSplash colors={colors} />;
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
              options={{ presentation: "modal", headerShown: false, gestureEnabled: true, gestureDirection: "vertical" }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ presentation: "transparentModal", headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="StudyPlan"
              component={StudyPlanScreen}
              options={{ presentation: "modal", headerShown: false, gestureEnabled: true, gestureDirection: "vertical" }}
            />
            <Stack.Screen
              name="Stats"
              component={StatsScreen}
              options={{ presentation: "modal", headerShown: false, gestureEnabled: true, gestureDirection: "vertical" }}
            />
            <Stack.Screen
              name="Tasks"
              component={TasksScreen}
              options={{ presentation: "modal", headerShown: false, gestureEnabled: true, gestureDirection: "vertical" }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ presentation: "modal", headerShown: false, gestureEnabled: true, gestureDirection: "vertical" }}
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