// ============================================================
// src/screens/DashboardScreen.js
// ============================================================

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTasks }        from "../hooks/useTasks";
import { useAuth }         from "../hooks/useAuth";
import { useUserProfile }  from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import TaskCard            from "../components/TaskCard";
import TaskModal           from "../components/TaskModal";
import AISummaryCard       from "../components/AISummaryCard";
import StatsBar            from "../components/StatsBar";
import WhatDoIDoButton     from "../components/WhatDoIDoButton";
import SubscriptionGate    from "../components/SubscriptionGate";
import { colors, typography, spacing, radius, shadows } from "../utils/theme";
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from "date-fns";

const TABS = ["All", "Today", "Pending", "Done"];

// Format a day label nicely
const getDayLabel = (date) => {
  if (isToday(date))     return "Today";
  if (isTomorrow(date))  return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
};

const DashboardScreen = ({ navigation }) => {
  const { user, logout }          = useAuth();
  const { profile }               = useUserProfile();
  const { hasProAccess }          = useSubscription();
  const {
    tasks, pendingTasks, completedTasks, todaysTasks,
    patterns, loading,
    createTask, editTask, completeTask, removeTask,
  } = useTasks();

  const [activeTab, setActiveTab]               = useState("All");
  const [modalVisible, setModalVisible]         = useState(false);
  const [editingTask, setEditingTask]           = useState(null);
  const [aiAnnotatedTasks, setAiAnnotatedTasks] = useState([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  // Day cycling — for "Today" tab, allow browsing other days
  const [selectedDay, setSelectedDay] = useState(new Date());
  const cycleDay = (direction) => {
    setSelectedDay((prev) =>
      direction === "next" ? addDays(prev, 1) : subDays(prev, 1)
    );
    setActiveTab("Today");
  };

  // Merge AI annotations
  const enrichedTasks = useMemo(() => {
    if (aiAnnotatedTasks.length === 0) return tasks;
    const aiMap = {};
    aiAnnotatedTasks.forEach((t) => {
      aiMap[t.id] = { aiPriority: t.aiPriority, aiReason: t.aiReason };
    });
    return tasks.map((t) => ({ ...t, ...(aiMap[t.id] || {}) }));
  }, [tasks, aiAnnotatedTasks]);

  // Tab filtering — also hides completed recurring tasks (they spawn a new instance)
  const displayedTasks = useMemo(() => {
    let filtered = enrichedTasks;

    // Hide completed recurring tasks — the new instance is what you should see
    filtered = filtered.filter((t) => {
      if (t.recurrence && t.completed) return false;
      return true;
    });

    switch (activeTab) {
      case "Today":
        return filtered.filter((t) => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          return (
            due.getDate()     === selectedDay.getDate() &&
            due.getMonth()    === selectedDay.getMonth() &&
            due.getFullYear() === selectedDay.getFullYear()
          );
        });
      case "Pending": return filtered.filter((t) => !t.completed);
      case "Done":    return enrichedTasks.filter((t) => t.completed); // show completed in Done tab
      default:        return filtered;
    }
  }, [enrichedTasks, activeTab, selectedDay]);

  // Behavioral insight
  const behavioralInsight = useMemo(() => {
    if (!patterns) return null;
    const { urgentUntouched, staleTasks, latenessProfile, overallStats } = patterns;
    if (urgentUntouched?.length > 0) {
      const t = urgentUntouched[0];
      return { type: "urgent", text: `"${t.title}" is due soon and hasn't been touched today.`, icon: "alert-triangle", color: colors.high };
    }
    if (staleTasks?.length > 0) {
      const t = staleTasks[0];
      return { type: "stale", text: `"${t.title}" hasn't been touched in ${t.daysSinceTouched} days.`, icon: "clock", color: colors.medium };
    }
    if (latenessProfile?.label === "often late" && overallStats?.totalPending > 0) {
      return { type: "pattern", text: "You tend to finish tasks late. Start your highest-priority item first today.", icon: "trending-up", color: colors.accent };
    }
    return null;
  }, [patterns]);

  const handleAddTask    = () => { setEditingTask(null); setModalVisible(true); };
  const handleEditTask   = (task) => { if (!task) return; setEditingTask(task); setModalVisible(true); };
  const handleSaveTask   = async (taskData) => {
    if (editingTask) await editTask(editingTask.id, taskData);
    else             await createTask(taskData);
  };
  const handleDeleteTask = (task) => {
    if (!task) return;
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeTask(task.id, task.notificationId) },
    ]);
  };
  const handleToggle  = (task) => { if (!task) return; completeTask(task); };
  const handleLogout  = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          {/* Live date + time */}
          <Text style={styles.date}>
            {format(now, "EEEE, MMMM d")}
            <Text style={styles.time}>  {format(now, "h:mm a")}</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("WeeklyBriefing")}
            style={styles.headerBtn}
          >
            <Feather name="calendar" size={18} color={hasProAccess ? colors.accent : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} tintColor={colors.accent} colors={[colors.accent]} />}
      >
        {/* Stats */}
        <StatsBar
          todayCount={todaysTasks.length}
          pendingCount={pendingTasks.length}
          completedCount={completedTasks.length}
        />

        {/* Behavioral insight strip */}
        {behavioralInsight && (
          <View style={[styles.insightStrip, { borderColor: behavioralInsight.color }]}>
            <Feather name={behavioralInsight.icon} size={13} color={behavioralInsight.color} />
            <Text style={[styles.insightText, { color: behavioralInsight.color }]}>
              {behavioralInsight.text}
            </Text>
          </View>
        )}

        {/* What Do I Do — Pro */}
        <SubscriptionGate
          featureName="What Should I Do Right Now?"
          onUpgrade={() => navigation.navigate("Paywall")}
        >
          <WhatDoIDoButton
            tasks={tasks}
            userProfile={profile}
            patterns={patterns}
            onTaskHighlight={setHighlightedTaskId}
          />
        </SubscriptionGate>

        {/* AI Summary */}
        <AISummaryCard
          tasks={tasks}
          patterns={patterns}
          onPrioritiesUpdated={setAiAnnotatedTasks}
        />

        {/* Weekly plan promo */}
        {!hasProAccess && (
          <TouchableOpacity
            style={styles.weeklyPromo}
            onPress={() => navigation.navigate("Paywall")}
          >
            <View style={styles.weeklyPromoLeft}>
              <Feather name="calendar" size={16} color={colors.accent} />
              <Text style={styles.weeklyPromoText}>Get your AI weekly study plan →</Text>
            </View>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </TouchableOpacity>
        )}

        {hasProAccess && (
          <TouchableOpacity
            style={styles.weeklyPromo}
            onPress={() => navigation.navigate("WeeklyBriefing")}
          >
            <Feather name="calendar" size={16} color={colors.accent} />
            <Text style={styles.weeklyPromoText}>Open Weekly Study Plan →</Text>
          </TouchableOpacity>
        )}

        {/* Tab filter */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.tabScroll} contentContainerStyle={styles.tabContainer}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Day cycler — only shown on Today tab */}
        {activeTab === "Today" && (
          <View style={styles.dayCycler}>
            <TouchableOpacity onPress={() => cycleDay("prev")} style={styles.dayCyclerBtn}>
              <Feather name="chevron-left" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.dayCyclerCenter}>
              <Text style={styles.dayCyclerLabel}>{getDayLabel(selectedDay)}</Text>
              <Text style={styles.dayCyclerDate}>{format(selectedDay, "MMMM d, yyyy")}</Text>
            </View>
            <TouchableOpacity onPress={() => cycleDay("next")} style={styles.dayCyclerBtn}>
              <Feather name="chevron-right" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Task list */}
        {loading && tasks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : displayedTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{activeTab === "Done" ? "🎉" : "📋"}</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === "Done" ? "Nothing completed yet" : "All clear!"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "Done"
                ? "Complete tasks and they'll appear here."
                : activeTab === "Today"
                ? `No tasks due ${getDayLabel(selectedDay).toLowerCase()}.`
                : "No tasks here. Tap + to add one."}
            </Text>
          </View>
        ) : (
          displayedTasks.map((task) =>
            task ? (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={handleToggle}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                highlighted={task.id === highlightedTaskId}
              />
            ) : null
          )
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={handleAddTask} style={styles.fab} activeOpacity={0.85}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Task modal */}
      <TaskModal
        visible={modalVisible}
        task={editingTask}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveTask}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  greeting: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  date:     { ...typography.body, color: colors.textMuted, marginTop: 2 },
  time:     { color: colors.accent, fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },

  insightStrip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    marginBottom: spacing.md, backgroundColor: colors.bgCard,
  },
  insightText: { fontSize: 13, fontWeight: "500", flex: 1, lineHeight: 18 },

  weeklyPromo: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accentGlow,
  },
  weeklyPromoLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  weeklyPromoText: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  proBadge: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  proBadgeText: { fontSize: 9, color: "#fff", fontWeight: "800", letterSpacing: 0.5 },

  tabScroll:     { marginBottom: spacing.sm },
  tabContainer:  { gap: spacing.sm, paddingRight: spacing.md },
  tab: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  tabActive:     { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  tabText:       { ...typography.body, fontWeight: "600" },
  tabTextActive: { color: colors.accent },

  dayCycler: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md, overflow: "hidden",
  },
  dayCyclerBtn: {
    padding: spacing.md,
    borderColor: colors.border,
  },
  dayCyclerCenter: {
    flex: 1, alignItems: "center", paddingVertical: spacing.sm,
  },
  dayCyclerLabel: {
    fontSize: 15, fontWeight: "700", color: colors.textPrimary,
  },
  dayCyclerDate: {
    fontSize: 11, color: colors.textMuted, marginTop: 2,
  },

  loadingContainer: { alignItems: "center", paddingTop: 60 },
  loadingText:      { ...typography.body, marginTop: spacing.md },
  emptyContainer:   { alignItems: "center", paddingTop: 60 },
  emptyEmoji:       { fontSize: 48, marginBottom: spacing.md },
  emptyTitle:       { ...typography.h2, marginBottom: spacing.xs },
  emptySubtitle:    { ...typography.body, textAlign: "center" },

  fab: {
    position: "absolute", bottom: 32, right: spacing.lg,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    ...shadows.accent,
  },
});

export default DashboardScreen;