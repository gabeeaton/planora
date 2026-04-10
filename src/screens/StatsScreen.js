// ============================================================
// src/screens/StatsScreen.js
// ============================================================

import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { differenceInCalendarDays, subDays } from "date-fns";

const CLASS_COLORS = ["#6C63FF","#FF6B6B","#FFB347","#5CFF8F","#5BC8FF","#FF8EE8"];
const getClassColor = (name) => {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CLASS_COLORS[Math.abs(h) % CLASS_COLORS.length];
};

const getSemesterEnd = (label) => {
  if (!label) return null;
  const lower = label.toLowerCase();
  const yearMatch = label.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  if (lower.includes("spring")) return new Date(year, 4, 9);
  if (lower.includes("summer")) return new Date(year, 7, 8);
  if (lower.includes("fall"))   return new Date(year, 11, 12);
  return null;
};

const getHealthRating = (pct, overdueCount) => {
  if (overdueCount >= 2 || pct < 40)
    return { label: "At risk",  color: "#FF5C5C", icon: "alert-triangle" };
  if (overdueCount >= 1 || pct < 65)
    return { label: "Behind",   color: "#FFB347", icon: "clock" };
  if (pct >= 85)
    return { label: "On track", color: "#5CFF8F", icon: "check-circle" };
  return   { label: "Okay",     color: "#5BC8FF", icon: "minus-circle" };
};

const makeStyles = (colors) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerLeft:     {},
  headerTitle:    { ...typography.h1, color: colors.textPrimary },
  headerSubtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.bgCard, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#FFB347",
  },
  streakText: { fontSize: 13, fontWeight: "700", color: "#FFB347" },
  streakLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 48 },
  sectionTitle:  { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.md },

  // Overview stat cards
  statsRow:  { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 4, textTransform: "uppercase" },

  // Finals countdown banner
  countdownCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  countdownIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent,
  },
  countdownDays:  { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  countdownLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  countdownSub:   { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Combined class card (health + bar merged)
  classCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    overflow: "hidden",
  },
  classRow: {
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  classRowLast: { borderBottomWidth: 0 },
  classTopRow:  { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  className:    { flex: 1, fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  classMeta:    { fontSize: 11, color: colors.textMuted },
  healthBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  healthBadgeText: { fontSize: 11, fontWeight: "700" },
  barRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  barFill:  { height: 6, borderRadius: 3 },
  barPct:   { fontSize: 12, fontWeight: "700", color: colors.textMuted, width: 32, textAlign: "right" },

  // Priority breakdown
  priorityCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  priorityRow:      { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  priorityRowLast:  { marginBottom: 0 },
  priorityLeft:     { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  priorityDot:      { width: 10, height: 10, borderRadius: 5 },
  priorityLabel:    { fontSize: 13, color: colors.textPrimary, fontWeight: "500" },
  priorityBarTrack: { flex: 2, height: 7, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  priorityBarFill:  { height: 7, borderRadius: 4 },
  priorityCount:    { fontSize: 13, fontWeight: "700", marginLeft: 8, width: 24, textAlign: "right" },

  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText:  { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center", lineHeight: 22 },
});

const StatsScreen = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { tasks, completedTasks, streak } = useTasks();
  const { profile } = useUserProfile();
  const today = new Date();

  const totalCompleted = completedTasks.length;
  const totalPending   = tasks.filter((t) => !t.completed).length;
  const totalOverdue   = tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate) < today).length;
  const thisWeekCount  = useMemo(() => {
    const weekStart = subDays(today, 6);
    return completedTasks.filter((t) => {
      const d = t.completedAt ? new Date(t.completedAt) : null;
      return d && d >= weekStart;
    }).length;
  }, [completedTasks]);

  const semesterEnd = getSemesterEnd(profile?.semester);
  const daysLeft    = semesterEnd ? differenceInCalendarDays(semesterEnd, today) : null;

  const byClass = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = t.className ?? "No class";
      if (!map[key]) map[key] = { total: 0, done: 0, overdue: 0 };
      map[key].total++;
      if (t.completed) map[key].done++;
      else if (t.dueDate && new Date(t.dueDate) < today) map[key].overdue++;
    });
    return Object.entries(map)
      .map(([name, { total, done, overdue }]) => ({
        name, total, done, overdue,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tasks]);

  const priorityBreakdown = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const high   = pending.filter((t) => (t.aiPriority ?? t.priority) === "HIGH").length;
    const medium = pending.filter((t) => (t.aiPriority ?? t.priority) === "MEDIUM").length;
    const low    = pending.filter((t) => (t.aiPriority ?? t.priority) === "LOW").length;
    const total  = high + medium + low || 1;
    return [
      { label: "High",   count: high,   color: "#FF5C5C", pct: (high / total) * 100 },
      { label: "Medium", count: medium, color: "#FFB347", pct: (medium / total) * 100 },
      { label: "Low",    count: low,    color: "#5CFF8F", pct: (low / total) * 100 },
    ];
  }, [tasks]);

  if (tasks.length === 0 && completedTasks.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Progress</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Feather name="bar-chart-2" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>{"Add tasks and complete them\nto see your progress here."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Progress</Text>
          <Text style={styles.headerSubtitle}>How your semester is going</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakPill}>
            <Text>🔥</Text>
            <View>
              <Text style={styles.streakText}>{streak} day{streak !== 1 ? "s" : ""}</Text>
              <Text style={styles.streakLabel}>streak</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Overview */}
        <Text style={styles.sectionTitle}>OVERVIEW</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#5CFF8F" }]}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{thisWeekCount}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: totalOverdue > 0 ? "#FF5C5C" : colors.textPrimary }]}>
              {totalOverdue}
            </Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </View>

        {/* Finals countdown */}
        {daysLeft !== null && daysLeft > 0 && daysLeft < 120 && (
          <>
            <Text style={styles.sectionTitle}>SEMESTER</Text>
            <View style={styles.countdownCard}>
              <View style={styles.countdownIcon}>
                <Feather name="calendar" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.countdownDays}>{daysLeft}</Text>
                <Text style={styles.countdownLabel}>days left in {profile?.semester}</Text>
                <Text style={styles.countdownSub}>
                  {daysLeft <= 14
                    ? "Finals season — prioritize ruthlessly."
                    : daysLeft <= 30
                    ? "Final stretch. Stay consistent."
                    : "Plenty of time. Build momentum now."}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Combined class health + completion */}
        {byClass.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>CLASSES</Text>
            <View style={styles.classCard}>
              {byClass.map(({ name, pct, overdue, total, done }, idx) => {
                const health = getHealthRating(pct, overdue);
                const isLast = idx === byClass.length - 1;
                return (
                  <View key={name} style={[styles.classRow, isLast && styles.classRowLast]}>
                    <View style={styles.classTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.className} numberOfLines={1}>{name}</Text>
                        <Text style={styles.classMeta}>
                          {done}/{total} done{overdue > 0 ? ` · ${overdue} overdue` : ""}
                        </Text>
                      </View>
                      <View style={[styles.healthBadge, { borderColor: health.color + "66", backgroundColor: health.color + "18" }]}>
                        <Feather name={health.icon} size={11} color={health.color} />
                        <Text style={[styles.healthBadgeText, { color: health.color }]}>{health.label}</Text>
                      </View>
                    </View>
                    <View style={styles.barRow}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: getClassColor(name) }]} />
                      </View>
                      <Text style={styles.barPct}>{pct}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Priority breakdown */}
        {totalPending > 0 && (
          <>
            <Text style={styles.sectionTitle}>PENDING BY PRIORITY</Text>
            <View style={styles.priorityCard}>
              {priorityBreakdown.map(({ label, count, color, pct }, idx) => {
                const isLast = idx === priorityBreakdown.length - 1;
                return (
                  <View key={label} style={[styles.priorityRow, isLast && styles.priorityRowLast]}>
                    <View style={styles.priorityLeft}>
                      <View style={[styles.priorityDot, { backgroundColor: color }]} />
                      <Text style={styles.priorityLabel}>{label}</Text>
                    </View>
                    <View style={styles.priorityBarTrack}>
                      <View style={[styles.priorityBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.priorityCount, { color }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default StatsScreen;
