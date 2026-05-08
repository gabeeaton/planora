// ============================================================
// src/components/TaskCard.js
// Updated with recurring task badge
// ============================================================

import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import {
  typography,
  spacing,
  radius,
  priorityColors,
  priorityGlow,
  getClassColor,
} from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { format } from "date-fns";
import ClassTag from "./ClassTag";
import { getRecurrenceLabel } from "../services/recurringTasks";
import { getEffectivePriority } from "../utils/priority";

const gradeChipColor = (g, colors) => {
  if (!g) return null;
  if (g.startsWith("A"))           return { bg: colors.low + "20",    border: colors.low,    text: colors.low };
  if (g === "B+" || g === "B")     return { bg: colors.accent + "18", border: colors.accent, text: colors.accent };
  if (g === "B-" || g === "C+")   return { bg: colors.medium + "18", border: colors.medium, text: colors.medium };
  return                                  { bg: colors.high + "14",   border: colors.high,   text: colors.high };
};

const makeStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
      borderRadius: 20,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.border,
      borderWidth: colors.cardBorderW,
      borderColor: colors.cardBorder,
      overflow: "hidden",
      ...(colors.isDark
        ? {}
        : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
          }),
    },
    cardCompleted: { opacity: 0.5 },
    cardHighlighted: { borderColor: colors.accent, borderWidth: 1.5 },
    glowOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20,
    },
    completionFlash: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.lowGlow,
      borderRadius: 20,
      pointerEvents: "none",
    },
    highlightOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.accentGlow,
      borderRadius: 20,
    },
    row: { flexDirection: "row", alignItems: "flex-start" },
    checkbox: {
      width: 26, height: 26, borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.textMuted,
      marginRight: spacing.sm,
      marginTop: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxDone: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    content: { flex: 1 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
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
    badgeText: { ...typography.label, color: colors.textMuted, fontSize: 9 },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
      flexWrap: "wrap",
    },
    recurrenceChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.accentGlow,
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    recurrenceText: { fontSize: 9, color: colors.accent, fontFamily: "Outfit-Bold"},
    avoidanceChip: {
   flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.mediumGlow,
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.medium,
    },
    avoidanceText: { fontSize: 9, color: colors.medium, fontFamily: "Outfit-SemiBold" },
    description: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    aiReasonRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      backgroundColor: colors.accentGlow,
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
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.isDark ? colors.border : "#F0F0F5",
    },
    dueDateRow: { flexDirection: "row", alignItems: "center" },
    dueDate: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    actions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    actionBtn: { padding: 4 },
    focusBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    swipeReveal: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.low,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 20,
      gap: 8,
    },
    swipeRevealText: {
      color: "#fff",
      fontFamily: "Outfit-Bold",
      fontSize: 14,
    },
    deleteReveal: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#EF4444",
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingRight: 20,
      gap: 8,
    },
  });

const SWIPE_THRESHOLD = 65;

const TaskCard = ({
  task,
  onToggle,
  onEdit,
  onDelete,
  onFocus,
  highlighted = false,
  index = 0,
  onFocusBtnMeasure,
  onPriorityBadgeMeasure,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const checkScale   = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountTranslY = useRef(new Animated.Value(12)).current;
  const exitOpacity  = useRef(new Animated.Value(1)).current;
  const exitTranslY  = useRef(new Animated.Value(0)).current;

  // Height collapse — runs on JS thread simultaneously with the native fade
  const [measuredHeight, setMeasuredHeight] = useState(null);
  const heightAnim = useRef(new Animated.Value(200)).current; // large default — never collapses before onLayout
  const marginAnim = useRef(new Animated.Value(spacing.sm)).current;

  // Swipe-to-complete
  const swipeX = useRef(new Animated.Value(0)).current;
  const focusBtnRef      = useRef(null);
  const priorityBadgeRef = useRef(null);
  const taskRef = useRef(task);
  taskRef.current = task;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const thresholdHapticFired = useRef(false);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;


  const collapseAndCall = (callback) => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(marginAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(callback);
  };

  const swipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !taskRef.current.completed &&
        Math.abs(g.dx) > 5 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        swipeX.setValue(g.dx);
        if (Math.abs(g.dx) >= SWIPE_THRESHOLD && !thresholdHapticFired.current) {
          thresholdHapticFired.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
      onPanResponderRelease: (_, g) => {
        thresholdHapticFired.current = false;
        if (g.dx >= SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Animated.timing(swipeX, { toValue: 500, duration: 180, useNativeDriver: true }).start(() =>
            collapseAndCall(() => onToggleRef.current(taskRef.current))
          );
        } else if (g.dx <= -SWIPE_THRESHOLD && onDeleteRef.current) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          Animated.timing(swipeX, { toValue: -500, duration: 180, useNativeDriver: true }).start(() =>
            collapseAndCall(() => onDeleteRef.current(taskRef.current))
          );
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
        }
      },
      onPanResponderTerminate: () => {
        thresholdHapticFired.current = false;
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const completeRevealOpacity = swipeX.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });
  const deleteRevealOpacity = swipeX.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: "clamp" });

  // Enter animation — staggered fade + slide up on mount
  useEffect(() => {
    const delay = Math.min(index, 8) * 35;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(mountOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(mountTranslY, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const playCompleteAnimation = () => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1.5, useNativeDriver: true, speed: 50 }),
      Animated.spring(checkScale, { toValue: 1.0, useNativeDriver: true, speed: 20 }),
    ]).start();
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const handleToggle = () => {
    if (!task.completed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playCompleteAnimation();
      // Native thread: fade + slide
      Animated.parallel([
        Animated.timing(exitOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(exitTranslY, { toValue: 10, duration: 220, useNativeDriver: true }),
      ]).start(() => onToggle(task));
      // JS thread: collapse height + margin simultaneously with the native fade
      collapseAndCall(null);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onToggle(task);
    }
  };

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const displayPriority = getEffectivePriority(task);
  const priorityColor = displayPriority
    ? priorityColors(colors.isDark)[displayPriority]
    : colors.textMuted;
  const classColor = getClassColor(task.className, colors.isDark);
  const glowColor = displayPriority
    ? priorityGlow(colors.isDark)[displayPriority]
    : "transparent";

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const isOverdue = (() => {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay < todayStart) return true;
    if (dueDay.getTime() === todayStart.getTime()) {
      if (Array.isArray(task.dueTime) && task.dueTime.length === 2) {
        const dt = new Date(due);
        dt.setHours(task.dueTime[0], task.dueTime[1], 0, 0);
        return dt < now;
      }
    }
    return false;
  })();

  const lastTouched = task.lastTouchedAt ? new Date(task.lastTouchedAt) : null;
  const daysSinceTouched = lastTouched
    ? Math.floor((new Date() - lastTouched) / (1000 * 60 * 60 * 24))
    : null;
  const isBeingAvoided =
    !task.completed && daysSinceTouched !== null && daysSinceTouched >= 3;

  const recurrenceLabel = task.recurrence
    ? getRecurrenceLabel(task.recurrence)
    : null;

  return (
    // Outer: JS-thread only (height + margin collapse). Native module never sees these.
    <Animated.View
      {...(!task.completed ? swipePan.panHandlers : {})}
      onLayout={(e) => {
        if (measuredHeight === null) {
          const h = e.nativeEvent.layout.height;
          heightAnim.setValue(h);
          setMeasuredHeight(h);
        }
      }}
      style={[
        { marginBottom: marginAnim },
        measuredHeight !== null && { height: heightAnim },
      ]}
    >
    {!task.completed && (
      <>
        <Animated.View style={[styles.swipeReveal, { opacity: completeRevealOpacity }]}>
          <Feather name="check-circle" size={20} color="#fff" />
          <Text style={styles.swipeRevealText}>Complete</Text>
        </Animated.View>
        <Animated.View style={[styles.deleteReveal, { opacity: deleteRevealOpacity }]}>
          <Text style={styles.swipeRevealText}>Delete</Text>
          <Feather name="trash-2" size={20} color="#fff" />
        </Animated.View>
      </>
    )}
    {/* Inner: native-thread only (opacity + transform). No layout props here. */}
    <Animated.View style={{
      opacity: Animated.multiply(mountOpacity, exitOpacity),
      transform: [
        { scale: scaleAnim },
        { translateY: Animated.add(mountTranslY, exitTranslY) },
        { translateX: swipeX },
      ],
    }}>
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
          {
            borderLeftColor: task.completed ? classColor + "55" : classColor,
            borderLeftWidth: task.completed ? 3 : 5,
          },
          highlighted && styles.cardHighlighted,
        ]}
      >
        {highlighted && <View style={styles.highlightOverlay} />}
        <Animated.View
          style={[styles.completionFlash, { opacity: flashOpacity }]}
        />

        <View style={styles.row}>
          {/* Checkbox */}
          <TouchableOpacity
            onPress={handleToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View
              style={[
                styles.checkbox,
                task.completed && styles.checkboxDone,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              {task.completed && (
                <Feather name="check" size={12} color={colors.bg} />
              )}
            </Animated.View>
          </TouchableOpacity>

          <View style={styles.content}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, task.completed && styles.titleCompleted]}
                numberOfLines={1}
              >
                {task.title}
              </Text>

              {/* Priority badge — pending tasks only */}
              {!task.completed && displayPriority && (
                <TouchableOpacity
                  ref={onPriorityBadgeMeasure ? priorityBadgeRef : undefined}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    const label = displayPriority === "HIGH" ? "High — due very soon or high stakes" :
                                  displayPriority === "MEDIUM" ? "Medium — due within a week or moderate importance" :
                                  "Low — not urgent, no deadline pressure";
                    const source = task.aiPriority ? `\n\n⚡ AI reason: ${task.aiReason ?? "Based on your deadlines and patterns"}` : "";
                    Alert.alert("Priority", label + source);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                  onLayout={onPriorityBadgeMeasure ? () => {
                    priorityBadgeRef.current?.measureInWindow((wx, wy, ww, wh) => {
                      if (ww > 0) onPriorityBadgeMeasure({ cx: wx + ww / 2, cy: wy + wh / 2, w: ww, h: wh, r: 6 }, priorityBadgeRef.current);
                    });
                  } : undefined}
                >
                  <View style={[styles.badge, { backgroundColor: glowColor, borderColor: priorityColor }]}>
                    {task.aiPriority && (
                      <Feather name="zap" size={8} color={priorityColor} style={{ marginRight: 2 }} />
                    )}
                    <Text style={[styles.badgeText, { color: priorityColor }]}>
                      {displayPriority}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Meta row: class + recurrence + avoidance */}
            <View style={styles.metaRow}>
              {task.className && (
                <ClassTag className={task.className} size="sm" />
              )}
              {recurrenceLabel && (
                <View style={styles.recurrenceChip}>
                  <Feather name="repeat" size={9} color={colors.accent} />
                  <Text style={styles.recurrenceText}>{recurrenceLabel}</Text>
                </View>
              )}
              {isBeingAvoided && (
                <View style={styles.avoidanceChip}>
                  <Feather
                    name="alert-triangle"
                    size={9}
                    color={colors.medium}
                  />
                  <Text style={styles.avoidanceText}>
                    {daysSinceTouched}d untouched
                  </Text>
                </View>
              )}
            </View>

            {task.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {task.description}
              </Text>
            ) : null}

            {/* Footer */}
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
                  {Array.isArray(task.dueTime) && task.dueTime.length === 2 && (
                    <>
                      <Text
                        style={[
                          styles.dueDate,
                          { marginLeft: 4 },
                          isOverdue && { color: colors.high },
                        ]}
                      >
                        ·
                      </Text>
                      <Feather
                        name="clock"
                        size={11}
                        color={isOverdue ? colors.high : colors.textMuted}
                        style={{ marginLeft: 4 }}
                      />
                      <Text
                        style={[
                          styles.dueDate,
                          isOverdue && { color: colors.high },
                        ]}
                      >
                        {" "}
                        {task.dueTime[0] % 12 === 0 ? 12 : task.dueTime[0] % 12}
                        :{String(task.dueTime[1]).padStart(2, "0")}{" "}
                        {task.dueTime[0] >= 12 ? "PM" : "AM"}
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <View />
              )}
              <View style={styles.actions}>
                {onFocus && !task.completed && (
                  <TouchableOpacity
                    ref={onFocusBtnMeasure ? focusBtnRef : undefined}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); onFocus(task); }}
                    style={styles.focusBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onLayout={onFocusBtnMeasure ? () => {
                      focusBtnRef.current?.measureInWindow((wx, wy, ww, wh) => {
                        if (ww > 0) onFocusBtnMeasure({ cx: wx + ww / 2, cy: wy + wh / 2, w: ww, h: wh, r: 10 }, focusBtnRef.current);
                      });
                    } : undefined}
                  >
                    <Feather name="clock" size={14} color={colors.accent} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); onEdit(task); }}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={14} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onDelete(task); }}
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
    </Animated.View>
  );
};

export default TaskCard;
