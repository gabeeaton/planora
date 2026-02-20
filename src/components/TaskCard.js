// ============================================================
// components/TaskCard.js
// Renders a single task with:
// - Checkbox (tap to complete)
// - Title, description, due date
// - Priority badge (with AI badge if AI-suggested)
// - Edit and delete action buttons
// ============================================================

import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, typography, spacing, radius, priorityColors, priorityGlow } from "../utils/theme";
import { format } from "date-fns";

const TaskCard = ({ task, onToggle, onEdit, onDelete }) => {
  // Animated value for the press-scale effect
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Use AI priority if available, fallback to manual priority
  const displayPriority = task.aiPriority || task.priority;
  const priorityColor = displayPriority ? priorityColors[displayPriority] : colors.textMuted;
  const glowColor = displayPriority ? priorityGlow[displayPriority] : "transparent";

  const isOverdue =
    task.dueDate && !task.completed && new Date(task.dueDate) < new Date();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onEdit(task)}
        activeOpacity={1}
        style={[
          styles.card,
          task.completed && styles.cardCompleted,
          displayPriority && { borderLeftColor: priorityColor, borderLeftWidth: 3 },
        ]}
      >
        {/* AI priority glow background */}
        {task.aiPriority && (
          <View style={[styles.glowOverlay, { backgroundColor: glowColor }]} />
        )}

        <View style={styles.row}>
          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => onToggle(task)}
            style={[styles.checkbox, task.completed && styles.checkboxDone]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {task.completed && (
              <Feather name="check" size={12} color={colors.bg} />
            )}
          </TouchableOpacity>

          {/* Task content */}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, task.completed && styles.titleCompleted]}
                numberOfLines={1}
              >
                {task.title}
              </Text>

              {/* Priority badge */}
              {displayPriority && (
                <View style={[styles.badge, { backgroundColor: glowColor, borderColor: priorityColor }]}>
                  {task.aiPriority && (
                    <Feather name="zap" size={8} color={priorityColor} style={{ marginRight: 2 }} />
                  )}
                  <Text style={[styles.badgeText, { color: priorityColor }]}>
                    {displayPriority}
                  </Text>
                </View>
              )}
            </View>

            {task.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {task.description}
              </Text>
            ) : null}

            {/* AI reason (shown after 'Suggest Priority') */}
            {task.aiReason ? (
              <View style={styles.aiReasonRow}>
                <Feather name="cpu" size={10} color={colors.accent} />
                <Text style={styles.aiReason}>{task.aiReason}</Text>
              </View>
            ) : null}

            {/* Footer: due date + actions */}
            <View style={styles.footer}>
              {task.dueDate ? (
                <View style={styles.dueDateRow}>
                  <Feather
                    name="calendar"
                    size={11}
                    color={isOverdue ? colors.high : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.dueDate,
                      isOverdue && { color: colors.high },
                    ]}
                  >
                    {isOverdue ? "Overdue · " : ""}
                    {format(new Date(task.dueDate), "MMM d")}
                  </Text>
                </View>
              ) : (
                <View />
              )}

              {/* Edit / Delete */}
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => onEdit(task)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={14} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(task)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardCompleted: {
    opacity: 0.5,
  },
  glowOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  titleCompleted: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.label,
    fontSize: 9,
  },
  description: {
    ...typography.bodySmall,
    marginBottom: 8,
  },
  aiReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(108,99,255,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiReason: {
    ...typography.bodySmall,
    color: colors.accent,
    marginLeft: 4,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dueDateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dueDate: {
    ...typography.bodySmall,
    marginLeft: 4,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    padding: 4,
  },
});

export default TaskCard;
