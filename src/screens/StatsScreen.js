// ============================================================
// src/screens/StatsScreen.js
// ============================================================

// ── Demo mode (set true for screenshots/TikTok, false for production) ──
const DEMO_MODE = false;

import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, typography, getClassColor } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../hooks/useAuth";
import { saveUserProfile } from "../services/firebase";
import { differenceInCalendarDays, subDays, format } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────

const toDate = (val) => {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const GRADE_POINTS = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 };

const HEALTH_ORDER = { "At risk": 0, Behind: 1, Okay: 2, "On track": 3 };

const getHealthRating = (pct, overdueCount, total, isDark = true) => {
  // Only flag based on overdue tasks — never penalise new users for low completion
  if (overdueCount >= 2)
    return {
      label: "At risk",
      color: isDark ? "#FF5C5C" : "#DC2626",
      icon: "alert-triangle",
    };
  if (overdueCount >= 1)
    return {
      label: "Behind",
      color: isDark ? "#FFB347" : "#D97706",
      icon: "clock",
    };
  if (total === 0 || pct >= 80)
    return {
      label: "On track",
      color: isDark ? "#5CFF8F" : "#059669",
      icon: "check-circle",
    };
  return {
    label: "Okay",
    color: isDark ? "#5BC8FF" : "#0284C7",
    icon: "minus-circle",
  };
};

const getSemesterBounds = (label) => {
  if (!label) return null;
  const lower = label.toLowerCase();
  const yearMatch = label.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
  if (lower.includes("winter"))
    return { start: new Date(year, 0, 6), end: new Date(year, 2, 21) };
  if (lower.includes("spring"))
    return { start: new Date(year, 0, 13), end: new Date(year, 4, 9) };
  if (lower.includes("summer"))
    return { start: new Date(year, 4, 19), end: new Date(year, 7, 8) };
  if (lower.includes("fall"))
    return { start: new Date(year, 7, 25), end: new Date(year, 11, 12) };
  return null;
};

// ── Styles ────────────────────────────────────────────────────

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    // Header
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.isDark ? colors.border : "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          }),
    },
    headerTitle: { ...typography.h1, color: colors.textPrimary },
    headerSubtitle: {
      ...typography.bodySmall,
      color: colors.textMuted,
      marginTop: 2,
    },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.isDark ? colors.mediumGlow : "rgba(255, 165, 0, 0.08)",
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.medium,
      borderColor: colors.isDark ? colors.medium + "40" : "rgba(255, 165, 0, 0.3)",
    },

    streakText: { fontSize: 13, fontWeight: "700", color: colors.medium },
    streakLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: 48,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
      marginTop: spacing.xl,
    },
    sectionTitle: {
      ...typography.label,
      color: colors.isDark ? colors.textMuted : colors.accent,
    },
    sectionMeta: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },

    // ── Stat cards ──────────────────────────────────────────────
    statsRow: { flexDirection: "row", gap: spacing.sm },
    statCard: {
      flex: 1,
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,

      padding: spacing.md,
      paddingTop: spacing.lg,
      alignItems: "center",
      gap: 4,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      overflow: "visible",

      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#6B6B8A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }),
    },
    statAccentBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 4,
    },

    statIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    statValue: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },

    // ── Activity chart ──────────────────────────────────────────
    activityCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.lg,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#6B6B8A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }),
    },
    activityCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: spacing.md,
    },
    activityCardTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    activityCardCount: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    activityBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 5,
      height: 60,
      marginBottom: 4,
    },
    activityBarCol: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      height: 60,
    },
    activityCount: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accent,
      marginBottom: 2,
    },
    activityBar: { width: "100%", borderRadius: 4, minHeight: 4 },
    activityDayRow: { flexDirection: "row", gap: 5 },
    activityDayCell: { flex: 1, alignItems: "center" },
    activityDayText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textMuted,
    },

    // ── Semester countdown ───────────────────────────────────────
    semesterCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.lg,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#6B6B8A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }),
    },
    semesterTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    semesterIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.accentGlow,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    semesterDays: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    semesterLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: 1,
    },
    semesterMotivation: {
      fontSize: 12,
      color: colors.accent,
      fontWeight: "600",
      marginTop: 3,
    },
    semProgressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    semBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.isDark ? colors.border : "#EEEEEF",
      borderRadius: 3,
      overflow: "hidden",
    },
    semBarFill: { height: 6, borderRadius: 3 },
    semPctText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      width: 32,
      textAlign: "right",
    },

    // ── Due soon ────────────────────────────────────────────────
    dueSoonCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.lg,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      overflow: "hidden",
      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#6B6B8A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }),
    },
    dueSoonRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    dueSoonRowLast: { borderBottomWidth: 0 },
    dueSoonDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    dueSoonTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    dueSoonRight: { alignItems: "flex-end", gap: 2 },
    dueSoonClass: { fontSize: 11, color: colors.textMuted },
    dueSoonDue: { fontSize: 11, fontWeight: "700" },

    // ── Classes ─────────────────────────────────────────────────
    classesCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.lg,
      borderWidth: colors.cardBorderW,
      overflow: "visible",
      ...(colors.isDark
        ? {}
        : {
          shadowColor: "#6B6B8A",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 4,
        }),
    },
    classRow: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.isDark ? colors.border : "#F0F0F7",
    },
    classRowLast: { borderBottomWidth: 0 },
    classAccent: {
      width: 3,
      borderRadius: 2,
      marginRight: 10,
      alignSelf: "stretch",
    },
    classContent: { flex: 1 },
    classTopRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    className: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    classMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    healthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    healthBadgeText: { fontSize: 11, fontWeight: "700" },
    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    barTrack: {
      flex: 1,
      height: 5,
      backgroundColor: colors.isDark ? colors.border : "#EEEEEF",
      borderRadius: 3,
      overflow: "hidden",
    },
    barFill: { height: 5, borderRadius: 3 },
    barPct: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textMuted,
      width: 32,
      textAlign: "right",
    },

    // ── Priority ────────────────────────────────────────────────
    priorityCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      ...(colors.isDark
        ? {}
        : {
            shadowColor: "#6B6B8A",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.18,
            shadowRadius: 8,
            elevation: 4,
          }),
    },
    priorityRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    priorityRowLast: { marginBottom: 0 },
    priorityLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    priorityDot: { width: 10, height: 10, borderRadius: 5 },
    priorityLabel: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    priorityBarTrack: {
      flex: 2,
      height: 6,
      backgroundColor: colors.isDark ? colors.border : "#EEEEEF",
      borderRadius: 3,
      overflow: "hidden",
    },
    priorityBarFill: { height: 6, borderRadius: 3 },
    priorityCount: {
      fontSize: 13,
      fontWeight: "700",
      marginLeft: 8,
      width: 24,
      textAlign: "right",
    },

    // ── GPA ─────────────────────────────────────────────────────
    gpaCard: {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderRadius: radius.xl,
      borderWidth: 0,
      overflow: "visible",
    },
    gpaTopRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.isDark ? "transparent" : "#fff",
      // rounds top corners to match card
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
    },
    gpaPriorSection: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.isDark ? "transparent" : "#fff",
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    gpaBlock: { flex: 1, alignItems: "center" },
    gpaValue: {
      fontSize: 36,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    gpaLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: 3,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    gpaDividerV: {
      width: 1,
      height: 44,
      backgroundColor: colors.isDark ? colors.border : "#E4E4EE",
      marginHorizontal: spacing.sm,
    },
    gpaDividerH: {
      height: 1,
      backgroundColor: colors.isDark ? colors.border : "#F0F0F7",
    },
    gpaClassRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.isDark ? colors.border : "#F0F0F7",
      backgroundColor: colors.isDark ? "transparent" : "#fff",
      gap: 8,
    },
    gpaClassRowLast: { borderBottomWidth: 0 },
    gpaClassName: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    gpaClassMeta: {
      fontSize: 12,
      color: colors.textMuted,
      width: 28,
      textAlign: "right",
    },
    gpaGradeBadge: {
      width: 30,
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    gpaGradeText: { fontSize: 13, fontWeight: "800" },
    gpaClassPoints: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.isDark ? colors.textSecondary : "#9090A8",
      width: 28,
      textAlign: "right",
    },
    gpaPriorSection: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.isDark ? "transparent" : "#F7F7FB",
      // rounds bottom corners to match card
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    gpaCardShadow: {
      borderRadius: radius.xl,
      backgroundColor: colors.bgCard,
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 5,
      }),
    },
    
    gpaPriorTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.isDark ? colors.textMuted : "#A0A0B8",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    gpaPriorRow: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-end",
    },
    gpaPriorField: { flex: 1 },
    gpaPriorFieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.isDark ? colors.textMuted : "#A0A0B8",
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    gpaPriorInput: {
      backgroundColor: colors.isDark ? colors.bg : "#FFFFFF",
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.cardBorder : "#E4E4EE",
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    gpaPriorHint: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    gpaPriorCalcBtn: {
      alignSelf: "flex-end",
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 0,
      ...(colors.isDark
        ? {}
        : {
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
          }),
    },
    gpaPriorCalcBtnDisabled: {
      backgroundColor: colors.isDark ? colors.border : "#E8E8F0",
      shadowOpacity: 0,
    },
    gpaPriorCalcText: { fontSize: 13, fontWeight: "700", color: "#fff" },

    // Empty state
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 80,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.bgCard,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
    },
  });

// ── Screen ────────────────────────────────────────────────────

const StatsScreen = () => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const realTasks = useTasks();
  const { profile: realProfile } = useUserProfile();
  const { user } = useAuth();

  // ── Demo data ────────────────────────────────────────────────
  const DEMO_COMPLETED = [
    {
      id: "c1",
      title: "Calc problem set",
      className: "MATH 240",
      completed: true,
      completedAt: subDays(new Date(), 0),
    },
    {
      id: "c2",
      title: "History reading",
      className: "HIST 110",
      completed: true,
      completedAt: subDays(new Date(), 0),
    },
    {
      id: "c3",
      title: "Chem lab report",
      className: "CHEM 201",
      completed: true,
      completedAt: subDays(new Date(), 1),
    },
    {
      id: "c4",
      title: "Spanish essay",
      className: "SPAN 102",
      completed: true,
      completedAt: subDays(new Date(), 1),
    },
    {
      id: "c5",
      title: "Econ quiz prep",
      className: "ECON 101",
      completed: true,
      completedAt: subDays(new Date(), 2),
    },
    {
      id: "c6",
      title: "Psych reading",
      className: "PSYC 101",
      completed: true,
      completedAt: subDays(new Date(), 3),
    },
    {
      id: "c7",
      title: "Bus project",
      className: "BUS 210",
      completed: true,
      completedAt: subDays(new Date(), 4),
    },
    {
      id: "c8",
      title: "Calc exam review",
      className: "MATH 240",
      completed: true,
      completedAt: subDays(new Date(), 5),
    },
    {
      id: "c9",
      title: "Chem prelab",
      className: "CHEM 201",
      completed: true,
      completedAt: subDays(new Date(), 6),
    },
  ];
  const DEMO_PENDING = [
    {
      id: "p1",
      title: "Orgo midterm study",
      className: "CHEM 201",
      completed: false,
      dueDate: new Date(Date.now() + 1 * 86400000),
    },
    {
      id: "p2",
      title: "Civil War essay",
      className: "HIST 110",
      completed: false,
      dueDate: new Date(Date.now() + 2 * 86400000),
    },
    {
      id: "p3",
      title: "Linear algebra PS",
      className: "MATH 240",
      completed: false,
      dueDate: new Date(Date.now() + 3 * 86400000),
    },
    {
      id: "p4",
      title: "PSYC chapters 7-9",
      className: "PSYC 101",
      completed: false,
      dueDate: new Date(Date.now() + 4 * 86400000),
    },
  ];

  const tasks = DEMO_MODE
    ? [...DEMO_COMPLETED, ...DEMO_PENDING]
    : realTasks.tasks;
  const completedTasks = DEMO_MODE ? DEMO_COMPLETED : realTasks.completedTasks;
  const streak = DEMO_MODE ? 7 : realTasks.streak;
  const profile = DEMO_MODE
    ? { name: "Alex Johnson", semester: "Spring 2025" }
    : realProfile;
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  // ── GPA state ────────────────────────────────────────────────
  // Only initialise with real numeric values — never write "null" into the input
  const [priorGpaInput, setPriorGpaInput] = useState(
    realProfile?.priorGpa != null ? String(realProfile.priorGpa) : ""
  );
  const [priorCreditsInput, setPriorCreditsInput] = useState(
    realProfile?.priorCredits != null ? String(realProfile.priorCredits) : ""
  );

  // Sync inputs when profile loads, but skip null/undefined so we don't overwrite empty strings
  React.useEffect(() => {
    if (realProfile?.priorGpa != null)
      setPriorGpaInput(String(realProfile.priorGpa));
    if (realProfile?.priorCredits != null)
      setPriorCreditsInput(String(realProfile.priorCredits));
  }, [realProfile?.priorGpa, realProfile?.priorCredits]);

  const savePrior = useCallback(() => {
    if (!user) return;
    const gpa = parseFloat(priorGpaInput);
    const credits = parseFloat(priorCreditsInput);
    // Only save if both are valid numbers
    if (isNaN(gpa) || isNaN(credits)) return;
    saveUserProfile(user.uid, {
      priorGpa: Math.min(4.0, Math.max(0, gpa)),
      priorCredits: Math.max(0, credits),
    }).catch(() => {});
  }, [user, priorGpaInput, priorCreditsInput]);

  // Classes with a real grade this term
  const gpaClasses = useMemo(
    () =>
      (profile?.classes ?? []).filter(
        (c) => GRADE_POINTS[c.grade] !== undefined
      ),
    [profile?.classes]
  );

  const termGpa = useMemo(() => {
    if (!gpaClasses.length) return null;
    const points = gpaClasses.reduce(
      (s, c) => s + GRADE_POINTS[c.grade] * (parseInt(c.creditHours) || 3),
      0
    );
    const credits = gpaClasses.reduce(
      (s, c) => s + (parseInt(c.creditHours) || 3),
      0
    );
    return credits > 0 ? (points / credits).toFixed(2) : null;
  }, [gpaClasses]);

  const cumGpa = useMemo(() => {
    if (!termGpa) return null;
    const priorGpa = parseFloat(realProfile?.priorGpa);
    const priorCredits = parseFloat(realProfile?.priorCredits);
    if (!priorGpa || !priorCredits || priorCredits === 0) return termGpa;
    const termCredits = gpaClasses.reduce(
      (s, c) => s + (parseInt(c.creditHours) || 3),
      0
    );
    const termPoints = gpaClasses.reduce(
      (s, c) => s + GRADE_POINTS[c.grade] * (parseInt(c.creditHours) || 3),
      0
    );
    const total = priorGpa * priorCredits + termPoints;
    return (total / (priorCredits + termCredits)).toFixed(2);
  }, [termGpa, gpaClasses, realProfile?.priorGpa, realProfile?.priorCredits]);

  const gradeColor = (grade) => {
    switch (grade) {
      case "A":
        return colors.low;
      case "B":
        return colors.accent;
      case "C":
        return colors.medium;
      case "D":
      case "F":
        return colors.high;
      default:
        return colors.textMuted;
    }
  };

  const totalCompleted = completedTasks.length;
  const totalPending = tasks.filter((t) => !t.completed).length;
  const totalOverdue = tasks.filter(
    (t) => !t.completed && t.dueDate && (toDate(t.dueDate) ?? 0) < today
  ).length;
  const completionRate = useMemo(() => {
    const total = totalCompleted + totalPending;
    return total > 0 ? Math.round((totalCompleted / total) * 100) : 0;
  }, [totalCompleted, totalPending]);

  // 7-day activity
  const activityDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const day = subDays(today, 6 - i);
        const dayStr = format(day, "yyyy-MM-dd");
        const count = completedTasks.filter((t) => {
          const d = toDate(t.completedAt);
          return d && format(d, "yyyy-MM-dd") === dayStr;
        }).length;
        return { label: format(day, "EEEEE"), count, isToday: i === 6 };
      }),
    [completedTasks]
  );
  const activityMax = Math.max(...activityDays.map((d) => d.count), 1);
  const weekTotal = activityDays.reduce((s, d) => s + d.count, 0);

  // Semester
  const semBounds = getSemesterBounds(profile?.semester);
  const daysLeft = semBounds
    ? differenceInCalendarDays(semBounds.end, today)
    : null;
  const semPct = useMemo(() => {
    if (!semBounds) return 0;
    const total = differenceInCalendarDays(semBounds.end, semBounds.start);
    const elapsed = differenceInCalendarDays(today, semBounds.start);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [semBounds]);

  // Classes sorted by health (worst first)
  const byClass = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = t.className ?? "No class";
      if (!map[key]) map[key] = { total: 0, done: 0, overdue: 0 };
      map[key].total++;
      if (t.completed) map[key].done++;
      else if (t.dueDate && (toDate(t.dueDate) ?? 0) < todayStart)
        map[key].overdue++;
    });
    return Object.entries(map)
      .map(([name, { total, done, overdue }]) => {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const health = getHealthRating(pct, overdue, total, isDark);
        return { name, total, done, overdue, pct, health };
      })
      .sort((a, b) => {
        const ho =
          (HEALTH_ORDER[a.health.label] ?? 4) -
          (HEALTH_ORDER[b.health.label] ?? 4);
        return ho !== 0 ? ho : b.total - a.total;
      })
      .slice(0, 8);
  }, [tasks]);
  const onTrackCount = byClass.filter(
    (c) => c.health.label === "On track" || c.health.label === "Okay"
  ).length;

  // Tasks due in next 3 days
  const upcoming = useMemo(() => {
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);
    return tasks
      .filter((t) => {
        const d = toDate(t.dueDate);
        return !t.completed && d && d >= today && d <= in3;
      })
      .sort((a, b) => (toDate(a.dueDate) ?? 0) - (toDate(b.dueDate) ?? 0))
      .slice(0, 5);
  }, [tasks]);

  // Priority breakdown (only non-zero)
  const priorityBreakdown = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const high = pending.filter(
      (t) => (t.aiPriority ?? t.priority) === "HIGH"
    ).length;
    const medium = pending.filter(
      (t) => (t.aiPriority ?? t.priority) === "MEDIUM"
    ).length;
    const low = pending.filter(
      (t) => (t.aiPriority ?? t.priority) === "LOW"
    ).length;
    const total = high + medium + low || 1;
    return [
      {
        label: "High",
        count: high,
        color: colors.high,
        pct: (high / total) * 100,
      },
      {
        label: "Medium",
        count: medium,
        color: colors.medium,
        pct: (medium / total) * 100,
      },
      { label: "Low", count: low, color: colors.low, pct: (low / total) * 100 },
    ].filter((p) => p.count > 0);
  }, [tasks]);

  // ── Empty state ──────────────────────────────────────────────
  if (tasks.length === 0 && completedTasks.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Progress</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather
              name="bar-chart-2"
              size={28}
              color={colors.isDark ? colors.textMuted : "#D8D8E0 "}
            />
          </View>
          <Text style={styles.emptyTitle}>Nothing to show yet</Text>
          <Text style={styles.emptyText}>
            {"Add tasks and complete them\nto track your progress here."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Progress</Text>
          <Text style={styles.headerSubtitle}>How your term is going</Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakPill}>
            <Text>🔥</Text>
            <View>
              <Text style={styles.streakText}>
                {streak} day{streak !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Overview ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>OVERVIEW</Text>
        </View>
        <View style={styles.statsRow}>
          {/* Completed */}
          <View style={styles.statCard}>
            <View
              style={[styles.statAccentBar, { backgroundColor: colors.low }]}
            />
            <View
              style={[styles.statIconWrap, { backgroundColor: colors.lowGlow }]}
            >
              <Feather name="check-circle" size={16} color={colors.low} />
            </View>
            <Text style={[styles.statValue, { color: colors.low }]}>
              {totalCompleted}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          {/* Overdue */}
          <View style={styles.statCard}>
            <View
              style={[
                styles.statAccentBar,
                {
                  backgroundColor:
                    totalOverdue > 0 ? colors.high : colors.border,
                },
              ]}
            />
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor:
                    totalOverdue > 0 ? colors.highGlow : colors.border + "30",
                },
              ]}
            >
              <Feather
                name="alert-circle"
                size={16}
                color={totalOverdue > 0 ? colors.high : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.statValue,
                { color: totalOverdue > 0 ? colors.high : colors.textPrimary },
              ]}
            >
              {totalOverdue}
            </Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
          {/* Completion rate */}
          <View style={styles.statCard}>
            <View
              style={[styles.statAccentBar, { backgroundColor: colors.accent }]}
            />
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: colors.accentGlow },
              ]}
            >
              <Feather name="trending-up" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              {completionRate}%
            </Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>

        {/* ── 7-day activity ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>LAST 7 DAYS</Text>
        </View>
        <View style={styles.activityCard}>
          <View style={styles.activityCardTop}>
            <Text style={styles.activityCardTitle}>Daily completions</Text>
            <Text style={styles.activityCardCount}>{weekTotal} this week</Text>
          </View>
          <View style={styles.activityBars}>
            {activityDays.map((d, i) => (
              <View key={i} style={styles.activityBarCol}>
                {d.count > 0 && (
                  <Text
                    style={[
                      styles.activityCount,
                      !d.isToday && { color: colors.textMuted },
                    ]}
                  >
                    {d.count}
                  </Text>
                )}
                <View
                  style={[
                    styles.activityBar,
                    {
                      height: Math.max(
                        4,
                        Math.round((d.count / activityMax) * 48)
                      ),
                      backgroundColor: d.isToday
                        ? colors.accent
                        : d.count > 0
                        ? colors.accent + "55"
                        : colors.isDark
                        ? colors.border
                        : "#EEEEEF",
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.activityDayRow}>
            {activityDays.map((d, i) => (
              <View key={i} style={styles.activityDayCell}>
                <Text
                  style={[
                    styles.activityDayText,
                    d.isToday && { color: colors.accent, fontWeight: "800" },
                  ]}
                >
                  {d.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Semester ── */}
        {daysLeft !== null && daysLeft > 0 && daysLeft < 120 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TERM</Text>
              <Text style={styles.sectionMeta}>{semPct}% through</Text>
            </View>
            <View style={styles.semesterCard}>
              <View style={styles.semesterTop}>
                <View style={styles.semesterIconWrap}>
                  <Feather name="calendar" size={20} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.semesterDays}>{daysLeft}</Text>
                  <Text style={styles.semesterLabel}>
                    days left in {profile?.semester ?? "this term"}
                  </Text>
                  <Text style={styles.semesterMotivation}>
                    {daysLeft <= 14
                      ? "Finals season — prioritize ruthlessly."
                      : daysLeft <= 30
                      ? "Final stretch. Stay consistent."
                      : "Plenty of time. Build momentum now."}
                  </Text>
                </View>
              </View>
              <View style={styles.semProgressRow}>
                <View style={styles.semBarTrack}>
                  <View
                    style={[
                      styles.semBarFill,
                      { width: `${semPct}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={styles.semPctText}>{semPct}%</Text>
              </View>
            </View>
          </>
        )}

        {/* ── GPA ── */}
        {gpaClasses.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>GPA</Text>
            </View>
            <View style={styles.gpaCardShadow}>
            <View style={styles.gpaCard}>
              {/* Term vs Cumulative */}
              <View style={styles.gpaTopRow}>
                <View style={styles.gpaBlock}>
                  <Text style={styles.gpaValue}>{termGpa ?? "—"}</Text>
                  <Text style={styles.gpaLabel}>This term</Text>
                </View>
                <View style={styles.gpaDividerV} />
                <View style={styles.gpaBlock}>
                  <Text style={[styles.gpaValue, { color: colors.accent }]}>
                    {cumGpa ?? "—"}
                  </Text>
                  <Text style={styles.gpaLabel}>Cumulative</Text>
                </View>
              </View>
              </View>

              {/* Per-class breakdown */}
              <View style={styles.gpaDividerH} />
              {gpaClasses.map((cls, i) => (
                <View
                  key={cls.id ?? i}
                  style={[
                    styles.gpaClassRow,
                    i === gpaClasses.length - 1 && styles.gpaClassRowLast,
                  ]}
                >
                  <Text style={styles.gpaClassName} numberOfLines={1}>
                    {cls.name}
                  </Text>
                  <Text style={styles.gpaClassMeta}>{cls.creditHours}cr</Text>
                  <View
                    style={[
                      styles.gpaGradeBadge,
                      {
                        backgroundColor: gradeColor(cls.grade) + "22",
                        borderColor: gradeColor(cls.grade) + "66",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gpaGradeText,
                        { color: gradeColor(cls.grade) },
                      ]}
                    >
                      {cls.grade}
                    </Text>
                  </View>
                  <Text style={styles.gpaClassPoints}>
                    {GRADE_POINTS[cls.grade].toFixed(1)}
                  </Text>
                </View>
              ))}

              {/* Prior record inputs */}
              <View style={styles.gpaDividerH} />
              <View style={styles.gpaPriorSection}>
                <Text style={styles.gpaPriorTitle}>Prior record</Text>
                <View style={styles.gpaPriorRow}>
                  <View style={styles.gpaPriorField}>
                    <Text style={styles.gpaPriorFieldLabel}>
                      Cumulative GPA
                    </Text>
                    <TextInput
                      style={styles.gpaPriorInput}
                      value={priorGpaInput}
                      onChangeText={setPriorGpaInput}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 3.50"
                      placeholderTextColor={colors.textMuted}
                      maxLength={4}
                    />
                  </View>
                  <View style={styles.gpaPriorField}>
                    <Text style={styles.gpaPriorFieldLabel}>
                      Credits earned
                    </Text>
                    <TextInput
                      style={styles.gpaPriorInput}
                      value={priorCreditsInput}
                      onChangeText={setPriorCreditsInput}
                      keyboardType="number-pad"
                      placeholder="e.g. 45"
                      placeholderTextColor={colors.textMuted}
                      maxLength={4}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.gpaPriorCalcBtn,
                      (!priorGpaInput.trim() || !priorCreditsInput.trim()) &&
                        styles.gpaPriorCalcBtnDisabled,
                    ]}
                    onPress={savePrior}
                    disabled={
                      !priorGpaInput.trim() || !priorCreditsInput.trim()
                    }
                  >
                    <Text style={styles.gpaPriorCalcText}>Calculate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Due soon ── */}
        {upcoming.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>DUE SOON</Text>
              <Text style={styles.sectionMeta}>Next 3 days</Text>
            </View>
            <View style={styles.dueSoonCard}>
              {upcoming.map((t, idx) => {
                const isLast = idx === upcoming.length - 1;
                const dueDate = toDate(t.dueDate);
                const daysAway = dueDate
                  ? differenceInCalendarDays(dueDate, today)
                  : 0;
                const dueLabel =
                  daysAway === 0
                    ? "Today"
                    : daysAway === 1
                    ? "Tomorrow"
                    : format(dueDate, "EEE, MMM d");
                const dueColor =
                  daysAway === 0
                    ? colors.high
                    : daysAway === 1
                    ? colors.medium
                    : colors.textMuted;
                const dotColor = getClassColor(t.className ?? "");
                return (
                  <View
                    key={t.id ?? idx}
                    style={[styles.dueSoonRow, isLast && styles.dueSoonRowLast]}
                  >
                    <View
                      style={[styles.dueSoonDot, { backgroundColor: dotColor }]}
                    />
                    <Text style={styles.dueSoonTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <View style={styles.dueSoonRight}>
                      {t.className ? (
                        <Text style={styles.dueSoonClass} numberOfLines={1}>
                          {t.className}
                        </Text>
                      ) : null}
                      <Text style={[styles.dueSoonDue, { color: dueColor }]}>
                        {dueLabel}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Classes ── */}
        {byClass.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>CLASSES</Text>
              <Text style={styles.sectionMeta}>
                {onTrackCount}/{byClass.length} on track
              </Text>
            </View>
            <View style={styles.classesCard}>
              {byClass.map(
                ({ name, pct, overdue, total, done, health }, idx) => {
                  const isLast = idx === byClass.length - 1;
                  const accentColor = getClassColor(name);
                  return (
                    <View
                      key={name}
                      style={[styles.classRow, isLast && styles.classRowLast]}
                    >
                      <View
                        style={[
                          styles.classAccent,
                          { backgroundColor: accentColor },
                        ]}
                      />
                      <View style={styles.classContent}>
                        <View style={styles.classTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.className} numberOfLines={1}>
                              {name}
                            </Text>
                            <Text style={styles.classMeta}>
                              {done}/{total} done
                              {overdue > 0 ? ` · ${overdue} overdue` : ""}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.healthBadge,
                              {
                                borderColor: health.color + "66",
                                backgroundColor: health.color + "18",
                              },
                            ]}
                          >
                            <Feather
                              name={health.icon}
                              size={11}
                              color={health.color}
                            />
                            <Text
                              style={[
                                styles.healthBadgeText,
                                { color: health.color },
                              ]}
                            >
                              {health.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.barRow}>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${pct}%`,
                                  backgroundColor: accentColor,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.barPct}>{pct}%</Text>
                        </View>
                      </View>
                    </View>
                  );
                }
              )}
            </View>
          </>
        )}

        {/* ── Priority breakdown ── */}
        {priorityBreakdown.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>PENDING BY PRIORITY</Text>
              <Text style={styles.sectionMeta}>{totalPending} tasks</Text>
            </View>
            <View style={styles.priorityCard}>
              {priorityBreakdown.map(({ label, count, color, pct }, idx) => {
                const isLast = idx === priorityBreakdown.length - 1;
                return (
                  <View
                    key={label}
                    style={[
                      styles.priorityRow,
                      isLast && styles.priorityRowLast,
                    ]}
                  >
                    <View style={styles.priorityLeft}>
                      <View
                        style={[styles.priorityDot, { backgroundColor: color }]}
                      />
                      <Text style={styles.priorityLabel}>{label}</Text>
                    </View>
                    <View style={styles.priorityBarTrack}>
                      <View
                        style={[
                          styles.priorityBarFill,
                          { width: `${pct}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.priorityCount, { color }]}>
                      {count}
                    </Text>
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
