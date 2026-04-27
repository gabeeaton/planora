// ============================================================
// src/screens/DashboardScreen.js
// Changes from previous version:
//   - Replaced AISummaryCard with AIActionsCard (no more Summarize)
//   - TodayFocusCard cache invalidated when tasks change
//   - Focus mode hint removed (redundant — long press hint on TaskCard)
// ============================================================

// ── Demo mode (set true for screenshots/TikTok, false for production) ──
const DEMO_MODE = false;

import React, { useState, useMemo, useEffect, useRef, useCallback, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  InteractionManager,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import TaskCard from "../components/TaskCard";
import StatsBar from "../components/StatsBar";
import TodayFocusCard from "../components/TodayFocusCard";
import NotificationPermissionPrompt, { NOTIF_PROMPT_KEY } from "../components/NotificationPermissionPrompt";
import { DashboardSkeleton, TaskListSkeleton, CalendarSkeleton } from "../components/SkeletonLoader";
import { invalidateTodayFocusCache } from "../services/openai";
import { checkAndScheduleAvoidanceAlerts, scheduleStreakReminder } from "../services/notifications";
import * as Notifications from "expo-notifications";
import { typography, spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { AddTaskContext } from "../navigation/AppNavigator";
import { Share } from "react-native";
import {
  format,
  addDays,
  isToday,
  startOfToday,
  startOfWeek,
  differenceInCalendarDays,
} from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
const safeDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const makeStyles = (colors, insets) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.isDark ? colors.border : "#EAEAF0",
    },
    headerLeft: { flex: 1 },
    greeting: {
      fontFamily: "Outfit-ExtraBold", fontSize: 22,
      color: colors.textPrimary, letterSpacing: -0.3,
    },
    dateRow:   { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 8, paddingTop: 2 },
    date: { fontSize: 13, color: colors.textMuted },
    streakPill: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.isDark ? colors.mediumGlow : "rgba(217,119,6,0.1)",
      borderRadius: radius.full,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.medium + "40" : "rgba(217,119,6,0.35)",
    },
    streakText: {
      fontSize: 11, fontFamily: "Outfit-Bold",
      color: colors.isDark ? colors.medium : "#CC6600",
    },
    importBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
      borderWidth: 1, borderColor: colors.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.isDark ? 0 : 0.06, shadowRadius: 4, elevation: 2,
    },
    importBtnText: {
      fontSize: 12, fontFamily: "Outfit-Bold",
      color: colors.isDark ? colors.accent : colors.textPrimary,
    },
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      marginTop: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.high,
    },
    clearBtnText: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.high },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 80 },

    planCard: {
      flexDirection: "row", alignItems: "center",
      borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.isDark ? colors.border : "#E0E0EE",
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      paddingHorizontal: 14, paddingVertical: 13,
      marginBottom: spacing.sm, gap: 10,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.isDark ? 0 : 0.05, shadowRadius: 4, elevation: 1,
    },
    planCardIconWrap: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.accent + "18",
    },
    planCardText: { flex: 1 },
    planCardTitle: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
    planCardSub: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },

    insightStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderLeftWidth: 3,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingLeft: spacing.sm,
      paddingRight: spacing.md,
      paddingVertical: 11,
      marginBottom: spacing.sm,
    },
    insightText: { fontSize: 13, fontFamily: "Outfit-Medium", flex: 1, lineHeight: 18 },

    segmentedControl: {
      flexDirection: "row",
      backgroundColor: colors.isDark ? colors.bgCard : "#E8E8EE",
      borderRadius: radius.md,
      marginBottom: spacing.md,
      padding: 3,
    },
    segmentActivePill: {
      position: "absolute",
      top: 3,
      left: 3,
      bottom: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.isDark ? colors.bgElevated : "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.isDark ? 0 : 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    segmentText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textSecondary },
    segmentTextActive: { color: colors.isDark ? colors.textPrimary : colors.accent },

    bucketHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
      marginBottom: 8,
      paddingTop: spacing.sm,
    },
    bucketDot: { width: 8, height: 8, borderRadius: 4 },
    bucketLabel: {
      fontSize: 11,
      fontFamily: "Outfit-Bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      flex: 1,
    },
    bucketCount: {
      fontSize: 11, fontFamily: "Outfit-Bold",
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: radius.full,
      overflow: "hidden",
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Outfit-Bold",
      color: colors.isDark ? colors.textMuted : colors.accent,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },

    emptyContainer: { alignItems: "center", paddingTop: 48, paddingBottom: 24 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentGlow,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      fontFamily: "Outfit-ExtraBold",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      textAlign: "center",
      letterSpacing: -0.3,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    emptyActionsRow: { flexDirection: "row", gap: spacing.sm },
    emptyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      ...shadows.accent,
    },
    emptyBtnOutline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    emptyBtnText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 13 },
    emptyBtnOutlineText: {
      color: colors.accent,
      fontFamily: "Outfit-Bold",
      fontSize: 13,
    },

    allDoneContainer: {
      alignItems: "center",
      paddingTop: 48,
      paddingBottom: 24,
    },
    allDoneIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.lowGlow,
      borderWidth: 1,
      borderColor: colors.low,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    allDoneTitle: {
      fontSize: 20,
      fontFamily: "Outfit-ExtraBold",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
      letterSpacing: -0.3,
    },
    allDoneSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
  });

// Animated insight strip — slides down and fades in each time a new insight appears
const InsightStrip = ({ insight, styles, colors }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, speed: 28, bounciness: 0, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.insightStrip,
        {
          borderLeftColor: insight.color,
          borderColor: insight.color + "33",
          backgroundColor: colors.isDark ? insight.color + "10" : insight.color + "22",
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Feather name={insight.icon} size={13} color={insight.color} />
      <Text style={[styles.insightText, { color: insight.color }]}>{insight.text}</Text>
    </Animated.View>
  );
};

const CAL_DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_PRIO_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const calPillColor = (task, colors) => {
  switch (task.priority) {
    case "HIGH":   return colors.high;
    case "MEDIUM": return colors.medium;
    default:       return colors.accent;
  }
};

const WeekCalendar = ({ tasks, onEditTask, weekOffset, onWeekChange, colors }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = addDays(today, -today.getDay() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay = {};
  days.forEach((d) => { byDay[format(d, "yyyy-MM-dd")] = []; });
  tasks.forEach((t) => {
    const d = safeDate(t.dueDate);
    if (!d) return;
    const key = format(d, "yyyy-MM-dd");
    if (byDay[key]) byDay[key].push(t);
  });
  Object.values(byDay).forEach((arr) =>
    arr.sort((a, b) => {
      if (!a.completed && b.completed) return -1;
      if (a.completed && !b.completed) return 1;
      return (CAL_PRIO_ORDER[a.priority] ?? 1) - (CAL_PRIO_ORDER[b.priority] ?? 1);
    })
  );

  const startLabel = format(weekStart, "MMM d");
  const endLabel   = format(addDays(weekStart, 6), "MMM d");
  const MAX_PILLS  = 5;

  const gridBg = colors.isDark ? colors.bgCard : "#FFFFFF";

  return (
    <View style={{ marginHorizontal: -spacing.lg, marginBottom: spacing.md }}>
      {/* Week nav */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingHorizontal: spacing.lg, paddingVertical: 10,
      }}>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onWeekChange(weekOffset - 1); }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.accentGlow,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name="chevron-left" size={16} color={colors.accent} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
          <Text style={{ fontFamily: "Outfit-ExtraBold", fontSize: 15, color: colors.textPrimary, letterSpacing: -0.2 }}>
            {startLabel} – {endLabel}
          </Text>
          {weekOffset !== 0 && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync().catch(() => {}); onWeekChange(0); }}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 10, fontFamily: "Outfit-Bold", color: "#fff" }}>
                Back to today
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onWeekChange(weekOffset + 1); }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.accentGlow,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name="chevron-right" size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Grid — edge-to-edge, top+bottom border, column separators */}
      <View style={{ borderTopWidth:1, borderBottomWidth:1, borderColor:colors.border, backgroundColor:gridBg }}>

        {/* Day-of-week header row */}
        <View style={{ flexDirection:"row", borderBottomWidth:1, borderBottomColor:colors.border }}>
          {days.map((day, i) => {
            const isTod = isToday(day);
            return (
              <View key={i} style={{
                flex:1, alignItems:"center", paddingVertical:8,
                backgroundColor: isTod ? colors.accentGlow : "transparent",
                borderRightWidth: i < 6 ? 1 : 0,
                borderRightColor: colors.border,
              }}>
                <Text style={{
                  fontSize:10, fontFamily:"Outfit-Bold", letterSpacing:0.5,
                  color: isTod ? colors.accent : colors.textMuted,
                  marginBottom:4,
                }}>
                  {CAL_DAY_LABELS[day.getDay()]}
                </Text>
                <View style={{
                  width:28, height:28, borderRadius:14,
                  alignItems:"center", justifyContent:"center",
                  backgroundColor: isTod ? colors.accent : "transparent",
                }}>
                  <Text style={{
                    fontSize:14, fontFamily:"Outfit-ExtraBold",
                    color: isTod ? "#fff" : colors.textPrimary,
                  }}>
                    {format(day, "d")}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Task pill columns */}
        <View style={{ flexDirection:"row", minHeight:64, paddingVertical:6 }}>
          {days.map((day, i) => {
            const key      = format(day, "yyyy-MM-dd");
            const dayTasks = byDay[key];
            const isTod    = isToday(day);

            return (
              <View key={i} style={{
                flex:1, paddingHorizontal:3, gap:3,
                backgroundColor: isTod ? colors.accentGlow : "transparent",
                borderRightWidth: i < 6 ? 1 : 0,
                borderRightColor: colors.border,
              }}>
                {dayTasks.slice(0, MAX_PILLS).map((task) => {
                  const pillColor = calPillColor(task, colors);
                  const label = task.className ?? task.title;
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); onEditTask(task); }}
                      activeOpacity={0.75}
                      style={{
                        borderRadius:4,
                        backgroundColor: pillColor + "20",
                        borderLeftWidth:3,
                        borderLeftColor: pillColor,
                        paddingHorizontal:4,
                        paddingVertical:4,
                        opacity: task.completed ? 0.5 : 1,
                      }}
                    >
                      <Text numberOfLines={1} style={{
                        fontSize:10, fontFamily:"Outfit-SemiBold",
                        color: pillColor,
                        textDecorationLine: task.completed ? "line-through" : "none",
                      }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {dayTasks.length > MAX_PILLS && (
                  <Text style={{ fontSize:9, fontFamily:"Outfit-Medium", color:colors.textMuted, textAlign:"center" }}>
                    +{dayTasks.length - MAX_PILLS}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

      </View>
    </View>
  );
};

const TABS = ["All", "Today", "Done"];

const bucketTasks = (tasks) => {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const week = addDays(today, 7);
  const overdue = [],
    dueToday = [],
    thisWeek = [],
    later = [],
    noDate = [];
  tasks
    .filter((t) => !t.completed)
    .forEach((t) => {
      const d = safeDate(t.dueDate);
      if (!d) {
        noDate.push(t);
        return;
      }
      if (d < todayStart) {
        overdue.push(t);
        return;
      }
      if (d <= today) {
        dueToday.push(t);
        return;
      }
      if (d <= week) {
        thisWeek.push(t);
        return;
      }
      later.push(t);
    });
  return {
    overdue,
    dueToday,
    thisWeek,
    later,
    noDate,
    completed: tasks.filter((t) => t.completed),
  };
};

const DashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets), [colors, insets]);

  const { user } = useAuth();
  const { profile: realProfile } = useUserProfile();
  const { isPro: realIsPro } = useSubscription();
  const realTasks = useTasks();

  // ── Demo data ────────────────────────────────────────────────
  const DEMO_TASKS = [
    { id: "d1", title: "Study for Organic Chemistry midterm", className: "CHEM 201", dueDate: new Date(Date.now() + 1 * 86400000), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
    { id: "d2", title: "Write 5-page essay on the Civil War", className: "HIST 110", dueDate: new Date(Date.now() + 2 * 86400000), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
    { id: "d3", title: "Problem Set 4 — Linear Algebra",      className: "MATH 240", dueDate: new Date(Date.now() + 3 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d4", title: "Read chapters 7–9 for lecture",       className: "PSYC 101", dueDate: new Date(Date.now() + 4 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d5", title: "Lab report — titration experiment",   className: "CHEM 201", dueDate: new Date(Date.now() + 5 * 86400000), completed: false, priority: "LOW",    aiPriority: "LOW"    },
    { id: "d6", title: "Spanish composition draft",           className: "SPAN 102", dueDate: new Date(Date.now() + 6 * 86400000), completed: false, priority: "LOW",    aiPriority: "LOW"    },
    { id: "d7", title: "Quiz review — macro economics",       className: "ECON 101", dueDate: new Date(Date.now() + 1 * 86400000), completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d8", title: "Group project slides",                className: "BUS 210",  dueDate: new Date(Date.now() - 1 * 86400000), completed: true,  priority: "HIGH",   aiPriority: "HIGH"   },
  ];
  const DEMO_PROFILE = { name: "Alex Johnson", semester: "Spring 2025", classes: [], isPro: true };

  const profile       = DEMO_MODE ? DEMO_PROFILE : realProfile;
  const isPro         = DEMO_MODE ? true : realIsPro;
  const tasks         = DEMO_MODE ? DEMO_TASKS : realTasks.tasks;
  const pendingTasks  = DEMO_MODE ? DEMO_TASKS.filter(t => !t.completed) : realTasks.pendingTasks;
  const completedTasks = DEMO_MODE ? DEMO_TASKS.filter(t => t.completed) : realTasks.completedTasks;
  const todaysTasks   = DEMO_MODE ? DEMO_TASKS.filter(t => !t.completed).slice(0, 3) : realTasks.todaysTasks;
  const patterns      = DEMO_MODE ? null : realTasks.patterns;
  const loading       = DEMO_MODE ? false : realTasks.loading;
  const streak        = DEMO_MODE ? 7 : realTasks.streak;
  const createTask    = DEMO_MODE ? () => {} : realTasks.createTask;
  const editTask      = DEMO_MODE ? () => {} : realTasks.editTask;
  const completeTask  = DEMO_MODE ? () => {} : realTasks.completeTask;
  const removeTask    = DEMO_MODE ? () => {} : realTasks.removeTask;
  const clearCompleted = DEMO_MODE ? () => {} : realTasks.clearCompleted;

  const { openAddTask } = useContext(AddTaskContext);

  const [completingIds, setCompletingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("All");
  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [now, setNow] = useState(new Date());

  const [calendarMode, setCalendarMode] = useState(false);
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [planTodayCount, setPlanTodayCount] = useState(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    if (tasks.length === 0) return;
    AsyncStorage.getItem(NOTIF_PROMPT_KEY).then(async (val) => {
      if (val) return;
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        AsyncStorage.setItem(NOTIF_PROMPT_KEY, "true").catch(() => {});
        return;
      }
      setShowNotifPrompt(true);
    }).catch(() => {});
  }, [tasks.length]);

  const scrollRef      = useRef(null);
  const scrollOffsetY  = useRef(0);
  const taskViewRefs   = useRef({});

  // Scroll to a task when it's highlighted from the Focus card, then clear it
  useEffect(() => {
    if (!highlightedTaskId) return;
    const taskRef = taskViewRefs.current[highlightedTaskId];
    if (!taskRef || !scrollRef.current) {
      setHighlightedTaskId(null);
      return;
    }
    setTimeout(() => {
      taskRef.measureInWindow((_, taskAbsY) => {
        scrollRef.current?.measureInWindow((__, svAbsY) => {
          const targetY = scrollOffsetY.current + (taskAbsY - svAbsY) - 120;
          scrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
        });
      });
      // Clear after scroll animation so it doesn't re-fire
      setTimeout(() => setHighlightedTaskId(null), 600);
    }, 50);
  }, [highlightedTaskId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Once Firestore confirms a completion, remove from completingIds so
  // the task reappears in the Done bucket.
  useEffect(() => {
    if (completingIds.size === 0) return;
    const confirmed = tasks.filter((t) => t.completed && completingIds.has(t.id));
    if (confirmed.length === 0) return;
    setCompletingIds((prev) => {
      const next = new Set(prev);
      confirmed.forEach((t) => next.delete(t.id));
      return next;
    });
  }, [tasks]);



  // Avoidance alerts — Scholar only, fires at most once per task per day
  useEffect(() => {
    if (!isPro || !patterns?.avoidanceScores?.length) return;
    checkAndScheduleAvoidanceAlerts(patterns.avoidanceScores, patterns?.productiveTimeOfDay?.bestTime, user?.uid);
  }, [isPro, patterns?.avoidanceScores]);

  // Streak reminder — reschedule whenever streak or productive time changes
  useEffect(() => {
    const bestTime = patterns?.productiveTimeOfDay?.bestTime ?? "evening";
    scheduleStreakReminder(streak, bestTime, user?.uid);
  }, [streak, patterns?.productiveTimeOfDay?.bestTime, user?.uid]);

  useEffect(() => {
    AsyncStorage.getItem("@planora_study_plan_cache").then((raw) => {
      if (!raw) return;
      try {
        const { plan } = JSON.parse(raw);
        const todayStr = format(startOfToday(), "yyyy-MM-dd");
        const todaySessions = plan.filter((s) => s.date === todayStr);
        setPlanTodayCount(todaySessions.length > 0 ? todaySessions.length : 0);
      } catch {}
    }).catch(() => {});
  }, []);

  const enrichedTasks = useMemo(() => {
    const gradeMap = {};
    (profile?.classes ?? []).forEach((c) => {
      if (c.name && c.grade) gradeMap[c.name] = c.grade;
    });
    const gradeWeighted = tasks.map((t) => {
      const grade = gradeMap[t.className];
      const lowGrade =
        grade &&
        (grade.startsWith("D") ||
          grade.startsWith("F") ||
          grade === "C-" ||
          grade === "C" ||
          grade === "C+");
      return lowGrade ? { ...t, _lowGrade: true } : t;
    });
    return completingIds.size > 0 ? gradeWeighted.filter((t) => !completingIds.has(t.id)) : gradeWeighted;
  }, [tasks, profile?.classes, completingIds]);

  const sortByDue = (arr) =>
    [...arr].sort((a, b) => {
      const da = safeDate(a.dueDate),
        db = safeDate(b.dueDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

  const displayedTasks = useMemo(() => {
    const filtered = enrichedTasks.filter(
      (t) => !(t.recurrence && t.completed)
    );
    switch (activeTab) {
      case "Today":
        return sortByDue(filtered.filter((t) => {
          const d = safeDate(t.dueDate);
          return d ? isToday(d) : false;
        }));
      case "Done":
        return enrichedTasks.filter((t) => t.completed);
      default:
        return sortByDue(filtered);
    }
  }, [enrichedTasks, activeTab]);

  const buckets = useMemo(() => bucketTasks(enrichedTasks), [enrichedTasks]);

  const nextUpTask = useMemo(() => {
    const now = new Date();
    return sortByDue(
      pendingTasks.filter((t) => {
        const d = safeDate(t.dueDate);
        return d && d > now && !isToday(d);
      })
    )[0] ?? null;
  }, [pendingTasks]);

  const behavioralInsight = useMemo(() => {
    if (!patterns) return null;
    const { urgentUntouched, staleTasks, latenessProfile, overallStats } = patterns;
    const today = new Date();

    // ── 1. Low grade + urgent ────────────────────────────────────
    const lowGradeUrgent = enrichedTasks.find((t) => {
      const d = safeDate(t.dueDate);
      return t._lowGrade && !t.completed && d && differenceInCalendarDays(d, today) <= 3;
    });
    if (lowGradeUrgent) {
      return {
        text: `"${lowGradeUrgent.title}" is due soon and you have a low grade in ${lowGradeUrgent.className}.`,
        icon: "trending-up",
        color: colors.high,
      };
    }

    // ── 2. Urgent untouched ──────────────────────────────────────
    if (urgentUntouched?.length > 0) {
      const t = urgentUntouched[0];
      return {
        text: `"${t.title}" is due soon — make sure you leave time for it.`,
        icon: "alert-triangle",
        color: colors.high,
      };
    }

    // ── 3. Clustered deadlines + lateness pattern ────────────────
    // Find the next day in the upcoming 7 days with 2+ tasks due
    const pending = tasks.filter((t) => !t.completed && t.dueDate);
    const byDay = {};
    pending.forEach((t) => {
      const d = safeDate(t.dueDate);
      if (!d) return;
      const daysAway = differenceInCalendarDays(d, today);
      if (daysAway < 0 || daysAway > 7) return;
      const key = daysAway;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(t);
    });
    const busiestEntry = Object.entries(byDay)
      .filter(([, ts]) => ts.length >= 2)
      .sort((a, b) => Number(a[0]) - Number(b[0]))[0]; // earliest busy day

    if (busiestEntry) {
      const daysAway  = Number(busiestEntry[0]);
      const count     = busiestEntry[1].length;
      const dayName   = daysAway === 0 ? "today"
                      : daysAway === 1 ? "tomorrow"
                      : format(addDays(today, daysAway), "EEEE");
      const hasLateness = latenessProfile?.totalSamples >= 3;
      const isLastMinute = hasLateness && (latenessProfile.avgDaysBefore ?? 1) < 1.5;

      let text;
      if (isLastMinute) {
        const avg = latenessProfile.avgDaysBefore;
        const avgLabel = avg < 0.5 ? "the last minute"
                       : avg < 1   ? "just before the deadline"
                       :             "around a day before the deadline";
        text = `You have ${count} things due ${dayName} — and you typically finish ${avgLabel}. Start today to stay ahead.`;
      } else if (count >= 3) {
        text = `${count} tasks due ${dayName}. Heavy day ahead — spread the work out now.`;
      } else if (daysAway <= 2) {
        text = `${count} tasks due ${dayName}. Don't let them stack up.`;
      } else {
        text = null; // not urgent enough to surface
      }

      if (text) {
        return {
          text,
          icon: "calendar",
          color: daysAway <= 1 ? colors.high : colors.medium,
        };
      }
    }

    // ── 4. Stale task ────────────────────────────────────────────
    if (staleTasks?.length > 0) {
      const t = staleTasks[0];
      return {
        text: `"${t.title}" hasn't been touched in ${t.daysSinceTouched} days.`,
        icon: "clock",
        color: colors.medium,
      };
    }

    // ── 5. Generic lateness nudge ────────────────────────────────
    if (latenessProfile?.label === "often late" && overallStats?.totalPending > 0) {
      return {
        text: "You tend to finish late. Start your highest-priority item first today.",
        icon: "trending-up",
        color: colors.accent,
      };
    }

    return null;
  }, [patterns, enrichedTasks, tasks]);

  const handleTabChange = useCallback((tab) => {
    Haptics.selectionAsync().catch(() => {});
    setTabLoading(true);
    setActiveTab(tab);
    if (tabContainerWidth > 0) {
      const segW = (tabContainerWidth - 6) / TABS.length;
      Animated.spring(tabIndicatorX, {
        toValue: TABS.indexOf(tab) * segW,
        useNativeDriver: true,
        speed: 30,
        bounciness: 0,
      }).start();
    }
    InteractionManager.runAfterInteractions(() => setTabLoading(false));
  }, [tabContainerWidth, tabIndicatorX]);

  const handleEditTask = (task) => {
    if (!task) return;
    openAddTask(task);
  };
  const handleDeleteTask = (task) => {
    if (!task) return;
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          removeTask(task.id, task.notificationIds ?? task.notificationId),
      },
    ]);
  };
  const handleClearCompleted = () => {
    if (completedTasks.length === 0) return;
    Alert.alert(
      "Clear Completed Tasks",
      `Remove all ${completedTasks.length} completed task${completedTasks.length !== 1 ? "s" : ""}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => clearCompleted().catch(() => {}),
        },
      ]
    );
  };

  const handleToggle = (task) => {
    if (!task) return;
    if (!task.completed) {
      // Card animates its own height to 0 before calling here, so by the
      // time setCompletingIds removes it from the tree the space is already gone.
      setCompletingIds((prev) => new Set([...prev, task.id]));
    } else {
      setCompletingIds((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
    completeTask(task);
    invalidateTodayFocusCache();
  };
  const serializeTask = (task) => ({
    ...task,
    createdAt:
      task.createdAt instanceof Date
        ? task.createdAt.toISOString()
        : task.createdAt ?? null,
    dueDate:
      task.dueDate instanceof Date
        ? task.dueDate.toISOString()
        : task.dueDate ?? null,
    completedAt:
      task.completedAt instanceof Date
        ? task.completedAt.toISOString()
        : task.completedAt ?? null,
    lastTouchedAt:
      task.lastTouchedAt instanceof Date
        ? task.lastTouchedAt.toISOString()
        : task.lastTouchedAt ?? null,
  });
  const handleFocusTask = (task) => {
    if (!task) return;
    navigation.navigate("FocusMode", { task: serializeTask(task) });
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile?.name?.split(" ")[0] ?? null;
  const isFirstTime =
    !loading && tasks.length === 0 && completedTasks.length === 0;

  const renderBucket = (label, taskList, color) => {
    if (taskList.length === 0) return null;
    return (
      <View key={label}>
        <View style={styles.bucketHeader}>
          <View style={[styles.bucketDot, { backgroundColor: color }]} />
          <Text style={[styles.bucketLabel, { color }]}>{label}</Text>
          <Text style={[styles.bucketCount, { color, backgroundColor: color + "18" }]}>
            {taskList.length}
          </Text>
        </View>
        {sortByDue(taskList).map((task, idx) =>
          task ? (
            <View key={task.id} ref={(r) => { if (r) taskViewRefs.current[task.id] = r; }}>
              <TaskCard
                task={task}
                onToggle={handleToggle}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onFocus={handleFocusTask}
                highlighted={task.id === highlightedTaskId}
                index={idx}
              />
            </View>
          ) : null
        )}
      </View>
    );
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </Text>
          <View style={styles.dateRow}>
            <Text style={styles.date}>{format(now, "EEEE, MMMM d")}</Text>
            {streak > 0 && (
              <View style={styles.streakPill}>
                <Text>🔥</Text>
                <Text style={styles.streakText}>{streak} day{streak !== 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(isPro ? "StudyPlan" : "Paywall");
            }}
            style={styles.importBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="edit-3" size={16} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setCalendarLoading(true);
              setCalendarMode((m) => !m);
              if (!calendarMode) setCalWeekOffset(0);
              InteractionManager.runAfterInteractions(() => setCalendarLoading(false));
            }}
            style={[styles.importBtn, calendarMode && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="calendar" size={16} color={calendarMode ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate("SyllabusParser"); }}
            style={styles.importBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="upload-cloud" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollOffsetY.current = e.nativeEvent.contentOffset.y; }}
        refreshControl={
          <RefreshControl
            refreshing={loading && tasks.length === 0}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={{ height: spacing.md }} />
        <StatsBar
          todayCount={todaysTasks.length}
          pendingCount={pendingTasks.length}
          completedCount={completedTasks.length}
        />

        {/* Today's Focus — auto-loads, no button press needed */}
        {tasks.length > 0 && (
          <TodayFocusCard
            tasks={tasks}
            userProfile={profile}
            patterns={patterns}
            onTaskHighlight={setHighlightedTaskId}
          />
        )}

        {/* Behavioral insight strip */}
        {behavioralInsight && (
          <InsightStrip
            key={behavioralInsight.text}
            insight={behavioralInsight}
            styles={styles}
            colors={colors}
          />
        )}

        {calendarLoading ? (
          calendarMode ? <CalendarSkeleton /> : <TaskListSkeleton />
        ) : calendarMode ? (
          /* ── Calendar view ──────────────────────────────────── */
          <WeekCalendar
            tasks={enrichedTasks}
            onEditTask={handleEditTask}
            weekOffset={calWeekOffset}
            onWeekChange={setCalWeekOffset}
            colors={colors}
          />
        ) : (
          /* ── List view ──────────────────────────────────────── */
          <>
            {/* Tabs */}
            <View
              style={styles.segmentedControl}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setTabContainerWidth(w);
                tabIndicatorX.setValue(TABS.indexOf(activeTab) * ((w - 6) / TABS.length));
              }}
            >
              {tabContainerWidth > 0 && (
                <Animated.View
                  style={[
                    styles.segmentActivePill,
                    {
                      width: (tabContainerWidth - 6) / TABS.length,
                      transform: [{ translateX: tabIndicatorX }],
                    },
                  ]}
                />
              )}
              {TABS.map((tab) => {
                const count =
                  tab === "Today" ? todaysTasks.length :
                  tab === "Done"  ? completedTasks.length : null;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); handleTabChange(tab); }}
                    style={styles.segment}
                  >
                    <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
                      {tab}{count !== null && count > 0 ? ` · ${count}` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Task list */}
            {tabLoading ? (
              <TaskListSkeleton />
            ) : loading && tasks.length === 0 ? (
              <DashboardSkeleton />
            ) : isFirstTime ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Feather name="zap" size={32} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>You're all set up!</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first task, or import your entire semester from a Canvas calendar.
                </Text>
                <View style={styles.emptyActionsRow}>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => { Haptics.selectionAsync().catch(() => {}); openAddTask(); }}>
                    <Feather name="plus" size={15} color="#fff" />
                    <Text style={styles.emptyBtnText}>Add Task</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.emptyBtnOutline}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate("SyllabusParser"); }}
                  >
                    <Feather name="upload" size={15} color={colors.accent} />
                    <Text style={styles.emptyBtnOutlineText}>Import</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : activeTab === "All" &&
              displayedTasks.filter((t) => !t.completed).length === 0 &&
              completedTasks.length > 0 ? (
              <View style={styles.allDoneContainer}>
                <View style={styles.allDoneIcon}>
                  <Feather name="check-circle" size={32} color={colors.low} />
                </View>
                <Text style={styles.allDoneTitle}>All done! 🎉</Text>
                <Text style={styles.allDoneSubtitle}>
                  Nothing pending. Add something new or ask your coach for help.
                </Text>
              </View>
            ) : activeTab === "All" ? (
              <>
                {renderBucket("Overdue", buckets.overdue, colors.high)}
                {renderBucket("Due Today", buckets.dueToday, colors.medium)}
                {renderBucket("This Week", buckets.thisWeek, colors.accent)}
                {renderBucket("Later", buckets.later, colors.textMuted)}
                {renderBucket("Someday", buckets.noDate, colors.textMuted)}
                {buckets.completed.length > 0 && (
                  <View style={{ marginTop: spacing.sm }}>
                    <View style={styles.bucketHeader}>
                      <View style={[styles.bucketDot, { backgroundColor: colors.low }]} />
                      <Text style={[styles.bucketLabel, { color: colors.low }]}>Completed</Text>
                      <Text style={[styles.bucketCount, { color: colors.low, backgroundColor: colors.low + "18" }]}>
                        {buckets.completed.length}
                      </Text>
                    </View>
                    {buckets.completed.slice(0, 5).map((task, idx) =>
                      task ? (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onEdit={handleEditTask}
                          onDelete={handleDeleteTask}
                          onFocus={handleFocusTask}
                          index={idx}
                        />
                      ) : null
                    )}
                    {buckets.completed.length > 5 && (
                      <Text style={[styles.sectionLabel, { textAlign: "center", marginTop: spacing.xs }]}>
                        + {buckets.completed.length - 5} more completed
                      </Text>
                    )}
                    <TouchableOpacity style={styles.clearBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); handleClearCompleted(); }}>
                      <Feather name="trash-2" size={13} color={colors.high} />
                      <Text style={styles.clearBtnText}>Clear completed</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : displayedTasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Feather
                    name={activeTab === "Done" ? "check-circle" : "inbox"}
                    size={28}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === "Done"
                    ? "Nothing completed yet"
                    : activeTab === "Today"
                    ? "Nothing due today"
                    : "All clear!"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === "Done"
                    ? "Check off tasks and they'll appear here."
                    : activeTab === "Today"
                    ? nextUpTask
                      ? `Next up: "${nextUpTask.title}" — due ${format(safeDate(nextUpTask.dueDate), "MMM d")}`
                      : "You're ahead of schedule."
                    : "No pending tasks. Tap + to add one."}
                </Text>
              </View>
            ) : (
              <>
                {displayedTasks.map((task, idx) =>
                  task ? (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onFocus={handleFocusTask}
                      highlighted={task.id === highlightedTaskId}
                      index={idx}
                    />
                  ) : null
                )}
                {activeTab === "Done" && displayedTasks.length > 0 && (
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClearCompleted}>
                    <Feather name="trash-2" size={13} color={colors.high} />
                    <Text style={styles.clearBtnText}>Clear completed</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <NotificationPermissionPrompt
        visible={showNotifPrompt}
        onDismiss={() => setShowNotifPrompt(false)}
      />
    </View>
  );
};

export default DashboardScreen;