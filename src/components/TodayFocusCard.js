// ============================================================
// src/components/TodayFocusCard.js
//
// Auto-loads on dashboard mount. No button press needed.
// Shows 2-3 tasks to focus on today + a coaching line.
// Cached 30 min in openai.js so it won't re-fire on every render.
// Fails silently — if the API is down, the card just doesn't show.
//
// Fix: strips [ID:xxx] artifacts that the AI occasionally echoes
// back from the prompt format used for hallucination prevention.
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, TouchableOpacity, Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, priorityColors } from "../utils/theme";
const ACE_LOGO = require("../assets/logo.png");
import { useTheme } from "../utils/ThemeContext";
import { getTodayFocus, invalidateTodayFocusCache } from "../services/openai";
import { isToday, isTomorrow, differenceInCalendarDays } from "date-fns";

const formatDueDate = (dueDate, dueTime) => {
  if (!dueDate) return null;
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (isNaN(d)) return null;

  const now = new Date();
  const daysOut = differenceInCalendarDays(d, now);

  if (Array.isArray(dueTime) && dueTime.length === 2) {
    const [h, m] = dueTime;
    const suffix  = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    const mins    = String(m).padStart(2, "0");
    const timeStr = `${display}:${mins} ${suffix}`;

    // Build exact datetime to check if time has passed
    const exact = new Date(d);
    exact.setHours(h, m, 0, 0);
    if (exact < now) return `Overdue · ${timeStr}`;

    if (isToday(d))         return `Today ${timeStr}`;
    if (isTomorrow(d))      return `Tomorrow ${timeStr}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${timeStr}`;
  }

  if (daysOut < 0)   return `${Math.abs(daysOut)}d overdue`;
  if (isToday(d))    return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const cleanText = (str) => {
  if (!str) return str;
  return str
    .replace(/\[ID:[^\]]*\]/gi, "")
    .replace(/\[id:[^\]]*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Individual task row — animates in with stagger
const FocusTaskRow = ({ task, idx, isLast, onPress, styles, colors, PRIORITY_COLORS }) => {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const rowScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(180 + idx * 70),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, speed: 28, bounciness: 0, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const onRowIn  = () => { if (onPress) Animated.spring(rowScale, { toValue: 0.98, useNativeDriver: true, speed: 80, bounciness: 0 }).start(); };
  const onRowOut = () => { if (onPress) Animated.spring(rowScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start(); };

  const priority  = task.aiPriority ?? task.priority;
  const chipColor = PRIORITY_COLORS[priority];
  const title     = cleanText(task.title) || task.title;
  const dueLabel  = task.dueDate ? formatDueDate(task.dueDate, task.dueTime) : null;
  const isOverdue = dueLabel?.includes("overdue") || dueLabel?.includes("Overdue");

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale: rowScale }] }}>
      <TouchableOpacity
        style={[
          styles.taskRow,
          isLast && styles.taskRowLast,
          isOverdue && styles.taskRowOverdue,
        ]}
        onPress={() => onPress?.(task.id)}
        onPressIn={onRowIn}
        onPressOut={onRowOut}
        activeOpacity={1}
      >
        <View style={[styles.taskDot, isOverdue ? styles.taskDotOverdue : chipColor && { backgroundColor: chipColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, isOverdue && styles.taskTitleOverdue]} numberOfLines={2}>{title}</Text>
          {(task.className || task.dueDate) ? (
            <View style={styles.taskMeta}>
              {task.className ? <Text style={styles.taskClass}>{task.className}</Text> : null}
              {task.className && task.dueDate ? <Text style={styles.taskDot2}>·</Text> : null}
              {dueLabel ? <Text style={isOverdue ? styles.taskDueOverdue : styles.taskDue}>{dueLabel}</Text> : null}
            </View>
          ) : null}
        </View>
        {isOverdue ? (
          <View style={styles.overdueChip}>
            <Text style={styles.overdueChipText}>Overdue</Text>
          </View>
        ) : chipColor ? (
          <View style={[styles.taskChip, { borderColor: chipColor + "66", backgroundColor: chipColor + "18" }]}>
            <Text style={[styles.taskChipText, { color: chipColor }]}>{priority}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF", borderRadius: radius.lg,
    borderWidth: colors.cardBorderW, borderColor: colors.cardBorder,
    borderLeftWidth: 5, borderLeftColor: colors.accent,
    overflow: "visible",
    ...(colors.isDark
      ? {}
      : {
          shadowColor: "#6B6B8A",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 8,
  },
  aceLogo: { width: 52, height: 52, flexShrink: 0 },
  headerLabel: {
    fontSize: 14, fontFamily: "Outfit-ExtraBold", color: colors.accent,
    letterSpacing: 0.2, flex: 1,
  },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
  },
  taskRowLast: { borderBottomWidth: 0 },
  taskRowOverdue: {
    backgroundColor: colors.isDark ? "rgba(255,60,60,0.08)" : "rgba(220,38,38,0.05)",
  },
  taskDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  taskDotOverdue: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.isDark ? "#FF5C5C" : "#DC2626" },
  taskTitle:        { flex: 1, fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, lineHeight: 19 },
  taskTitleOverdue: { flex: 1, fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.isDark ? "#FF8080" : "#DC2626", lineHeight: 19 },
  overdueChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: colors.isDark ? "rgba(255,60,60,0.20)" : "rgba(220,38,38,0.10)",
    borderWidth: 1, borderColor: colors.isDark ? "#FF5C5C55" : "#DC262655",
  },
  overdueChipText: { fontSize: 10, fontFamily: "Outfit-Bold", color: colors.isDark ? "#FF6B6B" : "#DC2626" },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  taskClass: { fontSize: 11, color: colors.textMuted },
  taskDot2: { fontSize: 11, color: colors.textMuted },
  taskDue: { fontSize: 11, color: colors.textMuted },
  taskDueOverdue: { fontSize: 11, color: colors.isDark ? "#FF5C5C" : "#DC2626", fontFamily: "Outfit-SemiBold" },
  taskChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full,
    borderWidth: 1,
  },
  taskChipText: { fontSize: 10, fontFamily: "Outfit-Bold" },
  shimmer: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  shimmerText: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  errorText: { fontSize: 13, color: colors.textMuted, flex: 1 },
  retryText: { fontSize: 13, color: colors.accent, fontFamily: "Outfit-SemiBold" },
  insightRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: spacing.md, paddingVertical: 9,
    borderTopWidth: 1, borderTopColor: colors.isDark ? colors.border : "#F0F0F5",
  },
  insightText: { fontSize: 13, fontFamily: "Outfit-Medium", color: colors.textSecondary, flex: 1, lineHeight: 18 },
  sessionsRow: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.isDark ? colors.border : "#F0F0F5",
  },
  sessionsText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.accent, flex: 1 },
});

const TodayFocusCard = ({ tasks, userProfile, patterns, onTaskHighlight, navigation, isPro, todaySessions = [] }) => {
  const { colors } = useTheme();
  const PRIORITY_COLORS = priorityColors(colors.isDark);
  const styles = makeStyles(colors);

  const [focus, setFocus]        = useState(null);
  const [loading, setLoading]    = useState(false);
  const [failed, setFailed]      = useState(false);
  const [limitReached, setLimit] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(10)).current;
  const inFlight   = useRef(false);

  const load = () => {
    if (inFlight.current) return;
    const pending = tasks.filter((t) => !t.completed);
    if (pending.length === 0) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    getTodayFocus(tasks, userProfile, patterns)
      .then((data) => {
        if (data?.limitReached) {
          setLimit(true);
        } else if (data) {
          setFocus(data);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
          ]).start();
        } else {
          setFailed(true);
        }
      })
      .finally(() => { inFlight.current = false; setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const retry = () => {
    invalidateTodayFocusCache();
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    setFocus(null);
    setLimit(false);
    load();
  };

  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const pending = tasks.filter((t) => !t.completed);
  let focusTasks = focus?.taskIds
    ? focus.taskIds
        .map((id) => tasks.find((t) => t.id === id && !t.completed))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (focusTasks.length === 0 && pending.length > 0) {
    focusTasks = [...pending]
      .sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aDate !== bDate) return aDate - bDate;
        return (PRIORITY_RANK[a.aiPriority ?? a.priority] ?? 1) - (PRIORITY_RANK[b.aiPriority ?? b.priority] ?? 1);
      })
      .slice(0, 3);
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.shimmer}>
          <ActivityIndicator size={14} color={colors.accent} />
          <Text style={styles.shimmerText}>Ace is reading your week...</Text>
        </View>
      </View>
    );
  }

  if (limitReached) {
    return (
      <View style={styles.card}>
        <View style={styles.errorRow}>
          <Feather name="zap-off" size={14} color={colors.textMuted} />
          <Text style={styles.errorText}>Daily AI limit reached — resets tomorrow</Text>
        </View>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.card}>
        <View style={styles.errorRow}>
          <Feather name="wifi-off" size={14} color={colors.textMuted} />
          <Text style={styles.errorText}>Couldn't load today's focus</Text>
          <TouchableOpacity onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!focus || focusTasks.length === 0) return null;

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <Image source={ACE_LOGO} style={styles.aceLogo} resizeMode="contain" />
        <Text style={styles.headerLabel}>Ace's picks</Text>
        <TouchableOpacity onPress={retry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="refresh-cw" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {focusTasks.map((task, idx) => (
        <FocusTaskRow
          key={task.id}
          task={task}
          idx={idx}
          isLast={idx === focusTasks.length - 1 && !focus?.insight && todaySessions.length === 0}
          onPress={onTaskHighlight}
          styles={styles}
          colors={colors}
          PRIORITY_COLORS={PRIORITY_COLORS}
        />
      ))}

      {focus?.insight ? (
        <View style={styles.insightRow}>
          <Feather name="zap" size={12} color={colors.accent} />
          <Text style={styles.insightText}>{cleanText(focus.insight)}</Text>
        </View>
      ) : null}

      {todaySessions.length > 0 && (
        <TouchableOpacity style={styles.sessionsRow} onPress={() => navigation?.navigate("StudyPlan")} activeOpacity={0.7}>
          <Feather name="book-open" size={13} color={colors.accent} />
          <Text style={styles.sessionsText}>
            {(() => {
              const totalMins = todaySessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
              const timeStr = totalMins >= 60
                ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? ` ${totalMins % 60}min` : ""}`
                : `${totalMins}min`;
              return `${todaySessions.length} study session${todaySessions.length !== 1 ? "s" : ""} · ${timeStr} today`;
            })()}
          </Text>
          <Feather name="chevron-right" size={13} color={colors.accent} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

export default TodayFocusCard;
