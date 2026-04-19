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
  View, Text, StyleSheet, ActivityIndicator, Animated, TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, priorityColors } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { getTodayFocus, invalidateTodayFocusCache } from "../services/openai";
import { isToday, isTomorrow, differenceInCalendarDays } from "date-fns";

const formatDueDate = (dueDate, dueTime) => {
  if (!dueDate) return null;
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (isNaN(d)) return null;

  const daysOut = differenceInCalendarDays(d, new Date());
  let datePart;
  if (isToday(d))         datePart = "Today";
  else if (isTomorrow(d)) datePart = "Tomorrow";
  else if (daysOut < 0)   return `${Math.abs(daysOut)}d overdue`;
  else                    datePart = `${d.getMonth() + 1}/${d.getDate()}`;

  if (Array.isArray(dueTime) && dueTime.length === 2) {
    const [h, m] = dueTime;
    const suffix  = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    const mins    = String(m).padStart(2, "0");
    return `${datePart} ${display}:${mins} ${suffix}`;
  }
  return datePart;
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

  useEffect(() => {
    Animated.sequence([
      Animated.delay(180 + idx * 70),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, speed: 28, bounciness: 0, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const priority  = task.aiPriority ?? task.priority;
  const chipColor = PRIORITY_COLORS[priority];
  const title     = cleanText(task.title) || task.title;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.taskRow, isLast && styles.taskRowLast]}
        onPress={() => onPress?.(task.id)}
        activeOpacity={onPress ? 0.6 : 1}
      >
        <View style={[styles.taskDot, chipColor && { backgroundColor: chipColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle} numberOfLines={2}>{title}</Text>
          {(task.className || task.dueDate) ? (
            <View style={styles.taskMeta}>
              {task.className ? <Text style={styles.taskClass}>{task.className}</Text> : null}
              {task.className && task.dueDate ? <Text style={styles.taskDot2}>·</Text> : null}
              {task.dueDate ? (() => {
                const label    = formatDueDate(task.dueDate, task.dueTime);
                const isOverdue = label?.includes("overdue");
                return <Text style={isOverdue ? styles.taskDueOverdue : styles.taskDue}>{label}</Text>;
              })() : null}
            </View>
          ) : null}
        </View>
        {chipColor ? (
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
    borderColor: colors.isDark ? colors.border : "transparent",
    borderWidth: colors.cardBorderW, borderColor: colors.cardBorder,
    borderLeftWidth: 5, borderLeftColor: colors.accent,
    marginBottom: spacing.md, overflow: "visible",
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
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 6,
  },
  headerLabel: {
    fontSize: 10, fontFamily: "Outfit-ExtraBold", color: colors.accent,
    textTransform: "uppercase", letterSpacing: 1, flex: 1,
  },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
  },
  taskRowLast: { borderBottomWidth: 0 },
  taskDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  taskTitle: { flex: 1, fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, lineHeight: 19 },
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
});

const TodayFocusCard = ({ tasks, userProfile, patterns, onTaskHighlight }) => {
  const { colors } = useTheme();
  const PRIORITY_COLORS = priorityColors(colors.isDark);
  const styles = makeStyles(colors);

  const [focus, setFocus]        = useState(null);
  const [loading, setLoading]    = useState(false);
  const [failed, setFailed]      = useState(false);
  const [limitReached, setLimit] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  const load = () => {
    const pending = tasks.filter((t) => !t.completed);
    if (pending.length === 0) return;
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
      .finally(() => setLoading(false));
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
          <Text style={styles.shimmerText}>Finding your focus for today...</Text>
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
        <Feather name="zap" size={13} color={colors.accent} />
        <Text style={styles.headerLabel}>Focus today</Text>
        <TouchableOpacity onPress={retry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="refresh-cw" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {focusTasks.map((task, idx) => (
        <FocusTaskRow
          key={task.id}
          task={task}
          idx={idx}
          isLast={idx === focusTasks.length - 1}
          onPress={onTaskHighlight}
          styles={styles}
          colors={colors}
          PRIORITY_COLORS={PRIORITY_COLORS}
        />
      ))}
    </Animated.View>
  );
};

export default TodayFocusCard;
