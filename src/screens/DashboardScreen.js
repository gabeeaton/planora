// ============================================================
// src/screens/DashboardScreen.js
// Changes from previous version:
//   - Replaced AISummaryCard with AIActionsCard (no more Summarize)
//   - TodayFocusCard cache invalidated when tasks change
//   - Focus mode hint removed (redundant — long press hint on TaskCard)
//   - Weekly plan entry point kept in header
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import StatsBar from "../components/StatsBar";
import WhatDoIDoButton from "../components/WhatDoIDoButton";
import TodayFocusCard from "../components/TodayFocusCard";
import { invalidateTodayFocusCache } from "../services/openai";
import NotificationPermissionPrompt, {
  NOTIF_PROMPT_KEY,
} from "../components/NotificationPermissionPrompt";
import { typography, spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { Share } from "react-native";
import {
  format,
  addDays,
  subDays,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInCalendarDays,
} from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    headerLeft: { flex: 1 },
    greeting: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.mediumGlow,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.medium,
    },
    streakText: { fontSize: 12, fontWeight: "700", color: colors.medium },
    importBtn: {
      width: 34, height: 34,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.accentGlow,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    weeklyBtn: {
      padding: 6,
      backgroundColor: colors.accentGlow,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.accent,
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
    clearBtnText: { fontSize: 13, fontWeight: "600", color: colors.high },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 80 },

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
    insightText: { fontSize: 13, fontWeight: "500", flex: 1, lineHeight: 18 },

    tabScroll: { marginBottom: spacing.sm },
    tabContainer: { gap: 6, paddingRight: spacing.md },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    tabActive: {
      backgroundColor: colors.accentGlow,
      borderColor: colors.accent,
    },
    tabText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    tabTextActive: { color: colors.accent },

    dayCycler: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      overflow: "hidden",
    },
    dayCyclerBtn: { padding: spacing.md },
    dayCyclerCenter: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    dayCyclerLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    dayCyclerDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

    bucketHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing.md,
      marginBottom: 8,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bucketDot: { width: 8, height: 8, borderRadius: 4 },
    bucketLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      flex: 1,
    },
    bucketCount: {
      fontSize: 11, fontWeight: "700",
      paddingHorizontal: 7, paddingVertical: 2,
      borderRadius: radius.full,
      overflow: "hidden",
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },

    loadingContainer: { alignItems: "center", paddingTop: 60 },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
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
      fontWeight: "800",
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
    emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    emptyBtnOutlineText: {
      color: colors.accent,
      fontWeight: "700",
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
      backgroundColor: "rgba(92,255,143,0.15)",
      borderWidth: 1,
      borderColor: colors.low,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    allDoneTitle: {
      fontSize: 20,
      fontWeight: "800",
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

    fab: {
      position: "absolute",
      right: spacing.lg,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.accent,
    },
  });

const TABS = ["All", "Today", "Pending", "Done"];

const getDayLabel = (date) => {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
};

const bucketTasks = (tasks) => {
  const now = new Date();
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
      if (d < now) {
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
  const { profile } = useUserProfile();
  const { hasProAccess } = useSubscription();
  const {
    tasks,
    pendingTasks,
    completedTasks,
    todaysTasks,
    patterns,
    loading,
    streak,
    createTask,
    editTask,
    completeTask,
    removeTask,
    clearCompleted,
  } = useTasks();

  const [activeTab, setActiveTab] = useState("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [aiAnnotatedTasks, setAiAnnotatedTasks] = useState([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Show notification permission prompt once, after the user has tasks
  // (asking before they've seen the app's value gets a lower grant rate)
  useEffect(() => {
    if (tasks.length === 0 || loading) return;
    AsyncStorage.getItem(NOTIF_PROMPT_KEY)
      .then((shown) => {
        if (!shown) setShowNotifPrompt(true);
      })
      .catch(() => {});
  }, [tasks.length > 0, loading]);

  const cycleDay = (direction) => {
    setSelectedDay((prev) =>
      direction === "next" ? addDays(prev, 1) : subDays(prev, 1)
    );
    setActiveTab("Today");
  };

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
    if (aiAnnotatedTasks.length === 0) return gradeWeighted;
    const aiMap = {};
    aiAnnotatedTasks.forEach((t) => {
      aiMap[t.id] = { aiPriority: t.aiPriority, aiReason: t.aiReason };
    });
    return gradeWeighted.map((t) => ({ ...t, ...(aiMap[t.id] || {}) }));
  }, [tasks, aiAnnotatedTasks, profile?.classes]);

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
        return sortByDue(
          filtered.filter((t) => {
            const d = safeDate(t.dueDate);
            if (!d) return false;
            return (
              d.getDate() === selectedDay.getDate() &&
              d.getMonth() === selectedDay.getMonth() &&
              d.getFullYear() === selectedDay.getFullYear()
            );
          })
        );
      case "Pending":
        return sortByDue(filtered.filter((t) => !t.completed));
      case "Done":
        return enrichedTasks.filter((t) => t.completed);
      default:
        return sortByDue(filtered);
    }
  }, [enrichedTasks, activeTab, selectedDay]);

  const buckets = useMemo(() => bucketTasks(enrichedTasks), [enrichedTasks]);

  const behavioralInsight = useMemo(() => {
    if (!patterns) return null;
    const { urgentUntouched, staleTasks, latenessProfile, overallStats } =
      patterns;
    const lowGradeUrgent = enrichedTasks.find((t) => {
      const d = safeDate(t.dueDate);
      return (
        t._lowGrade &&
        !t.completed &&
        d &&
        differenceInCalendarDays(d, new Date()) <= 3
      );
    });
    if (lowGradeUrgent) {
      return {
        text: `"${lowGradeUrgent.title}" is due soon and you have a low grade in ${lowGradeUrgent.className}.`,
        icon: "trending-up",
        color: colors.high,
      };
    }
    if (urgentUntouched?.length > 0) {
      const t = urgentUntouched[0];
      return {
        text: `"${t.title}" is due soon and hasn't been started.`,
        icon: "alert-triangle",
        color: colors.high,
      };
    }
    if (staleTasks?.length > 0) {
      const t = staleTasks[0];
      return {
        text: `"${t.title}" hasn't been touched in ${t.daysSinceTouched} days.`,
        icon: "clock",
        color: colors.medium,
      };
    }
    if (
      latenessProfile?.label === "often late" &&
      overallStats?.totalPending > 0
    ) {
      return {
        text: "You tend to finish late. Start your highest-priority item first today.",
        icon: "trending-up",
        color: colors.accent,
      };
    }
    return null;
  }, [patterns, enrichedTasks]);

  const handleAddTask = () => {
    setEditingTask(null);
    setModalVisible(true);
  };
  const handleEditTask = (task) => {
    if (!task) return;
    setEditingTask(task);
    setModalVisible(true);
  };
  const handleSaveTask = async (taskData) => {
    if (editingTask) await editTask(editingTask.id, taskData);
    else await createTask(taskData);
    // New or edited task — refresh today's focus
    invalidateTodayFocusCache();
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
    completeTask(task);
    // Completing a task should refresh today's focus suggestions
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
    hasProAccess
      ? navigation.navigate("FocusMode", { task: serializeTask(task) })
      : navigation.navigate("Paywall");
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
        {sortByDue(taskList).map((task) =>
          task ? (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onFocus={handleFocusTask}
              highlighted={task.id === highlightedTaskId}
            />
          ) : null
        )}
      </View>
    );
  };

  const fabBottom = (insets.bottom || 16) + 20;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </Text>
          <Text style={styles.date}>{format(now, "EEEE, MMMM d")}</Text>
        </View>
        <View style={styles.headerRight}>
          {streak > 0 && (
            <View style={styles.streakPill}>
              <Text>🔥</Text>
              <Text style={styles.streakText}>
                {streak} day{streak !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
<TouchableOpacity
            onPress={() => navigation.navigate("SyllabusParser")}
            style={styles.importBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="upload-cloud" size={16} color={colors.accent} />
          </TouchableOpacity>
          {hasProAccess && (
            <TouchableOpacity
              onPress={() => navigation.navigate("WeeklyBriefing")}
              style={styles.weeklyBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="calendar" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && tasks.length === 0}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
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
          />
        )}

        {/* What should I do right now — Pro feature */}
        {tasks.length > 0 && (
          <WhatDoIDoButton
            tasks={tasks}
            userProfile={profile}
            patterns={patterns}
            onTaskHighlight={setHighlightedTaskId}
            onUpgrade={() => navigation.navigate("Paywall")}
            onPrioritiesUpdated={setAiAnnotatedTasks}
          />
        )}


        {/* Behavioral insight strip */}
        {behavioralInsight && (
          <View
            style={[
              styles.insightStrip,
              {
                borderLeftColor: behavioralInsight.color,
                borderColor: behavioralInsight.color + "33",
                backgroundColor: behavioralInsight.color + "10",
              },
            ]}
          >
            <Feather
              name={behavioralInsight.icon}
              size={13}
              color={behavioralInsight.color}
            />
            <Text
              style={[styles.insightText, { color: behavioralInsight.color }]}
            >
              {behavioralInsight.text}
            </Text>
          </View>
        )}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContainer}
        >
          {TABS.map((tab) => {
            const count =
              tab === "Today"   ? todaysTasks.length :
              tab === "Pending" ? pendingTasks.length :
              tab === "Done"    ? completedTasks.length : null;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab}{count !== null && count > 0 ? ` · ${count}` : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Day cycler for Today tab */}
        {activeTab === "Today" && (
          <View style={styles.dayCycler}>
            <TouchableOpacity
              onPress={() => cycleDay("prev")}
              style={styles.dayCyclerBtn}
            >
              <Feather
                name="chevron-left"
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            <View style={styles.dayCyclerCenter}>
              <Text style={styles.dayCyclerLabel}>
                {getDayLabel(selectedDay)}
              </Text>
              <Text style={styles.dayCyclerDate}>
                {format(selectedDay, "MMMM d, yyyy")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => cycleDay("next")}
              style={styles.dayCyclerBtn}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Task list */}
        {loading && tasks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : isFirstTime ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Feather name="zap" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>You're all set up!</Text>
            <Text style={styles.emptySubtitle}>
              Add your first task, or import your entire semester from a Canvas
              calendar.
            </Text>
            <View style={styles.emptyActionsRow}>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAddTask}>
                <Feather name="plus" size={15} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Task</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyBtnOutline}
                onPress={() => navigation.navigate("SyllabusParser")}
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
              Nothing pending. Add something new or check your weekly plan.
            </Text>
          </View>
        ) : activeTab === "All" ? (
          <>
            {renderBucket("Overdue", buckets.overdue, colors.high)}
            {renderBucket("Due Today", buckets.dueToday, colors.medium)}
            {renderBucket("This Week", buckets.thisWeek, colors.accent)}
            {renderBucket("Later", buckets.later, colors.textMuted)}
            {renderBucket("No Due Date", buckets.noDate, colors.textMuted)}
            {buckets.completed.length > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <View style={styles.bucketHeader}>
                  <View style={[styles.bucketDot, { backgroundColor: colors.low }]} />
                  <Text style={[styles.bucketLabel, { color: colors.low }]}>Completed</Text>
                  <Text style={[styles.bucketCount, { color: colors.low, backgroundColor: colors.low + "18" }]}>
                    {buckets.completed.length}
                  </Text>
                </View>
                {buckets.completed
                  .slice(0, 5)
                  .map((task) =>
                    task ? (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onFocus={handleFocusTask}
                      />
                    ) : null
                  )}
                {buckets.completed.length > 5 && (
                  <Text
                    style={[
                      styles.sectionLabel,
                      { textAlign: "center", marginTop: spacing.xs },
                    ]}
                  >
                    + {buckets.completed.length - 5} more completed
                  </Text>
                )}
                <TouchableOpacity style={styles.clearBtn} onPress={handleClearCompleted}>
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
                ? `Nothing due ${getDayLabel(selectedDay).toLowerCase()}`
                : "All clear!"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "Done"
                ? "Check off tasks and they'll appear here."
                : activeTab === "Today"
                ? "Enjoy the breather — or get ahead on upcoming work."
                : "No pending tasks. Tap + to add one."}
            </Text>
          </View>
        ) : (
          <>
            {displayedTasks.map((task) =>
              task ? (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onFocus={handleFocusTask}
                  highlighted={task.id === highlightedTaskId}
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
      </ScrollView>

      {/* FAB — add task */}
      <TouchableOpacity
        onPress={handleAddTask}
        style={[styles.fab, { bottom: fabBottom }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <TaskModal
        visible={modalVisible}
        task={editingTask}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTask}
      />

      <NotificationPermissionPrompt
        visible={showNotifPrompt}
        onDismiss={() => setShowNotifPrompt(false)}
      />
    </View>
  );
};

export default DashboardScreen;