// ============================================================
// src/screens/DashboardScreen.js
// Changes from previous version:
//   - Replaced AISummaryCard with AIActionsCard (no more Summarize)
//   - TodayFocusCard cache invalidated when tasks change
//   - Focus mode hint removed (redundant — long press hint on TaskCard)
// ============================================================

import { FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

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
  DeviceEventEmitter,
  Image,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import TaskCard from "../components/TaskCard";
import StatsBar from "../components/StatsBar";
import TodayFocusCard from "../components/TodayFocusCard";
import NotificationPermissionPrompt, { NOTIF_PROMPT_KEY } from "../components/NotificationPermissionPrompt";
import { DashboardSkeleton, TaskListSkeleton, CalendarSkeleton } from "../components/SkeletonLoader";
import { invalidateTodayFocusCache, polishAceBrief } from "../services/openai";
import { checkAndScheduleAvoidanceAlerts, scheduleStreakReminder } from "../services/notifications";
import * as Notifications from "expo-notifications";
import { typography, spacing, radius, shadows, getClassColor } from "../utils/theme";
import { getSemesterStart } from "../utils/termHelpers";
const ACE_LOGO = require("../assets/logo.png");
import { useTheme } from "../utils/ThemeContext";
import CompletionBurst from "../components/CompletionBurst";
import TodaySchedule from "../components/TodaySchedule";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useFocusEffect } from "@react-navigation/native";
import { AddTaskContext } from "../contexts/AddTaskContext";
import { useSetWalkthroughTarget } from "../utils/WalkthroughContext";
import { Share } from "react-native";
import {
  format,
  addDays,
  isToday,
  startOfToday,
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
      paddingHorizontal: spacing.lg,
      paddingTop: 14,
      paddingBottom: 18,
      backgroundColor: colors.accent,
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 26,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.38,
      shadowRadius: 18,
      elevation: 10,
    },
    headerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    headerLeft: { flex: 1, marginRight: 10 },
    profileAvatar: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.55)",
      flexShrink: 0,
    },
    profileAvatarText: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#fff" },
    greeting: {
      fontFamily: "Outfit-ExtraBold", fontSize: 24,
      color: "#fff", letterSpacing: -0.3, lineHeight: 30,
    },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    date: { fontSize: 13, color: "rgba(255,255,255,0.70)", fontFamily: "Outfit-Medium" },
    // streak pill on same line as date
    streakPill: {
      flexDirection: "row", alignItems: "center", gap: 3,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: radius.full,
      paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.30)",
    },
    streakText: { fontSize: 12, fontFamily: "Outfit-ExtraBold", color: "#fff" },
    // Combined bottom row — status info + action buttons
    headerBottomRow: {
      flexDirection: "row", alignItems: "center",
      gap: 6, marginTop: 8,
    },
    statusChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      borderRadius: 9,
      paddingHorizontal: 9, paddingVertical: 5,
      backgroundColor: "rgba(255,255,255,0.13)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    },
    statusChipOverdue: {
      backgroundColor: "rgba(255,80,80,0.22)",
      borderColor: "rgba(255,100,100,0.40)",
    },
    statusChipText: {
      fontSize: 12, fontFamily: "Outfit-SemiBold", color: "rgba(255,255,255,0.9)",
    },
    statusChipTextOverdue: { color: "#FFB3B3" },
    statusChipToday: {
      flexDirection: "row", alignItems: "center", gap: 4,
      borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5,
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    dueTodayBang: {
      fontSize: 12, fontFamily: "Outfit-ExtraBold", color: "#fff",
    },
    dueTodayLabel: {
      fontSize: 12, fontFamily: "Outfit-SemiBold", color: "rgba(255,255,255,0.92)",
    },
    // ── Unified Ace card ──────────────────────────────────────
    aceCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: 16,
      borderWidth: 1, borderColor: colors.isDark ? colors.border : "#E8E8F0",
      borderLeftWidth: 4, borderLeftColor: colors.accent,
      overflow: "hidden",
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.10, shadowRadius: 8, elevation: 3,
      }),
    },
    aceCardHeader: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 8,
    },
    aceCardLogo: { width: 52, height: 52, flexShrink: 0 },
    aceCardName: {
      fontSize: 14, fontFamily: "Outfit-ExtraBold",
      color: colors.accent, letterSpacing: 0.2, flex: 1,
    },
    aceCardSparkle: {
      fontSize: 15, color: colors.accent, opacity: 0.75,
    },
    aceCardMessage: {
      fontSize: 15, fontFamily: "Outfit-Medium", fontStyle: "italic",
      color: colors.textPrimary, lineHeight: 25,
      paddingHorizontal: spacing.md, paddingTop: 2, paddingBottom: 20,
    },
    // Legacy — keep so nothing else references break
    aceBriefRow: { flexDirection: "row" },
    aceBriefLogo: { width: 15, height: 15 },
    aceBriefLine: { flex: 1, fontSize: 12 },
    // action strip at bottom of header
    actionStrip: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    actionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.20)",
    },
    actionChipActive: {
      backgroundColor: "rgba(255,255,255,0.92)",
    },
    actionChipText: {
      fontSize: 12, fontFamily: "Outfit-SemiBold", color: "#fff",
    },
    actionChipTextActive: {
      color: colors.accent,
    },
    // kept for compat but unused after rearrange
    headerSummaryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    headerSummaryDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,120,120,0.85)" },
    headerSummaryText: { fontSize: 11, fontFamily: "Outfit-SemiBold", color: "rgba(255,255,255,0.65)" },
    decoOrb: {
      position: "absolute",
      width: 100, height: 100,
      borderRadius: 50,
    },
    decoSparkle: {
      position: "absolute",
      fontFamily: "Outfit-ExtraBold",
    },

    subGreetingBanner: {
      marginHorizontal: spacing.lg,
      marginTop: 10,
      marginBottom: 2,
    },
    subGreetingText: {
      fontSize: 13, fontFamily: "Outfit-Medium",
      color: colors.textSecondary,
    },
    importBtn: {
      alignItems: "center", justifyContent: "center", gap: 2,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
      borderWidth: 1, borderColor: colors.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: colors.isDark ? 0 : 0.06, shadowRadius: 4, elevation: 2,
    },
    importBtnLabel: {
      fontSize: 11, fontFamily: "Outfit-SemiBold", letterSpacing: 0.2,
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

    headerStatsStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.15)",
      marginTop: 10,
      paddingTop: 8,
      paddingBottom: 4,
    },
    headerStatItem:   { flex: 1, alignItems: "center" },
    headerStatNum:    { fontFamily: "Outfit-ExtraBold", fontSize: 17, color: "#fff", letterSpacing: -0.3 },
    headerStatLabel:  { fontFamily: "Outfit-Medium", fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.4 },
    headerStatDivider: { width: 1, height: 22, backgroundColor: "rgba(255,255,255,0.18)" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: insets.bottom + 90 },

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

    behaviorCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    behaviorCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 7,
    },
    behaviorCardLogo: {
      width: 14,
      height: 14,
      borderRadius: 3,
    },
    behaviorCardLabel: {
      fontSize: 10,
      fontFamily: "Outfit-ExtraBold",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    behaviorCardText: {
      fontSize: 13,
      fontFamily: "Outfit-Regular",
      lineHeight: 19,
    },

    allDoneCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.low + "30",
      backgroundColor: colors.isDark ? colors.low + "12" : colors.low + "0D",
      padding: 14,
      marginTop: 6,
      marginBottom: spacing.sm,
    },
    allDoneIconWrap: {
      width: 36, height: 36, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    allDoneTitle: { fontSize: 14, fontFamily: "Outfit-Bold" },
    allDoneSub:   { fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 1 },

    briefCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.border : "#E8E8F4",
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      padding: 14,
      marginBottom: spacing.sm,
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }),
    },
    briefHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 9,
    },
    briefAvatar: {
      width: 22, height: 22, borderRadius: 6,
    },
    briefName: {
      fontSize: 11, fontFamily: "Outfit-ExtraBold",
      color: colors.accent, letterSpacing: 0.6,
    },
    briefDot: {
      width: 4, height: 4, borderRadius: 2,
      backgroundColor: colors.low,
      marginLeft: 2,
    },
    briefLive: {
      fontSize: 10, fontFamily: "Outfit-SemiBold",
      color: colors.low, letterSpacing: 0.3,
    },
    briefText: {
      fontSize: 13.5, fontFamily: "Outfit-Medium",
      color: colors.textPrimary, lineHeight: 20,
    },

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
    overdueAlertCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      borderRadius: 12, borderWidth: 1,
      borderColor: colors.isDark ? "rgba(255,80,80,0.28)" : "rgba(220,38,38,0.22)",
      backgroundColor: colors.isDark ? "rgba(255,60,60,0.11)" : "rgba(220,38,38,0.07)",
      padding: 12, marginBottom: 4,
    },
    overdueAlertLeft: {
      width: 30, height: 30, borderRadius: 9,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.isDark ? "rgba(255,80,80,0.20)" : "rgba(220,38,38,0.14)",
    },
    overdueAlertTitle: {
      fontSize: 13, fontFamily: "Outfit-Bold",
      color: colors.isDark ? "#FF8080" : "#DC2626",
    },
    overdueAlertSub: {
      fontSize: 11, fontFamily: "Outfit-Regular",
      color: colors.isDark ? "rgba(255,140,140,0.70)" : "rgba(185,28,28,0.65)",
      marginTop: 1,
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
  const _dn = Date.now();
  const DEMO_TASKS = [
    { id: "d-1", title: "Discussion post — environmental policy", className: "POLS 200", dueDate: new Date(_dn - 2 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d0",  title: "Review lecture notes — today's quiz",    className: "BIOL 150", dueDate: new Date(_dn),                completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
    { id: "d0b", title: "POLS 200 — online discussion post",      className: "POLS 200", dueDate: new Date(_dn + 3600000),     completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d1",  title: "Study for Organic Chemistry midterm",    className: "CHEM 201", dueDate: new Date(_dn + 86400000),     completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
    { id: "d2",  title: "Write 5-page essay on the Civil War",    className: "HIST 110", dueDate: new Date(_dn + 2 * 86400000), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
    { id: "d3",  title: "Problem Set 4 — Linear Algebra",         className: "MATH 240", dueDate: new Date(_dn + 3 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d4",  title: "Read chapters 7–9 for lecture",          className: "PSYC 101", dueDate: new Date(_dn + 4 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
    { id: "d5",  title: "Lab report — titration experiment",      className: "CHEM 201", dueDate: new Date(_dn + 5 * 86400000), completed: false, priority: "LOW",    aiPriority: "LOW"    },
    { id: "d6",  title: "Spanish composition draft",              className: "SPAN 102", dueDate: new Date(_dn + 6 * 86400000), completed: false, priority: "LOW",    aiPriority: "LOW"    },
    { id: "d7",  title: "Quiz review — macro economics",          className: "ECON 101", dueDate: new Date(_dn + 86400000),     completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM", completedAt: new Date(_dn - 2 * 86400000) },
    { id: "d8",  title: "Group project slides",                   className: "BUS 210",  dueDate: new Date(_dn - 86400000),     completed: true,  priority: "HIGH",   aiPriority: "HIGH",   completedAt: new Date(_dn - 5 * 86400000) },
    { id: "d9",  title: "Annotated bibliography draft",           className: "HIST 110", dueDate: new Date(_dn - 3 * 86400000), completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM", completedAt: new Date(_dn - 10 * 86400000) },
  ];
  const _tod = new Date();
  const _dh = (h, m) => { const d = new Date(_tod); d.setHours(h, m, 0, 0); return d; };
  const DEMO_CAL_EVENTS = [
    { id: "ce1", title: "CHEM 201 — Lecture",      startDate: _dh(9,   0), endDate: _dh(10, 15), color: "#6C6FE5" },
    { id: "ce2", title: "BIOL 150 — Lab & Quiz",   startDate: _dh(11,  0), endDate: _dh(11, 50), color: "#2ECC71" },
    { id: "ce3", title: "PSYC 101 — Discussion",   startDate: _dh(14,  0), endDate: _dh(15, 15), color: "#F5A623" },
    { id: "ce4", title: "MATH 240 — Office Hours", startDate: _dh(15, 30), endDate: _dh(16, 20), color: "#E74C3C" },
  ];
  const DEMO_PATTERNS = {
    latenessProfile: { label: "last minute", totalSamples: 8, avgDaysBefore: 0 },
    productiveTimeOfDay: { bestTime: "evening", totalSamples: 8 },
    staleTasks: [],
    urgentUntouched: [],
    avoidanceScores: [],
    overallStats: { totalPending: 8 },
  };
  const DEMO_PROFILE = {
    name: "Alex Johnson",
    semester: "Spring 2026",
    schoolSystem: "semester",
    isPro: true,
    classes: [
      { id: "dc1", name: "CHEM 201", creditHours: "3", grade: "C+" },
      { id: "dc2", name: "BIOL 150", creditHours: "3", grade: "B+" },
      { id: "dc3", name: "HIST 110", creditHours: "3", grade: "B"  },
      { id: "dc4", name: "MATH 240", creditHours: "3", grade: "A-" },
      { id: "dc5", name: "POLS 200", creditHours: "3", grade: "B-" },
      { id: "dc6", name: "PSYC 101", creditHours: "3", grade: "A"  },
    ],
  };

  const profile       = DEMO_MODE ? DEMO_PROFILE : realProfile;
  const isPro         = DEMO_MODE ? true : realIsPro;
  const tasks         = DEMO_MODE ? DEMO_TASKS : realTasks.tasks;
  const pendingTasks  = DEMO_MODE ? DEMO_TASKS.filter(t => !t.completed) : realTasks.pendingTasks;
  const completedTasks = DEMO_MODE ? DEMO_TASKS.filter(t => t.completed) : realTasks.completedTasks;
  const todaysTasks   = DEMO_MODE ? DEMO_TASKS.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()) : realTasks.todaysTasks;
  const patterns      = DEMO_MODE ? DEMO_PATTERNS : realTasks.patterns;
  const loading       = DEMO_MODE ? false : realTasks.loading;
  const streak        = DEMO_MODE ? 7 : realTasks.streak;
  const createTask    = DEMO_MODE ? () => {} : realTasks.createTask;
  const editTask      = DEMO_MODE ? () => {} : realTasks.editTask;
  const completeTask  = DEMO_MODE ? () => {} : realTasks.completeTask;
  const removeTask    = DEMO_MODE ? () => {} : realTasks.removeTask;
  const clearCompleted = DEMO_MODE ? () => {} : realTasks.clearCompleted;

  const { openAddTask } = useContext(AddTaskContext);
  const setTarget = useSetWalkthroughTarget();
  const studyPlanBtnRef  = useRef(null);
  const syllabusBtnRef   = useRef(null);
  const statsBarRef         = useRef(null);
  const todayFocusRef       = useRef(null);
  const insightStripRef     = useRef(null);
  const todayScheduleRef    = useRef(null);
  const focusBtnRegistered      = useRef(false);
  const firstPendingIdRef       = useRef(null);
  const focusBtnRef             = useRef(null);
  const priorityBadgeRef        = useRef(null);
  const priorityBadgeRegistered = useRef(false);
  const measureBtn = (ref, name, r = 18) => {
    ref.current?.measureInWindow((x, y, w, h) => {
      setTarget(name, { cx: x + w / 2, cy: y + h / 2, w, h, r });
    });
  };

  const [completingIds, setCompletingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState("All");
  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [now, setNow] = useState(new Date());

  // ── All-done-today celebration ────────────────────────────────
  const [showAllDoneToday, setShowAllDoneToday] = useState(false);
  const allDoneAnim    = useRef(new Animated.Value(0)).current;
  const prevTodayCount = useRef(null);
  useEffect(() => {
    const prev = prevTodayCount.current;
    prevTodayCount.current = todaysTasks.length;
    if (prev === null || prev === 0 || todaysTasks.length !== 0 || loading) return;
    setShowAllDoneToday(true);
    allDoneAnim.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(allDoneAnim, { toValue: 1, speed: 16, bounciness: 6, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(allDoneAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(
        () => setShowAllDoneToday(false)
      );
    }, 7000);
    return () => clearTimeout(t);
  }, [todaysTasks.length, loading]);

  // ── Streak pill pulse ─────────────────────────────────────────
  const streakScale    = useRef(new Animated.Value(1)).current;
  const prevStreakPill  = useRef(streak);
  useEffect(() => {
    if (streak <= 0 || streak === prevStreakPill.current) return;
    prevStreakPill.current = streak;
    Animated.sequence([
      Animated.spring(streakScale, { toValue: 1.35, speed: 50, bounciness: 0, useNativeDriver: true }),
      Animated.spring(streakScale, { toValue: 1,    speed: 18, bounciness: 10, useNativeDriver: true }),
    ]).start();
  }, [streak]);

  const [tabLoading, setTabLoading] = useState(false);
  const [planTodayCount, setPlanTodayCount] = useState(null);
  const [todayPlanSessions, setTodayPlanSessions] = useState([]);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [scheduleView, setScheduleView] = useState("today");

  const { events: calEvents, status: calStatus, requestPermission: requestCalPermission, refetchIfGranted } = useCalendarEvents(!DEMO_MODE);

  // Re-check calendar permission whenever dashboard comes into focus —
  // user may have granted it from the Calendar tab
  useFocusEffect(
    useCallback(() => {
      if (!DEMO_MODE && calStatus !== "granted") refetchIfGranted();
    }, [calStatus, refetchIfGranted])
  );

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
  const burstRef       = useRef(null);
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

  // Streak reminder — reschedule whenever streak, tasks, or productive time changes
  useEffect(() => {
    const bestTime = patterns?.productiveTimeOfDay?.bestTime ?? "evening";
    scheduleStreakReminder(streak, bestTime, user?.uid, tasks);
  }, [streak, tasks, patterns?.productiveTimeOfDay?.bestTime, user?.uid]);

  const loadTodayPlanSessions = useCallback(() => {
    AsyncStorage.getItem("@planora_study_plan_cache").then((raw) => {
      if (!raw) return;
      try {
        const { plan } = JSON.parse(raw);
        const todayStr = format(startOfToday(), "yyyy-MM-dd");
        const sessions = plan.filter((s) => s.date === todayStr && !s.completed && !s.missed);
        setPlanTodayCount(sessions.length > 0 ? sessions.length : 0);
        setTodayPlanSessions(sessions);
      } catch {}
    }).catch(() => {});
  }, []);

  useEffect(() => { loadTodayPlanSessions(); }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("studyPlanUpdated", loadTodayPlanSessions);
    return () => sub.remove();
  }, [loadTodayPlanSessions]);

  useEffect(() => {
    const scrollToFirstTask = (targetKey, remeasureRef, r) => {
      const firstId = firstPendingIdRef.current;
      if (!firstId || !scrollRef.current) return;
      taskViewRefs.current[firstId]?.measureInWindow((_, taskAbsY) => {
        scrollRef.current?.measureInWindow((__, svAbsY) => {
          const targetY = scrollOffsetY.current + (taskAbsY - svAbsY) - 160;
          scrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: false });
          setTimeout(() => {
            remeasureRef.current?.measureInWindow((wx, wy, ww, wh) => {
              if (ww > 0) setTarget(targetKey, { cx: wx + ww / 2, cy: wy + wh / 2, w: ww, h: wh, r });
            });
          }, 80);
        });
      });
    };

    const scrollToElement = (ref, targetKey, r) => {
      if (!ref.current || !scrollRef.current) return;
      ref.current.measureInWindow((_, elAbsY) => {
        scrollRef.current?.measureInWindow((__, svAbsY) => {
          const targetScrollY = scrollOffsetY.current + (elAbsY - svAbsY) - 80;
          scrollRef.current?.scrollTo({ y: Math.max(0, targetScrollY), animated: true });
          setTimeout(() => {
            ref.current?.measureInWindow((wx, wy, ww, wh) => {
              if (ww > 0) setTarget(targetKey, { cx: wx + ww / 2, cy: wy + wh / 2, w: ww, h: wh, r });
            });
          }, 400);
        });
      });
    };

    const sub = DeviceEventEmitter.addListener("walkthroughStep", (key) => {
      if (key === "statsBar")      scrollToElement(statsBarRef,      "statsBar",      14);
      if (key === "todayFocus")    scrollToElement(todayFocusRef,    "todayFocus",    16);
      if (key === "todaySchedule") scrollToElement(todayScheduleRef, "todaySchedule", 16);
      if (key === "priorityBadge") scrollToFirstTask("priorityBadge", priorityBadgeRef, 6);
      if (key === "focusBtn")      scrollToFirstTask("focusBtn",      focusBtnRef,      10);
    });
    return () => sub.remove();
  }, []);


  // Completed count filtered to current semester — keeps StatsBar number contextually accurate
  const semesterCompletedCount = useMemo(() => {
    const start = getSemesterStart(profile?.semester, profile?.schoolSystem);
    if (!start) return completedTasks.length;
    return completedTasks.filter(t => {
      const d = safeDate(t.completedAt);
      return d && d >= start;
    }).length;
  }, [completedTasks, profile?.semester, profile?.schoolSystem]);

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
      setCompletingIds((prev) => new Set([...prev, task.id]));
      completeTask(task);
      invalidateTodayFocusCache();
      burstRef.current?.trigger(getClassColor(task.className, colors.isDark));

    } else {
      setCompletingIds((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      completeTask(task);
      invalidateTodayFocusCache();
    }
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

  const COACH_NAME = "Ace"; // ← change this to swap the AI character name everywhere

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const subGreeting = () => {
    const due = todaysTasks.length;
    const h   = now.getHours();
    if (due === 0 && pendingTasks.length === 0) return "Nothing due — enjoy the break 🌿";
    if (due === 0) return "No deadlines today. Make progress on what's next.";
    if (due === 1) return "One thing needs your attention today.";
    if (due <= 3)  return `${due} things due today — a manageable list.`;
    if (h < 12)    return `${due} things due today. Early start = less stress.`;
    if (h < 17)    return `${due} things due today. Still time to get ahead.`;
    return `${due} things due today. Let's finish strong.`;
  };

  // Full coaching brief — built from all available client-side data, no API call.
  // Ace's voice: direct, honest, dry when warranted. Rooting for you but never hollow.
  const aceBrief = useMemo(() => {
    if (loading || tasks.length === 0) return null;
    const h = now.getHours();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon ... 6=Sat
    const name = profile?.name?.split(" ")[0] ?? null;

    const overdueTasks = pendingTasks.filter((t) => {
      const d = safeDate(t.dueDate);
      return d && differenceInCalendarDays(d, today) < 0;
    });

    // Map upcoming tasks by days-away (0–7)
    const upcomingByDay = {};
    pendingTasks.forEach((t) => {
      const d = safeDate(t.dueDate);
      if (!d) return;
      const daysAway = differenceInCalendarDays(d, today);
      if (daysAway < 0 || daysAway > 7) return;
      if (!upcomingByDay[daysAway]) upcomingByDay[daysAway] = [];
      upcomingByDay[daysAway].push(t);
    });
    const busiestDayEntry = Object.entries(upcomingByDay)
      .sort((a, b) => b[1].length - a[1].length)[0];
    const busiestDaysAway = busiestDayEntry ? Number(busiestDayEntry[0]) : null;
    const busiestCount    = busiestDayEntry ? busiestDayEntry[1].length : 0;
    const busiestDayName  = busiestDaysAway === 0 ? "today"
                          : busiestDaysAway === 1 ? "tomorrow"
                          : busiestDaysAway != null
                            ? format(addDays(today, busiestDaysAway), "EEEE")
                          : null;

    const weekTotal = pendingTasks.filter((t) => {
      const d = safeDate(t.dueDate);
      return d && differenceInCalendarDays(d, today) >= 0 && differenceInCalendarDays(d, today) <= 7;
    }).length;

    // Pattern data
    const latenessLabel    = patterns?.latenessProfile?.label;
    const avgDaysBefore    = patterns?.latenessProfile?.avgDaysBefore;
    const totalSamples     = patterns?.latenessProfile?.totalSamples ?? 0;
    const latePattern      = latenessLabel === "last minute" || latenessLabel === "often late";
    const staleName        = patterns?.staleTasks?.[0]?.title;
    const urgentUntouched  = patterns?.urgentUntouched ?? [];
    const bestTime         = patterns?.productiveTimeOfDay?.bestTime;
    const timeSamples      = patterns?.productiveTimeOfDay?.totalSamples ?? 0;

    // Highest-priority pending task for "start with this" call-out
    const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const highestPending = [...pendingTasks]
      .sort((a, b) => {
        const pa = PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1;
        const pb = PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        const da = safeDate(a.dueDate)?.getTime() ?? Infinity;
        const db = safeDate(b.dueDate)?.getTime() ?? Infinity;
        return da - db;
      })[0] ?? null;

    // Low-grade class + urgent deadline — high-signal alert
    const lowGradeUrgent = enrichedTasks.find((t) => {
      const d = safeDate(t.dueDate);
      return t._lowGrade && !t.completed && d && differenceInCalendarDays(d, today) <= 3;
    });

    // Urgent task not started yet (not overdue, but due soon and untouched)
    const urgentBlind = urgentUntouched.find(
      (t) => !overdueTasks.some((o) => o.id === t.id)
    ) ?? null;

    const parts = [];

    // ── PART 1: Lead — what's the situation right now ──────────────
    if (overdueTasks.length === 1) {
      const t = overdueTasks[0];
      if (latePattern) {
        parts.push(`${name ? `${name}, ` : ""}"${t.title}" is past due — you've been in this spot before, and you know how it plays out. Today's actually a great chance to flip the script. Let's get it done.`);
      } else {
        parts.push(`${name ? `${name}, ` : ""}one thing past due: "${t.title}". Fifteen minutes on it right now beats scrambling tonight — let's knock it out.`);
      }
    } else if (overdueTasks.length > 1) {
      if (latePattern) {
        parts.push(`${name ? `${name}, ` : ""}${overdueTasks.length} things are past due — and yeah, it's go-time. Don't try to tackle all of them at once. Pick the quickest one and get off zero. That first win changes the whole vibe.`);
      } else {
        parts.push(`${name ? `${name}, ` : ""}${overdueTasks.length} things past due. Don't stress the order — grab whichever one is fastest to start and just go. Momentum beats perfect every time.`);
      }
    } else if (todaysTasks.length === 0 && weekTotal === 0) {
      parts.push(streak >= 3
        ? `Clear board${name ? `, ${name}` : ""}! Nothing due, nothing coming, ${streak}-day streak — that's what staying ahead actually looks like. Seriously, nice work.`
        : `Nothing urgent, nothing overdue${name ? `, ${name}` : ""} — honestly, enjoy it! Or use the breathing room to get ahead. Either way, you're in a great spot.`
      );
    } else if (todaysTasks.length === 1) {
      const timeCtx = h < 12 ? "You've got the whole morning ahead — knock it out before things get busy."
                    : h < 17 ? "Afternoon's still yours — get it done now and the rest of your day is free."
                    : "Evening's your window — let's get it done.";
      parts.push(`One thing on your plate today${name ? `, ${name}` : ""}: "${todaysTasks[0].title}". ${timeCtx}`);
    } else if (todaysTasks.length > 1) {
      const timeCtx = h < 12 ? `Morning is prime time — let's lock in.`
                    : h < 17 ? `Afternoon's not gone yet — you've still got time.`
                    : `Tonight's your window and it's moving fast.`;
      parts.push(`${todaysTasks.length} things due today${name ? `, ${name}` : ""}. ${timeCtx} Don't overthink it — pick one and go.`);
    } else if (dayOfWeek === 1 && h < 12 && weekTotal > 0) {
      parts.push(`Fresh week${name ? `, ${name}` : ""}! Nothing due today, but ${weekTotal} thing${weekTotal === 1 ? "" : "s"} coming up. How you start Monday sets the whole tone — worth taking 5 minutes to map it out now.`);
    } else if (dayOfWeek === 0 && weekTotal > 0) {
      parts.push(`${weekTotal} thing${weekTotal === 1 ? "" : "s"} coming up this week${name ? `, ${name}` : ""}. Sunday's the perfect time to look at the list before Monday hits — future you will thank you.`);
    } else if (weekTotal > 0) {
      parts.push(`Clear today${name ? `, ${name}` : ""}! ${weekTotal > 1 ? `${weekTotal} things are` : "Something's"} coming up this week though — great chance to chip away at one before it becomes urgent.`);
    }

    // ── PART 2: Specific start recommendation ──────────────────────
    if (overdueTasks.length === 0 && highestPending) {
      const isHigh = (highestPending.aiPriority ?? highestPending.priority) === "HIGH";
      const alreadyNamed = (todaysTasks.length === 1 && todaysTasks[0]?.id === highestPending.id)
                        || (overdueTasks.length === 1 && overdueTasks[0]?.id === highestPending.id);
      if (!alreadyNamed && (isHigh || todaysTasks.length > 1)) {
        parts.push(`If you're picking where to start, go with "${highestPending.title}" — that's your highest-priority item right now.`);
      }
    }

    // ── PART 3: Low grade + imminent deadline ──────────────────────
    if (lowGradeUrgent && overdueTasks.length === 0) {
      parts.push(`Quick heads-up — "${lowGradeUrgent.title}" is due soon and your grade in ${lowGradeUrgent.className} needs those points. This one actually moves the needle.`);
    }

    // ── PART 4: Urgent task that hasn't been opened yet ────────────
    if (urgentBlind && !lowGradeUrgent && overdueTasks.length === 0) {
      const daysOut = differenceInCalendarDays(safeDate(urgentBlind.dueDate) ?? today, today);
      const when = daysOut === 0 ? "today" : daysOut === 1 ? "tomorrow" : `in ${daysOut} days`;
      parts.push(`"${urgentBlind.title}" is due ${when} and it looks like it hasn't been started yet. Today's the day to get it open and moving.`);
    }

    // ── PART 5: Task being avoided ────────────────────────────────
    if (staleName && overdueTasks.length === 0 && !lowGradeUrgent && !urgentBlind) {
      parts.push(`Real talk — "${staleName}" keeps getting bumped. Ten minutes on it today breaks that cycle and it'll feel way less heavy.`);
    }

    // ── PART 6: Upcoming cluster warning ──────────────────────────
    if (busiestCount >= 2 && busiestDayName && busiestDaysAway != null && busiestDaysAway > 1) {
      parts.push(`${busiestDayName} has ${busiestCount} things due. Start chipping away at one now and that day gets way more manageable.`);
    } else if (busiestCount >= 2 && busiestDayName === "tomorrow" && overdueTasks.length === 0 && todaysTasks.length === 0) {
      parts.push(`Tomorrow has ${busiestCount} things due — today's low-pressure, perfect time to chip away at one.`);
    }

    // ── PART 7: Behavioral pattern (≥5 data points) ───────────────
    if (totalSamples >= 3) {
      if (latenessLabel === "plans ahead" && avgDaysBefore != null) {
        parts.push(`By the way — you've been finishing ${avgDaysBefore} day${avgDaysBefore !== 1 ? "s" : ""} ahead of deadline on average. That buffer is exactly why nothing feels like a crisis right now. Keep that going.`);
      } else if (latenessLabel === "last minute" && avgDaysBefore != null && avgDaysBefore <= 0) {
        parts.push(`Heads up — you've been finishing things the day they're due. It works until it doesn't. Even one task done a day early completely changes how those deadlines feel.`);
      } else if (latenessLabel === "last minute" && avgDaysBefore != null) {
        parts.push(`Your average finish is about ${avgDaysBefore} day${avgDaysBefore !== 1 ? "s" : ""} before the deadline. That's tighter than it sounds on a heavy week — worth giving yourself a bigger buffer.`);
      } else if (latenessLabel === "often late") {
        parts.push(`Looking at your history — a few things have slipped past deadline. Just one early finish this week can start turning that around. You've got this.`);
      }
    }

    // ── PART 8: Peak work time ─────────────────────────────────────
    if (timeSamples >= 3 && bestTime && parts.length <= 2 && overdueTasks.length === 0) {
      parts.push(`Your completions tend to pile up in the ${bestTime} — that's your real power window. Block it off and protect it.`);
    }

    // ── PART 9: Streak ────────────────────────────────────────────
    if (streak >= 7 && overdueTasks.length === 0) {
      parts.push(`${streak} days in a row! That's not luck — that's a real habit you've built. Keep the streak alive.`);
    } else if (streak >= 3 && streak < 7 && overdueTasks.length === 0 && parts.length <= 1) {
      parts.push(`${streak}-day streak! Consistency is the part most people underestimate. Keep that thread going.`);
    }

    // ── PART 10: Calendar + class schedule context ────────────────
    // Only fires when it adds something Parts 1-9 didn't already cover
    if (parts.length <= 2 && pendingTasks.length > 0) {
      const DAY_MAP_10 = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
      const todayDay10 = DAY_MAP_10[now.getDay()];
      const parseT = (str) => {
        if (!str) return null;
        const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (!m) return null;
        let h = parseInt(m[1]), mn = parseInt(m[2]);
        if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
        const d = new Date(now); d.setHours(h, mn, 0, 0); return d;
      };
      const schedEvents = (profile?.classSchedule ?? [])
        .filter((e) => e.days?.includes(todayDay10))
        .map((e) => ({ title: e.className, startDate: parseT(e.startTime) }))
        .filter((e) => e.startDate != null);
      const calToday = (DEMO_MODE ? DEMO_CAL_EVENTS : calEvents).filter((e) => {
        const start = e.startDate instanceof Date ? e.startDate : new Date(e.startDate);
        return isToday(start);
      });
      const activeEvents = [...schedEvents, ...calToday];
      if (activeEvents.length > 0) {
        const sorted = [...activeEvents].sort((a, b) => {
          const sa = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
          const sb = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
          return sa - sb;
        });
        const firstEvent = sorted[0];
        const firstStart = firstEvent.startDate instanceof Date ? firstEvent.startDate : new Date(firstEvent.startDate);
        const minsUntilFirst = Math.floor((firstStart - now) / 60000);

        if (minsUntilFirst > 75 && minsUntilFirst < 360) {
          const hStr = minsUntilFirst >= 120
            ? `${Math.floor(minsUntilFirst / 60)}h ${minsUntilFirst % 60 > 0 ? `${minsUntilFirst % 60}min` : ""}`.trim()
            : `${minsUntilFirst}min`;
          parts.push(`You've got ${hStr} before ${firstEvent.title ?? "class"} — that's a solid window. Use it.`);
        } else if (activeEvents.length >= 3) {
          parts.push(`Heavy schedule today — ${activeEvents.length} things on the calendar. The gaps between classes are your real windows. Use them.`);
        } else if (overdueTasks.length === 0 && todaysTasks.length === 0) {
          parts.push(`${activeEvents.length === 1 ? "One thing" : `${activeEvents.length} things`} on the schedule today. Plenty of time around it — good day to make some progress.`);
        }
      }
    }

    return parts.filter(Boolean).join(" ") || null;
  }, [loading, tasks, pendingTasks, todaysTasks, enrichedTasks, patterns, streak, now, calEvents, profile?.classSchedule, profile?.name]);

  // ── Polish aceBrief via AI — cached by content, falls back to raw on failure ──
  const [polishedBrief, setPolishedBrief] = useState(null);
  const briefPolishRef = useRef(false);
  useEffect(() => {
    if (!aceBrief) { setPolishedBrief(null); return; }
    briefPolishRef.current = false;
    setPolishedBrief(null);
    const name = profile?.name?.split(" ")[0] ?? null;
    polishAceBrief(aceBrief, name).then((result) => {
      if (!briefPolishRef.current) setPolishedBrief(result);
    });
    return () => { briefPolishRef.current = true; };
  }, [aceBrief]);

  // ── Class schedule → today's events ──────────────────────────
  const classScheduleEvents = useMemo(() => {
    const schedule = profile?.classSchedule;
    if (!schedule?.length) return [];
    const DAY_MAP = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
    const todayDay = DAY_MAP[now.getDay()];
    const parseTime = (str) => {
      if (!str) return null;
      const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (!m) return null;
      let h = parseInt(m[1]), min = parseInt(m[2]);
      if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      const d = new Date(now);
      d.setHours(h, min, 0, 0);
      return d;
    };
    return schedule
      .filter((e) => e.days?.includes(todayDay))
      .map((e) => ({
        id: `sched-${e.id}`,
        title: e.className,
        startDate: parseTime(e.startTime),
        endDate: parseTime(e.endTime),
        color: colors.accent,
        allDay: false,
      }))
      .filter((e) => e.startDate != null)
      .sort((a, b) => a.startDate - b.startDate);
  }, [profile?.classSchedule, now, colors.accent]);

  // Today only: class schedule for today + cal events for today
  const todayDisplayEvents = useMemo(() => {
    if (DEMO_MODE) return DEMO_CAL_EVENTS;
    const cal = (calEvents ?? []).filter((e) => {
      const start = e.startDate instanceof Date ? e.startDate : new Date(e.startDate);
      return isToday(start);
    });
    const all = [...classScheduleEvents, ...cal];
    return all.sort((a, b) => {
      const sa = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
      const sb = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
      return sa - sb;
    });
  }, [classScheduleEvents, calEvents]);

  // Upcoming: class schedule + cal events for next 6 days (not today)
  const upcomingDisplayEvents = useMemo(() => {
    if (DEMO_MODE) return [];
    const DAY_MAP = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
    const schedule = profile?.classSchedule ?? [];
    const parseTimeForDate = (str, date) => {
      if (!str) return null;
      const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (!m) return null;
      let h = parseInt(m[1]), min = parseInt(m[2]);
      if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      const d = new Date(date);
      d.setHours(h, min, 0, 0);
      return d;
    };
    const upcomingClasses = [];
    for (let i = 1; i <= 6; i++) {
      const day = addDays(now, i);
      const dayStr = DAY_MAP[day.getDay()];
      schedule.filter(e => e.days?.includes(dayStr)).forEach(e => {
        const startDate = parseTimeForDate(e.startTime, day);
        const endDate   = parseTimeForDate(e.endTime, day);
        if (startDate) upcomingClasses.push({ id: `sched-${e.id}-${i}`, title: e.className, startDate, endDate, color: colors.accent, allDay: false });
      });
    }
    const cal = (calEvents ?? []).filter(e => {
      const start = e.startDate instanceof Date ? e.startDate : new Date(e.startDate);
      return !isToday(start) && start > now;
    });
    return [...upcomingClasses, ...cal].sort((a, b) => {
      const sa = a.startDate instanceof Date ? a.startDate : new Date(a.startDate);
      const sb = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
      return sa - sb;
    });
  }, [calEvents, profile?.classSchedule, now, colors.accent]);

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
        {sortByDue(taskList).map((task, idx) => {
          const isFirst = !focusBtnRegistered.current;
          if (isFirst) { focusBtnRegistered.current = true; firstPendingIdRef.current = task.id; }
          return task ? (
            <View key={task.id} ref={(r) => { if (r) taskViewRefs.current[task.id] = r; }}>
              <TaskCard
                task={task}
                onToggle={handleToggle}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onFocus={handleFocusTask}
                highlighted={task.id === highlightedTaskId}
                index={idx}
                onFocusBtnMeasure={isFirst ? (rect, ref) => { setTarget("focusBtn", rect); if (ref) focusBtnRef.current = ref; } : undefined}
                onPriorityBadgeMeasure={isFirst ? (rect, ref) => { setTarget("priorityBadge", rect); if (ref) priorityBadgeRef.current = ref; } : undefined}
              />
            </View>
          ) : null;
        })}
      </View>
    );
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {/* Decorative background — sparkles + glow orb */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
          <View style={[styles.decoOrb, { backgroundColor: "rgba(255,255,255,0.12)", right: -30, top: -30 }]} />
          <View style={[styles.decoOrb, { width: 60, height: 60, backgroundColor: "rgba(255,255,255,0.07)", right: 60, top: 10 }]} />
          <Text style={[styles.decoSparkle, { color: "rgba(255,255,255,0.45)", top: 8, right: 100, fontSize: 10 }]}>✦</Text>
          <Text style={[styles.decoSparkle, { color: "rgba(255,255,255,0.28)", top: 22, right: 50, fontSize: 6 }]}>✦</Text>
          <Text style={[styles.decoSparkle, { color: "rgba(255,255,255,0.35)", top: 40, right: 120, fontSize: 7 }]}>✦</Text>
          <Text style={[styles.decoSparkle, { color: "rgba(255,255,255,0.25)", bottom: 20, right: 80, fontSize: 9 }]}>✦</Text>
          <Text style={[styles.decoSparkle, { color: "rgba(255,255,255,0.30)", bottom: 35, right: 30, fontSize: 5 }]}>✦</Text>
        </View>

        {/* Row 1 — greeting + avatar on same line */}
        <View style={styles.headerTopRow}>
          <Text style={[styles.greeting, { flex: 1 }]}>
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </Text>
          <TouchableOpacity
            style={styles.profileAvatar}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate("Profile");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.profileAvatarText}>
              {(profile?.name ?? user?.email ?? "?")[0].toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2 — date + streak (left) · Plan + Sync (right) */}
        <View style={styles.dateRow}>
          <Text style={styles.date}>{format(now, "EEE, MMM d")}</Text>
          {streak > 0 && (
            <Animated.View style={[styles.streakPill, { transform: [{ scale: streakScale }] }]}>
              <MaterialCommunityIcons name="fire" size={16} color="#FF6B2C" />
              <Text style={styles.streakText}>{streak}</Text>
            </Animated.View>
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            ref={studyPlanBtnRef}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(isPro ? "StudyPlan" : "Paywall");
            }}
            style={styles.actionChip}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            onLayout={() => measureBtn(studyPlanBtnRef, "studyPlan")}
            activeOpacity={0.7}
          >
            <Feather name="edit-3" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.actionChipText}>Plan</Text>
          </TouchableOpacity>
          {!profile?.icsUrl && (
            <TouchableOpacity
              ref={syllabusBtnRef}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate("SyllabusParser"); }}
              style={styles.actionChip}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              onLayout={() => measureBtn(syllabusBtnRef, "syllabusImport")}
            >
              <Feather name="upload-cloud" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.actionChipText}>Sync</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status row — only renders when there are alerts */}
        {(buckets.overdue.length > 0 || buckets.dueToday.length > 0) && (
          <View style={styles.headerBottomRow}>
            {buckets.overdue.length > 0 && (
              <View style={[styles.statusChip, styles.statusChipOverdue]}>
                <Feather name="alert-circle" size={11} color="#FF8080" />
                <Text style={[styles.statusChipText, styles.statusChipTextOverdue]}>
                  {buckets.overdue.length} overdue
                </Text>
              </View>
            )}
            {buckets.dueToday.length > 0 && (
              <View style={styles.statusChipToday}>
                <Text style={styles.dueTodayBang}>!</Text>
                <Text style={styles.dueTodayLabel}>{buckets.dueToday.length} due today</Text>
              </View>
            )}
          </View>
        )}

        {/* Thin stats strip — fused to bottom of header */}
        <View
          ref={statsBarRef}
          collapsable={false}
          style={styles.headerStatsStrip}
          onLayout={() => setTimeout(() => measureBtn(statsBarRef, "statsBar", 0), 150)}
        >
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNum, { color: todaysTasks.length > 0 ? "#FFD166" : "#fff" }]}>{todaysTasks.length}</Text>
            <Text style={styles.headerStatLabel}>Today</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNum, { color: "#fff" }]}>{pendingTasks.length}</Text>
            <Text style={styles.headerStatLabel}>Pending</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNum, { color: semesterCompletedCount > 0 ? "#6EFFA8" : "#fff" }]}>{semesterCompletedCount}</Text>
            <Text style={styles.headerStatLabel}>Done</Text>
          </View>
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
        {/* All-done-today celebration */}
        {showAllDoneToday && (
          <Animated.View
            style={[
              styles.allDoneCard,
              {
                opacity: allDoneAnim,
                transform: [{ scale: allDoneAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
              },
            ]}
          >
            <View style={[styles.allDoneIconWrap, { backgroundColor: colors.low + "22" }]}>
              <Text style={{ fontSize: 18 }}>✓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.allDoneTitle, { color: colors.low }]}>All done for today</Text>
              <Text style={[styles.allDoneSub, { color: colors.textMuted }]}>Every task on your list — finished.</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Ace coaching card — full paragraph from client-side data ── */}
        {aceBrief && (
          <View
            ref={insightStripRef}
            collapsable={false}
            style={styles.aceCard}
            onLayout={() => setTimeout(() => measureBtn(insightStripRef, "insightStrip", 16), 150)}
          >
            <View style={styles.aceCardHeader}>
              <Image source={ACE_LOGO} style={styles.aceCardLogo} resizeMode="contain" />
              <Text style={styles.aceCardName}>Ace's Brief</Text>
              <Text style={styles.aceCardSparkle}>✦</Text>
            </View>
            <Text style={styles.aceCardMessage}>{polishedBrief ?? aceBrief}</Text>
          </View>
        )}

        {/* Today's Focus — AI picks */}
        {tasks.length > 0 && (
          <View
            ref={todayFocusRef}
            collapsable={false}
            style={{ marginTop: 12 }}
            onLayout={() => setTimeout(() => measureBtn(todayFocusRef, "todayFocus", 16), 150)}
          >
            <TodayFocusCard
              tasks={tasks}
              userProfile={profile}
              patterns={patterns}
              onTaskHighlight={setHighlightedTaskId}
              navigation={navigation}
              isPro={isPro}
              todaySessions={isPro ? todayPlanSessions : []}
              focusOverride={DEMO_MODE ? {
                taskIds: ["d0", "d1", "d2"],
                insight: "Your Chem midterm is tomorrow and you have a quiz today — lecture notes first, they pull double duty.",
              } : undefined}
            />
          </View>
        )}

        {/* Stats bar */}
        {/* <View
          ref={statsBarRef}
          collapsable={false}
          style={{ marginTop: 12 }}
          onLayout={() => setTimeout(() => measureBtn(statsBarRef, "statsBar", 14), 150)}
        >
          <StatsBar
            todayCount={todaysTasks.length}
            pendingCount={pendingTasks.length}
            completedCount={semesterCompletedCount}
          />
        </View> */}

        {/* Today's / Upcoming schedule */}
        {(todayDisplayEvents.length > 0 || upcomingDisplayEvents.length > 0) && (
          <View
            style={{ marginTop: 12 }}
            ref={todayScheduleRef}
            onLayout={() => setTimeout(() => measureBtn(todayScheduleRef, "todaySchedule", 16), 200)}
          >
            <TodaySchedule
              events={scheduleView === "today" ? todayDisplayEvents : upcomingDisplayEvents}
              view={scheduleView}
              onToggleView={setScheduleView}
              onSeeAll={calStatus === "granted" ? () => navigation.navigate("Calendar") : undefined}
            />
          </View>
        )}

      </ScrollView>

      <NotificationPermissionPrompt
        visible={showNotifPrompt}
        onDismiss={() => setShowNotifPrompt(false)}
      />
      <CompletionBurst ref={burstRef} />

    </View>
  );
};

export default DashboardScreen;