// ============================================================
// src/screens/StatsScreen.js
// GitHub-style completion heatmap + progress stats
// ============================================================

import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { format, subDays, eachDayOfInterval, startOfWeek } from "date-fns";
import { spacing, radius, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";

const makeStyles = (colors) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:    { ...typography.h1, color: colors.textPrimary },
  headerSubtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 48 },

  sectionTitle: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },

  // Stats cards row
  statsRow:   { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  statValue:  { fontSize: 28, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 4, textTransform: "uppercase" },
  statSub:    { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Heatmap
  heatmapCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  heatmapTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  heatmapSub:   { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.md },
  heatmapGrid:  { flexDirection: "row", gap: 3 },
  heatmapCol:   { flexDirection: "column", gap: 3 },
  heatmapCell:  { width: 11, height: 11, borderRadius: 2 },
  heatmapLegend: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: spacing.sm,
  },
  legendLabel:  { ...typography.bodySmall, color: colors.textMuted },
  legendCells:  { flexDirection: "row", gap: 3 },

  // Class breakdown
  classCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  classRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 10,
  },
  className: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  barTrack: {
    height: 6, backgroundColor: colors.border, borderRadius: 3,
    flex: 2, overflow: "hidden",
  },
  barFill:  { height: 6, borderRadius: 3 },
  barPct:   { fontSize: 12, color: colors.textMuted, marginLeft: 8, width: 32, textAlign: "right" },

  // Priority breakdown
  priorityCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  priorityRow:   { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  priorityDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  priorityLabel: { flex: 1, fontSize: 13, color: colors.textPrimary },
  priorityCount: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },

  // Streak calendar
  streakCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  dayLabels: { flexDirection: "row", gap: 3, marginBottom: 4 },
  dayLabelCol: { flexDirection: "column", gap: 3, marginRight: 4 },
  dayLabel:  { width: 11, height: 11, fontSize: 7, color: colors.textMuted, textAlign: "center", lineHeight: 11 },

  emptyState: {
    alignItems: "center", paddingVertical: 40,
  },
  emptyText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
});

// ── Heatmap helpers ───────────────────────────────────────────
const WEEKS_TO_SHOW = 18; // ~4 months
const DAYS_IN_GRID  = WEEKS_TO_SHOW * 7;

const getCellColor = (count, accent) => {
  if (count === 0) return null; // uses bgElevated
  if (count === 1) return accent + "40";
  if (count === 2) return accent + "70";
  if (count === 3) return accent + "A0";
  return accent; // 4+
};

const CLASS_COLORS = ["#6C63FF","#FF6B6B","#FFB347","#5CFF8F","#5BC8FF","#FF8EE8"];
const getClassColor = (name) => {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CLASS_COLORS[Math.abs(h) % CLASS_COLORS.length];
};

const StatsScreen = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { tasks, completedTasks } = useTasks();

  // ── Compute completion counts per day ──────────────────────
  const completionByDay = useMemo(() => {
    const map = {};
    completedTasks.forEach((t) => {
      const d = t.completedAt ? new Date(t.completedAt) : null;
      if (!d || isNaN(d)) return;
      const key = format(d, "yyyy-MM-dd");
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [completedTasks]);

  // Build grid: last N weeks, each column is a week (Mon→Sun)
  const today    = new Date();
  const gridDays = useMemo(() => {
    const end   = today;
    const start = subDays(end, DAYS_IN_GRID - 1);
    return eachDayOfInterval({ start, end });
  }, []);

  // Chunk into columns of 7 (week columns)
  const columns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < gridDays.length; i += 7) {
      cols.push(gridDays.slice(i, i + 7));
    }
    return cols;
  }, [gridDays]);

  // ── Overall stats ──────────────────────────────────────────
  const totalCompleted = completedTasks.length;
  const totalPending   = tasks.filter((t) => !t.completed).length;
  const totalOverdue   = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < today).length;

  const thisWeekCount = useMemo(() => {
    const weekStart = subDays(today, 6);
    return completedTasks.filter((t) => {
      const d = t.completedAt ? new Date(t.completedAt) : null;
      return d && d >= weekStart;
    }).length;
  }, [completedTasks]);

  // ── Class breakdown ────────────────────────────────────────
  const byClass = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = t.className ?? "No class";
      if (!map[key]) map[key] = { total: 0, done: 0 };
      map[key].total++;
      if (t.completed) map[key].done++;
    });
    return Object.entries(map)
      .map(([name, { total, done }]) => ({ name, total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [tasks]);

  // ── Priority breakdown of pending tasks ───────────────────
  const priorityBreakdown = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const high   = pending.filter((t) => (t.aiPriority ?? t.priority) === "HIGH").length;
    const medium = pending.filter((t) => (t.aiPriority ?? t.priority) === "MEDIUM").length;
    const low    = pending.filter((t) => (t.aiPriority ?? t.priority) === "LOW").length;
    return [
      { label: "High priority",   count: high,   color: "#FF5C5C" },
      { label: "Medium priority", count: medium, color: "#FFB347" },
      { label: "Low priority",    count: low,    color: "#5CFF8F" },
    ];
  }, [tasks]);

  if (tasks.length === 0 && completedTasks.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress</Text>
        </View>
        <View style={styles.emptyState}>
          <Feather name="bar-chart-2" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            Add tasks and complete them to see your progress charts here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <Text style={styles.headerSubtitle}>Your productivity at a glance</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Top stats ── */}
        <Text style={styles.sectionTitle}>OVERVIEW</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.low }]}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{thisWeekCount}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: totalOverdue > 0 ? colors.high : colors.textPrimary }]}>
              {totalOverdue}
            </Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </View>

        {/* ── GitHub-style heatmap ── */}
        <Text style={styles.sectionTitle}>ACTIVITY (LAST {WEEKS_TO_SHOW} WEEKS)</Text>
        <View style={styles.heatmapCard}>
          <Text style={styles.heatmapTitle}>Task Completion</Text>
          <Text style={styles.heatmapSub}>Each cell = one day · Darker = more tasks done</Text>

          {/* Fixed sidebar labels + scrollable grid */}
          <View style={{ flexDirection: "row" }}>
            <View style={styles.dayLabelCol}>
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <Text key={i} style={styles.dayLabel}>{d}</Text>
              ))}
            </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.heatmapGrid}>
              {columns.map((week, wi) => (
                <View key={wi} style={styles.heatmapCol}>
                  {week.map((day, di) => {
                    const key   = format(day, "yyyy-MM-dd");
                    const count = completionByDay[key] ?? 0;
                    const color = getCellColor(count, colors.accent);
                    const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                    const cellBg = isToday ? (color ?? colors.accent + "28") : (color ?? colors.bgElevated);
                    return (
                      <View
                        key={di}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: cellBg },
                          isToday && { borderWidth: 1.5, borderColor: colors.accent },
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          </View>

          {/* Legend */}
          <View style={styles.heatmapLegend}>
            <Text style={styles.legendLabel}>Less</Text>
            <View style={styles.legendCells}>
              {[null, "40", "70", "A0", "FF"].map((op, i) => (
                <View
                  key={i}
                  style={[styles.heatmapCell, {
                    backgroundColor: op ? colors.accent + op : colors.bgElevated,
                  }]}
                />
              ))}
            </View>
            <Text style={styles.legendLabel}>More</Text>
          </View>
        </View>

        {/* ── Per-class completion bars ── */}
        {byClass.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>BY CLASS</Text>
            <View style={styles.classCard}>
              {byClass.map(({ name, total, done, pct }) => (
                <View key={name} style={styles.classRow}>
                  <Text style={styles.className} numberOfLines={1}>{name}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      width: `${pct}%`,
                      backgroundColor: getClassColor(name),
                    }]} />
                  </View>
                  <Text style={styles.barPct}>{pct}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Priority breakdown of pending ── */}
        {totalPending > 0 && (
          <>
            <Text style={styles.sectionTitle}>PENDING BY PRIORITY</Text>
            <View style={styles.priorityCard}>
              {priorityBreakdown.map(({ label, count, color }) => (
                <View key={label} style={styles.priorityRow}>
                  <View style={[styles.priorityDot, { backgroundColor: color }]} />
                  <Text style={styles.priorityLabel}>{label}</Text>
                  <Text style={[styles.priorityCount, { color }]}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default StatsScreen;