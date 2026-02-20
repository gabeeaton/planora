// ============================================================
// screens/DashboardScreen.js
// Main dashboard showing:
// - Greeting + date
// - Stats bar (today / pending / done)
// - AI summary card
// - Tab-filtered task list (All / Today / Pending / Done)
// - FAB for adding new tasks
// ============================================================

import React, { useState, useMemo } from "react";
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
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";
import AISummaryCard from "../components/AISummaryCard";
import StatsBar from "../components/StatsBar";
import { colors, typography, spacing, radius, shadows } from "../utils/theme";
import { format } from "date-fns";

const TABS = ["All", "Today", "Pending", "Done"];

const DashboardScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const {
    tasks,
    pendingTasks,
    completedTasks,
    todaysTasks,
    loading,
    createTask,
    editTask,
    completeTask,
    removeTask,
  } = useTasks();

  const [activeTab, setActiveTab] = useState("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // AI-annotated tasks (after pressing 'Suggest Priority')
  const [aiAnnotatedTasks, setAiAnnotatedTasks] = useState([]);

  // Merge AI annotations into the current task list
  const enrichedTasks = useMemo(() => {
    if (aiAnnotatedTasks.length === 0) return tasks;
    const aiMap = {};
    aiAnnotatedTasks.forEach((t) => {
      aiMap[t.id] = { aiPriority: t.aiPriority, aiReason: t.aiReason };
    });
    return tasks.map((t) => ({ ...t, ...(aiMap[t.id] || {}) }));
  }, [tasks, aiAnnotatedTasks]);

  // Filter tasks based on active tab
  const displayedTasks = useMemo(() => {
    switch (activeTab) {
      case "Today":
        return enrichedTasks.filter((t) => {
          if (!t.dueDate) return false;
          const today = new Date();
          const due = new Date(t.dueDate);
          return (
            due.getDate() === today.getDate() &&
            due.getMonth() === today.getMonth() &&
            due.getFullYear() === today.getFullYear()
          );
        });
      case "Pending":
        return enrichedTasks.filter((t) => !t.completed);
      case "Done":
        return enrichedTasks.filter((t) => t.completed);
      default:
        return enrichedTasks;
    }
  }, [enrichedTasks, activeTab]);

  const handleAddTask = () => {
    setEditingTask(null);
    setModalVisible(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setModalVisible(true);
  };

  const handleSaveTask = async (taskData) => {
    if (editingTask) {
      await editTask(editingTask.id, taskData);
    } else {
      await createTask(taskData);
    }
  };

  const handleDeleteTask = (task) => {
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeTask(task.id, task.notificationId),
      },
    ]);
  };

  const handleToggle = (task) => {
    completeTask(task.id, task.completed, task.notificationId);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>{format(new Date(), "EEEE, MMMM d")}</Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.avatarBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.avatarText}>
            {user?.email?.[0]?.toUpperCase() || "?"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* ── Stats Bar ──────────────────────────────────── */}
        <StatsBar
          todayCount={todaysTasks.length}
          pendingCount={pendingTasks.length}
          completedCount={completedTasks.length}
        />

        {/* ── AI Card ────────────────────────────────────── */}
        <AISummaryCard
          tasks={tasks}
          onPrioritiesUpdated={setAiAnnotatedTasks}
        />

        {/* ── Tab Filter ─────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContainer}
        >
          {TABS.map((tab) => (
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
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Task List ──────────────────────────────────── */}
        {loading && tasks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        ) : displayedTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>
              {activeTab === "Done" ? "🎉" : "📋"}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === "Done" ? "Nothing completed yet" : "All clear!"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "Done"
                ? "Complete tasks and they'll appear here."
                : "No tasks here. Tap + to add one."}
            </Text>
          </View>
        ) : (
          displayedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
            />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Floating Add Button ─────────────────────────── */}
      <TouchableOpacity
        onPress={handleAddTask}
        style={styles.fab}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* ── Task Modal ──────────────────────────────────── */}
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
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.display,
    fontSize: 26,
  },
  date: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentGlow,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  tabScroll: {
    marginBottom: spacing.md,
  },
  tabContainer: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  tabActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  tabText: {
    ...typography.body,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.accent,
  },
  loadingContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.accent,
  },
});

export default DashboardScreen;
