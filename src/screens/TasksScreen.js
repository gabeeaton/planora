import React, { useState, useCallback, useContext, useRef, useMemo, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { spacing, getClassColor } from "../utils/theme";
import { AddTaskContext } from "../navigation/AppNavigator";
import TaskCard from "../components/TaskCard";
import CompletionBurst from "../components/CompletionBurst";
import { invalidateTodayFocusCache } from "../services/openai";
import { TaskListSkeleton } from "../components/SkeletonLoader";
import { FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

const _n = Date.now();
const DEMO_TASKS_ALL = [
  { id: "d-1", title: "Discussion post — environmental policy", className: "POLS 200", dueDate: new Date(_n - 2 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d0",  title: "Review lecture notes — today's quiz",   className: "BIOL 150", dueDate: new Date(_n),               completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d0b", title: "POLS 200 — online discussion post",     className: "POLS 200", dueDate: new Date(_n + 3600000),     completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d1",  title: "Study for Organic Chemistry midterm",   className: "CHEM 201", dueDate: new Date(_n + 86400000),    completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d2",  title: "Write 5-page essay on the Civil War",   className: "HIST 110", dueDate: new Date(_n + 2*86400000),  completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d3",  title: "Problem Set 4 — Linear Algebra",        className: "MATH 240", dueDate: new Date(_n + 3*86400000),  completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d4",  title: "Read chapters 7–9 for lecture",         className: "PSYC 101", dueDate: new Date(_n + 4*86400000),  completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d5",  title: "Lab report — titration experiment",      className: "CHEM 201", dueDate: new Date(_n + 5*86400000),  completed: false, priority: "LOW",    aiPriority: "LOW"    },
  { id: "d6",  title: "Spanish composition draft",              className: "SPAN 102", dueDate: new Date(_n + 6*86400000),  completed: false, priority: "LOW",    aiPriority: "LOW"    },
  { id: "d7",  title: "Quiz review — macro economics",          className: "ECON 101", dueDate: new Date(_n + 86400000),    completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM", completedAt: new Date(_n - 86400000) },
  { id: "d8",  title: "Group project slides",                   className: "BUS 210",  dueDate: new Date(_n - 86400000),    completed: true,  priority: "HIGH",   aiPriority: "HIGH",   completedAt: new Date(_n - 2 * 86400000) },
  { id: "d9",  title: "Annotated bibliography draft",           className: "HIST 110", dueDate: new Date(_n - 3*86400000),  completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM", completedAt: new Date(_n - 4 * 86400000) },
];

const TABS = ["All", "Today", "Done"];

const toDate = (val) => {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Returns semester start date from a label like "Spring 2025"
const getSemesterStart = (sem) => {
  if (!sem) return null;
  const lower = sem.toLowerCase();
  const yearMatch = sem.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  if (lower.includes("winter")) return new Date(year, 0, 6);
  if (lower.includes("spring")) return new Date(year, 0, 13);
  if (lower.includes("summer")) return new Date(year, 4, 15);
  if (lower.includes("fall"))   return new Date(year, 7, 20);
  return null;
};

export default function TasksScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { openAddTask, openQuickAdd } = useContext(AddTaskContext);
  const insets = useSafeAreaInsets();
  const real = useTasks();
  const { profile } = useUserProfile();

  const tasks          = DEMO_MODE ? DEMO_TASKS_ALL : real.tasks;
  const pendingTasks   = DEMO_MODE ? DEMO_TASKS_ALL.filter(t => !t.completed) : real.pendingTasks;
  const completedTasks = DEMO_MODE ? DEMO_TASKS_ALL.filter(t => t.completed)  : real.completedTasks;
  const todaysTasks    = DEMO_MODE
    ? DEMO_TASKS_ALL.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString())
    : real.todaysTasks;
  const loading        = DEMO_MODE ? false : real.loading;
  const completeTask   = DEMO_MODE ? () => {} : real.completeTask;
  const removeTask     = DEMO_MODE ? () => {} : real.removeTask;
  const clearCompleted = DEMO_MODE ? () => {} : real.clearCompleted;

  const [activeTab, setActiveTab]         = useState("All");
  const [completingIds, setCompletingIds] = useState(new Set());
  const burstRef = useRef(null);

  // Semester start — gates what shows in the Done tab
  const semesterStart = useMemo(
    () => getSemesterStart(DEMO_MODE ? "Spring 2025" : profile?.semester),
    [profile?.semester]
  );

  // Done tab: only show this semester's completed tasks
  const semesterCompleted = useMemo(() => {
    if (!semesterStart) return completedTasks;
    return completedTasks.filter(t => {
      const d = toDate(t.completedAt);
      return d && d >= semesterStart;
    });
  }, [completedTasks, semesterStart]);

  // Once Firestore confirms a completion, remove from completingIds so the task
  // can land in the Done tab.
  useEffect(() => {
    if (completingIds.size === 0) return;
    const confirmed = tasks.filter(t => t.completed && completingIds.has(t.id));
    if (confirmed.length === 0) return;
    setCompletingIds(prev => {
      const next = new Set(prev);
      confirmed.forEach(t => next.delete(t.id));
      return next;
    });
  }, [tasks]);

  // Apply optimistic completingIds filter so tasks disappear immediately on tap
  const displayedTasks = useMemo(() => {
    const base =
      activeTab === "Today" ? todaysTasks :
      activeTab === "Done"  ? semesterCompleted :
      pendingTasks;
    return completingIds.size > 0 ? base.filter(t => !completingIds.has(t.id)) : base;
  }, [activeTab, todaysTasks, semesterCompleted, pendingTasks, completingIds]);

  const handleToggle = useCallback((task) => {
    if (!task) return;
    if (!task.completed) {
      setCompletingIds(prev => new Set([...prev, task.id]));
      completeTask(task);
      invalidateTodayFocusCache();
      burstRef.current?.trigger(getClassColor(task.className, colors.isDark));
    } else {
      completeTask(task);
      invalidateTodayFocusCache();
    }
  }, [completeTask, colors.isDark]);

  const handleEdit = useCallback((task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openAddTask(task);
  }, [openAddTask]);

  const handleDelete = useCallback((task) => {
    if (!task) return;
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => removeTask(task.id, task.notificationIds ?? task.notificationId),
      },
    ]);
  }, [removeTask]);

  const handleClearCompleted = useCallback(() => {
    if (completedTasks.length === 0) return;
    Alert.alert(
      "Clear Completed",
      `Remove all ${completedTasks.length} completed task${completedTasks.length !== 1 ? "s" : ""}? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: () => clearCompleted().catch(() => {}) },
      ]
    );
  }, [completedTasks.length, clearCompleted]);

  const isEmpty = !loading && tasks.length === 0 && completedTasks.length === 0;

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Tasks</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            openQuickAdd();
          }}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color="#fff" />
          <Text style={s.addLabel}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map((tab) => {
          const count =
            tab === "Today" ? todaysTasks.length :
            tab === "Done"  ? semesterCompleted.length : null;
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, active && { backgroundColor: colors.accentGlow }]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveTab(tab); }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, active && { color: colors.accent, fontFamily: "Outfit-SemiBold" }]}>
                {tab}{count !== null && count > 0 ? ` · ${count}` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && tasks.length === 0 ? (
          <TaskListSkeleton />
        ) : isEmpty ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Feather name="check-circle" size={28} color={colors.accent} />
            </View>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptySub}>Tap + to add your first task.</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); openQuickAdd(); }}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>Add a task</Text>
            </TouchableOpacity>
          </View>
        ) : displayedTasks.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptySub}>
              {activeTab === "Done" ? "Nothing completed this semester yet." : "You're all caught up."}
            </Text>
          </View>
        ) : (
          <>
            {displayedTasks.map((task, idx) => (
              <TaskCard
                key={task.id}
                task={task}
                index={idx}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            {activeTab === "Done" && completedTasks.length > 0 && (
              <TouchableOpacity style={s.clearBtn} onPress={handleClearCompleted}>
                <Feather name="trash-2" size={13} color={colors.high} />
                <Text style={s.clearBtnText}>Clear all completed</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>
      <CompletionBurst ref={burstRef} />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: "#fff" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 10,
  },
  addLabel: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: "#fff" },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#EAEAF0",
  },
  tab: {
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 20,
  },
  tabText: { fontSize: 13, fontFamily: "Outfit-Medium", color: colors.textMuted },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 140 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textMuted, textAlign: "center", marginBottom: 24 },
  emptyBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: 14,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Outfit-Bold", color: "#fff" },
  clearBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginTop: 4,
  },
  clearBtnText: { fontSize: 13, fontFamily: "Outfit-Medium", color: colors.high },
});
