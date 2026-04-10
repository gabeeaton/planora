// ============================================================
// src/components/TaskCard.js
// Updated with recurring task badge
// ============================================================

import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, spacing, radius, priorityColors, priorityGlow } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { format } from "date-fns";
import ClassTag from "./ClassTag";
import { getRecurrenceLabel } from "../services/recurringTasks";


const makeStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: spacing.md,
    marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.border,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  cardCompleted:   { opacity: 0.5 },
  cardHighlighted: { borderColor: colors.accent, borderWidth: 1.5 },
  glowOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14,
  },
  completionFlash: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(92,255,143,0.2)", borderRadius: 14, pointerEvents: "none",
  },
  highlightOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(108,99,255,0.06)", borderRadius: 14,
  },
  row:      { flexDirection: "row", alignItems: "flex-start" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.border, marginRight: spacing.sm, marginTop: 2,
    alignItems: "center", justifyContent: "center",
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  content:      { flex: 1 },
  titleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  title:          { ...typography.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  titleCompleted: { textDecorationLine: "line-through", color: colors.textMuted },
  badge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  badgeText:   { ...typography.label, color: colors.textMuted, fontSize: 9 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  recurrenceChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.accent,
  },
  recurrenceText: { fontSize: 9, color: colors.accent, fontWeight: "600" },
  avoidanceChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: colors.mediumGlow, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.medium,
  },
  avoidanceText: { fontSize: 9, color: colors.medium, fontWeight: "600" },
  description:   { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 8 },
  aiReasonRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 8,
    backgroundColor: "rgba(108,99,255,0.08)",
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
  },
  aiReason:   { ...typography.bodySmall, color: colors.accent, marginLeft: 4, fontStyle: "italic" },
  footer:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dueDateRow: { flexDirection: "row", alignItems: "center" },
  dueDate:    { ...typography.bodySmall, color: colors.textSecondary, marginLeft: 4 },
  actions:    { flexDirection: "row", gap: spacing.sm },
  actionBtn:  { padding: 4 },
});

const TaskCard = ({ task, onToggle, onEdit, onDelete, onFocus, highlighted = false }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const checkScale   = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const prevDone     = useRef(task.completed);

  useEffect(() => {
    if (!prevDone.current && task.completed) {
      Animated.sequence([
        Animated.spring(checkScale, { toValue: 1.5, useNativeDriver: true, speed: 50 }),
        Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true, speed: 20 }),
      ]).start();
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
    prevDone.current = task.completed;
  }, [task.completed]);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  const displayPriority = task.aiPriority || task.priority;
  const priorityColor   = displayPriority ? priorityColors[displayPriority] : colors.textMuted;
  const glowColor       = displayPriority ? priorityGlow[displayPriority]   : "transparent";

  const isOverdue    = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
  const daysOverdue  = isOverdue
    ? Math.max(1, Math.floor((new Date() - new Date(task.dueDate)) / (1000 * 60 * 60 * 24)))
    : 0;
  const overdueLabelPrefix = daysOverdue === 1 ? "Yesterday" : `${daysOverdue}d overdue`;

  const lastTouched      = task.lastTouchedAt ? new Date(task.lastTouchedAt) : null;
  const daysSinceTouched = lastTouched
    ? Math.floor((new Date() - lastTouched) / (1000 * 60 * 60 * 24))
    : null;
  const isBeingAvoided = !task.completed && daysSinceTouched !== null && daysSinceTouched >= 3;

  const recurrenceLabel = task.recurrence ? getRecurrenceLabel(task.recurrence) : null;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onEdit(task)}
        onLongPress={onFocus ? () => onFocus(task) : undefined}
        delayLongPress={400}
        activeOpacity={1}
        style={[
          styles.card,
          task.completed && styles.cardCompleted,
          displayPriority && { borderLeftColor: priorityColor, borderLeftWidth: 3 },
          highlighted && styles.cardHighlighted,
        ]}
      >
        {task.aiPriority && (
          <View style={[styles.glowOverlay, { backgroundColor: glowColor }]} />
        )}
        {highlighted && <View style={styles.highlightOverlay} />}
        <Animated.View style={[styles.completionFlash, { opacity: flashOpacity }]} />

        <View style={styles.row}>
          {/* Checkbox */}
          <TouchableOpacity onPress={() => onToggle(task)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Animated.View style={[styles.checkbox, task.completed && styles.checkboxDone, { transform: [{ scale: checkScale }] }]}>
              {task.completed && <Feather name="check" size={12} color={colors.bg} />}
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.content}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, task.completed && styles.titleCompleted]} numberOfLines={1}>
                {task.title}
              </Text>
              {displayPriority && (
                <View style={[styles.badge, { backgroundColor: glowColor, borderColor: priorityColor }]}>
                  {task.aiPriority && (
                    <Feather name="zap" size={8} color={priorityColor} style={{ marginRight: 2 }} />
                  )}
                  <Text style={[styles.badgeText, { color: priorityColor }]}>{displayPriority}</Text>
                </View>
              )}
            </View>

            {/* Meta row: class + recurrence + avoidance */}
            <View style={styles.metaRow}>
              {task.className && <ClassTag className={task.className} size="sm" />}
              {recurrenceLabel && (
                <View style={styles.recurrenceChip}>
                  <Feather name="repeat" size={9} color={colors.accent} />
                  <Text style={styles.recurrenceText}>{recurrenceLabel}</Text>
                </View>
              )}
              {isBeingAvoided && (
                <View style={styles.avoidanceChip}>
                  <Feather name="alert-triangle" size={9} color={colors.medium} />
                  <Text style={styles.avoidanceText}>{daysSinceTouched}d untouched</Text>
                </View>
              )}
            </View>

            {task.description ? (
              <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
            ) : null}

            {task.aiReason ? (
              <View style={styles.aiReasonRow}>
                <Feather name="cpu" size={10} color={colors.accent} />
                <Text style={styles.aiReason}>{task.aiReason}</Text>
              </View>
            ) : null}

            {/* Footer */}
            <View style={styles.footer}>
              {task.dueDate ? (
                <View style={styles.dueDateRow}>
                  <Feather name="calendar" size={11} color={isOverdue ? colors.high : colors.textMuted} />
                  <Text style={[styles.dueDate, isOverdue && { color: colors.high }]}>
                    {isOverdue ? overdueLabelPrefix : format(new Date(task.dueDate), "MMM d")}
                  </Text>
                </View>
              ) : <View />}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => onDelete(task)} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="trash-2" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};


export default TaskCard;