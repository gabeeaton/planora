// ============================================================
// src/components/TaskModal.js
// Fixed: full theme system (no hardcoded colors), recurrence UI added
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, Linking, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { format } from "date-fns";
import DatePicker from "./DatePicker";
import { useUserProfile } from "../hooks/useUserProfile";
import { getRecurrenceLabel } from "../services/recurringTasks";


const makeStyles = (colors) => StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  container:   { position: "absolute", bottom: 0, left: 0, right: 0, top: 120 },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 48, maxHeight: "100%",
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  calBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
  },
  calBtnText: { fontSize: 12, fontWeight: "600" },
  closeBtn:   { padding: 4 },
  field:      { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 15,
  },
  textArea:   { height: 80, paddingTop: 12 },
  classRow:   { flexDirection: "row", gap: 8 },
  classChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
  },
  classChipText:    { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  priorityRow:      { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 5,
  },
  priorityLabel:    { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  dateHeaderRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dateBadge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  dateBadgeText:    { fontSize: 12, fontWeight: "700" },

  // Recurrence styles
  recurrenceRow:    { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  recurrenceChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
  },
  recurrenceChipActive: {
    borderColor: colors.accent, backgroundColor: colors.accentGlow,
  },
  recurrenceChipText:       { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  recurrenceChipTextActive: { color: colors.accent },
  dayRow:  { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  dayChip: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bgInput,
    alignItems: "center", justifyContent: "center",
  },
  dayChipActive:      { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  dayChipText:        { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  dayChipTextActive:  { color: colors.accent, fontWeight: "700" },
  recurrencePreview: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: colors.accentGlow, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start",
    borderWidth: 1, borderColor: colors.accent,
  },
  recurrencePreviewText: { fontSize: 11, color: colors.accent, fontWeight: "600" },

  timeToggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  timeToggleText:   { flex: 1, fontSize: 15, color: colors.textMuted },
  clearTimeText:    { fontSize: 12, color: colors.high, fontWeight: "600" },

  timePicker: {
    marginTop: 8, backgroundColor: colors.bgInput,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    maxHeight: 160,
  },
  timeGrid:      { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  timeCell: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  timeCellText:     { fontSize: 12, color: colors.textSecondary },

  calExportRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    marginBottom: spacing.md,
  },
  calExportText:    { flex: 1, fontSize: 13, fontWeight: "500" },

  customClassInput: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 15, marginTop: 8,
  },
  errorRow:         { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 6 },
  errorText:        { color: colors.high, fontSize: 13 },
  saveBtn: {
    borderRadius: 12, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
  },
  saveBtnText:      { color: "#fff", fontSize: 16, fontWeight: "700" },
});

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_META = {
  HIGH:   { icon: "alert-circle", color: "#FF5C5C", label: "High" },
  MEDIUM: { icon: "minus-circle", color: "#FFB347", label: "Medium" },
  LOW:    { icon: "check-circle", color: "#5CFF8F", label: "Low" },
};

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = ["00", "15", "30", "45"];

const RECURRENCE_OPTIONS = [
  { label: "None",     value: null },
  { label: "Daily",    value: { type: "daily" } },
  { label: "Weekly",   value: { type: "weekly" } },
  { label: "Biweekly", value: { type: "biweekly" } },
  { label: "Monthly",  value: { type: "monthly" } },
  { label: "Custom",   value: { type: "custom_days" } },
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const formatHour = (h) => {
  const suffix  = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
};

// Google Calendar deep link — no OAuth needed
const openInGoogleCalendar = async (task) => {
  if (!task.dueDate) {
    Alert.alert("No date set", "Please set a due date before exporting to Google Calendar.");
    return;
  }
  const due     = new Date(task.dueDate);
  const hasTime = task.dueTime != null;
  let startStr, endStr;

  if (hasTime) {
    const [h, m] = task.dueTime;
    const start  = new Date(due.getFullYear(), due.getMonth(), due.getDate(), h, m, 0);
    const end    = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt    = (d) =>
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}00`;
    startStr = fmt(start);
    endStr   = fmt(end);
  } else {
    const fmt    = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    startStr = fmt(due);
    endStr   = fmt(new Date(due.getTime() + 24*60*60*1000));
  }

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(task.description ?? "")}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Error", "Could not open Google Calendar.");
  } catch {
    Alert.alert("Error", "Could not open Google Calendar.");
  }
};

const GRADES       = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F", "No grade yet"];
const CREDIT_OPTS  = ["1", "2", "3", "4", "5+"];
const generateId   = () => Math.random().toString(36).slice(2, 10);

const TaskModal = ({ visible, task, onClose, onSave }) => {
  const { colors } = useTheme();
  const styles  = makeStyles(colors);
  const { profile, updateProfile } = useUserProfile();
  const classes      = profile?.classes ?? [];

  // ── Task form state ──────────────────────────────────────
  const [title, setTitle]                   = useState("");
  const [description, setDescription]       = useState("");
  const [priority, setPriority]             = useState("MEDIUM");
  const [dueDate, setDueDate]               = useState(null);
  const [dueTime, setDueTime]               = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [classId, setClassId]               = useState(null);
  const [className, setClassName]           = useState(null);
  const [customClassName, setCustomClassName] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [recurrence, setRecurrence]         = useState(null);
  const [customDays, setCustomDays]         = useState([]);
  const [weeklyDay, setWeeklyDay]           = useState(1); // Mon default
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  // ── Save-class prompt state (step 2) ─────────────────────
  const [modalStep, setModalStep]           = useState("form"); // "form" | "save-class"
  const [pendingClassName, setPendingClassName] = useState("");
  const [newClassGrade, setNewClassGrade]   = useState("No grade yet");
  const [newClassCredits, setNewClassCredits] = useState("3");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setPriority(task.priority || "MEDIUM");
      setDueDate(task.dueDate ? new Date(task.dueDate) : null);
      setDueTime(task.dueTime ?? null);
      setClassId(task.classId ?? null);
      setClassName(task.className ?? null);
      // Load recurrence
      const rec = task.recurrence ?? null;
      if (rec?.type === "custom_days") {
        setRecurrence({ type: "custom_days" });
        setCustomDays(rec.days ?? []);
      } else if (rec?.type === "weekly" || rec?.type === "biweekly") {
        setRecurrence({ type: rec.type });
        setWeeklyDay(rec.dayOfWeek ?? 1);
      } else {
        setRecurrence(rec);
        setCustomDays([]);
        setWeeklyDay(1);
      }
    } else {
      setTitle(""); setDescription(""); setPriority("MEDIUM");
      setDueDate(null); setDueTime(null);
      setClassId(null); setClassName(null);
      setRecurrence(null); setCustomDays([]); setWeeklyDay(1);
    }
    setShowTimePicker(false);
    setCustomClassName("");
    setShowCustomInput(false);
    setModalStep("form");
    setPendingClassName("");
    setNewClassGrade("No grade yet");
    setNewClassCredits("3");
    setError("");
  }, [task, visible]);

  const selectClass = (cls) => {
    if (classId === cls.id) { setClassId(null); setClassName(null); }
    else { setClassId(cls.id); setClassName(cls.name); setShowCustomInput(false); setCustomClassName(""); }
  };

  const handleOtherChip = () => {
    setClassId(null); setClassName(null);
    setShowCustomInput((v) => !v);
  };

  const selectRecurrence = (option) => {
    if (option.value === null) { setRecurrence(null); return; }
    setRecurrence({ type: option.value.type });
  };

  const toggleCustomDay = (dayIdx) => {
    setCustomDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  // Build final recurrence object for saving
  const buildRecurrence = () => {
    if (!recurrence) return null;
    if (recurrence.type === "custom_days") {
      return customDays.length > 0 ? { type: "custom_days", days: customDays } : null;
    }
    if (recurrence.type === "weekly" || recurrence.type === "biweekly") {
      return { type: recurrence.type, dayOfWeek: weeklyDay };
    }
    return recurrence;
  };

  const activeRecurrenceType = recurrence?.type ?? null;

  // Preview label
  const previewRecurrence = buildRecurrence();
  const recurrencePreviewLabel = previewRecurrence ? getRecurrenceLabel(previewRecurrence) : null;

  const handleSave = async () => {
    if (!title.trim()) { setError("Task title is required"); return; }

    // Resolve final class — chip selection takes priority over typed input
    const finalClassName = classId ? className : (customClassName.trim() || null);
    const finalClassId   = classId ?? null;

    setSaving(true); setError("");
    try {
      await onSave({
        title:       title.trim(),
        description: description.trim(),
        priority,
        dueDate:     dueDate || null,
        dueTime:     dueDate ? dueTime : null,
        classId:     finalClassId,
        className:   finalClassName,
        recurrence:  buildRecurrence(),
      });

      // If they typed a class name not already in profile, offer to save it
      const isNewClass = finalClassName && !finalClassId &&
        !classes.some((c) => c.name.trim().toLowerCase() === finalClassName.toLowerCase());

      if (isNewClass) {
        setPendingClassName(finalClassName);
        setModalStep("save-class");
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClass = async () => {
    setSaving(true);
    try {
      const newClass = {
        id: generateId(),
        name: pendingClassName,
        grade: newClassGrade,
        creditHours: newClassCredits,
      };
      await updateProfile({ classes: [...classes, newClass] });
    } catch {
      // non-fatal — task is already saved
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const timeLabel = dueTime
    ? `${formatHour(dueTime[0])}:${String(dueTime[1]).padStart(2,"0")}`
    : "Add time";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {modalStep === "save-class" ? "Save Class" : task ? "Edit Task" : "New Task"}
            </Text>
            <View style={styles.headerRight}>
              {task && task.dueDate && (
                <TouchableOpacity
                  onPress={() => openInGoogleCalendar({ ...task, dueTime })}
                  style={[styles.calBtn, { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                >
                  <Feather name="calendar" size={14} color={colors.accent} />
                  <Text style={[styles.calBtnText, { color: colors.accent }]}>Add to Calendar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
            {modalStep === "save-class" ? (
              <>
                <Text style={[styles.label, { marginBottom: 4, marginTop: 4, fontSize: 13, textTransform: "none", letterSpacing: 0, color: colors.textSecondary }]}>
                  Task saved! Want to add{" "}
                  <Text style={{ color: colors.accent, fontWeight: "700" }}>{pendingClassName}</Text>
                  {" "}to your classes for grade tracking?
                </Text>

                <View style={[styles.field, { marginTop: 16 }]}>
                  <Text style={styles.label}>GRADE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.classRow}>
                      {GRADES.map((g) => (
                        <TouchableOpacity
                          key={g}
                          onPress={() => setNewClassGrade(g)}
                          style={[styles.classChip, newClassGrade === g && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                        >
                          <Text style={[styles.classChipText, newClassGrade === g && { color: colors.accent }]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>CREDIT HOURS</Text>
                  <View style={styles.classRow}>
                    {CREDIT_OPTS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setNewClassCredits(c)}
                        style={[styles.classChip, newClassCredits === c && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                      >
                        <Text style={[styles.classChipText, newClassCredits === c && { color: colors.accent }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSaveClass}
                  style={[styles.saveBtn, { backgroundColor: colors.accent, marginTop: 8 }, saving && { opacity: 0.6 }]}
                  disabled={saving}
                >
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save to Classes"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.saveBtn, { backgroundColor: "transparent", marginTop: 4 }]}
                >
                  <Text style={[styles.saveBtnText, { color: colors.textMuted }]}>Skip</Text>
                </TouchableOpacity>
              </>
            ) : (
            <>
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>TASK TITLE *</Text>
              <TextInput
                style={styles.input}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add notes or details..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Class selector */}
            <View style={styles.field}>
              <Text style={styles.label}>CLASS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.classRow}>
                  {classes.map((cls) => {
                    const selected = classId === cls.id;
                    return (
                      <TouchableOpacity
                        key={cls.id}
                        onPress={() => selectClass(cls)}
                        style={[
                          styles.classChip,
                          selected && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                        ]}
                      >
                        <Text style={[styles.classChipText, selected && { color: colors.accent }]}>
                          {cls.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* "Other..." chip — always shown so user can type a class */}
                  <TouchableOpacity
                    onPress={handleOtherChip}
                    style={[
                      styles.classChip,
                      showCustomInput && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.classChipText, showCustomInput && { color: colors.accent }]}>
                      {classes.length === 0 ? "Type class name..." : "Other..."}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              {(showCustomInput || classes.length === 0) && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  placeholder="Class name (e.g. HIST 101)"
                  placeholderTextColor={colors.textMuted}
                  value={customClassName}
                  onChangeText={setCustomClassName}
                  autoCapitalize="words"
                />
              )}
            </View>

            {/* Priority */}
            <View style={styles.field}>
              <Text style={styles.label}>PRIORITY</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const meta     = PRIORITY_META[p];
                  const selected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[
                        styles.priorityBtn,
                        selected && { backgroundColor: meta.color + "22", borderColor: meta.color },
                      ]}
                    >
                      <Feather name={meta.icon} size={14} color={selected ? meta.color : colors.textMuted} />
                      <Text style={[styles.priorityLabel, selected && { color: meta.color }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── RECURRENCE ── */}
            <View style={styles.field}>
              <Text style={styles.label}>REPEAT</Text>
              <View style={styles.recurrenceRow}>
                {RECURRENCE_OPTIONS.map((opt) => {
                  const isActive = (opt.value === null && recurrence === null) ||
                                   (opt.value !== null && activeRecurrenceType === opt.value.type);
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      onPress={() => selectRecurrence(opt)}
                      style={[styles.recurrenceChip, isActive && styles.recurrenceChipActive]}
                    >
                      <Text style={[styles.recurrenceChipText, isActive && styles.recurrenceChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Day picker for Weekly / Biweekly */}
              {(activeRecurrenceType === "weekly" || activeRecurrenceType === "biweekly") && (
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setWeeklyDay(i)}
                      style={[styles.dayChip, weeklyDay === i && styles.dayChipActive]}
                    >
                      <Text style={[styles.dayChipText, weeklyDay === i && styles.dayChipTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Multi-day picker for Custom */}
              {activeRecurrenceType === "custom_days" && (
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => toggleCustomDay(i)}
                      style={[styles.dayChip, customDays.includes(i) && styles.dayChipActive]}
                    >
                      <Text style={[styles.dayChipText, customDays.includes(i) && styles.dayChipTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Recurrence preview label */}
              {recurrencePreviewLabel && (
                <View style={styles.recurrencePreview}>
                  <Feather name="repeat" size={11} color={colors.accent} />
                  <Text style={styles.recurrencePreviewText}>{recurrencePreviewLabel}</Text>
                </View>
              )}
            </View>

            {/* Due Date */}
            <View style={styles.field}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.label}>DUE DATE</Text>
                {dueDate && (
                  <View style={[styles.dateBadge, { backgroundColor: colors.accentGlow, borderColor: colors.accent + "80" }]}>
                    <Text style={[styles.dateBadgeText, { color: colors.accentLight ?? colors.accent }]}>
                      {format(dueDate, "MMM d, yyyy")}
                    </Text>
                  </View>
                )}
              </View>
              <DatePicker value={dueDate} onChange={setDueDate} onClear={() => { setDueDate(null); setDueTime(null); }} />
            </View>

            {/* Time picker */}
            {dueDate && (
              <View style={styles.field}>
                <View style={styles.dateHeaderRow}>
                  <Text style={styles.label}>TIME (optional)</Text>
                  {dueTime && (
                    <TouchableOpacity onPress={() => setDueTime(null)}>
                      <Text style={styles.clearTimeText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.timeToggleBtn, showTimePicker && { borderColor: colors.accent }]}
                  onPress={() => setShowTimePicker((v) => !v)}
                >
                  <Feather name="clock" size={15} color={dueTime ? colors.accent : colors.textMuted} />
                  <Text style={[styles.timeToggleText, dueTime && { color: colors.accent }]}>{timeLabel}</Text>
                  <Feather name={showTimePicker ? "chevron-up" : "chevron-down"} size={15} color={colors.textMuted} />
                </TouchableOpacity>

                {showTimePicker && (
                  <View style={styles.timePicker}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.timeGrid}>
                        {HOURS.map((h) =>
                          MINUTES.map((m) => {
                            const minNum     = parseInt(m);
                            const isSelected = dueTime && dueTime[0] === h && dueTime[1] === minNum;
                            return (
                              <TouchableOpacity
                                key={`${h}:${m}`}
                                style={[
                                  styles.timeCell,
                                  isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                                ]}
                                onPress={() => { setDueTime([h, minNum]); setShowTimePicker(false); }}
                              >
                                <Text style={[styles.timeCellText, isSelected && { color: "#fff", fontWeight: "700" }]}>
                                  {formatHour(h)}:{m}
                                </Text>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Google Calendar export */}
            {dueDate && (
              <TouchableOpacity
                style={[styles.calExportRow, { borderColor: colors.accentGlow }]}
                onPress={() => openInGoogleCalendar({ title, description, dueDate, dueTime })}
              >
                <Feather name="calendar" size={14} color={colors.accent} />
                <Text style={[styles.calExportText, { color: colors.accent }]}>
                  {dueTime ? "Export to Google Calendar with time" : "Export to Google Calendar (all-day)"}
                </Text>
                <Feather name="external-link" size={12} color={colors.accent} />
              </TouchableOpacity>
            )}

            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.high} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && { opacity: 0.6 }]}
              disabled={saving}
            >
              <Feather name={saving ? "loader" : task ? "save" : "plus"} size={18} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : task ? "Save Changes" : "Create Task"}
              </Text>
            </TouchableOpacity>
            </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


export default TaskModal;