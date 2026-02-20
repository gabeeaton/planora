// ============================================================
// src/components/TaskModal.js
// Includes optional time picker + Google Calendar deep link export
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, Linking, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, typography, spacing, radius, getAccentColors } from "../utils/theme";
import { format } from "date-fns";
import DatePicker from "./DatePicker";
import { useUserProfile } from "../hooks/useUserProfile";

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_META = {
  HIGH:   { icon: "alert-circle", color: "#FF5C5C", label: "High" },
  MEDIUM: { icon: "minus-circle", color: "#FFB347", label: "Medium" },
  LOW:    { icon: "check-circle", color: "#5CFF8F", label: "Low" },
};

// Hours for time picker
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = ["00", "15", "30", "45"];

const formatHour = (h) => {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${suffix}`;
};

// ── Google Calendar deep link ─────────────────────────────────
// Opens Google Calendar app (or web) with event pre-filled.
// No OAuth needed — just a deep link.
const openInGoogleCalendar = async (task) => {
  if (!task.dueDate) {
    Alert.alert("No date set", "Please set a due date before exporting to Google Calendar.");
    return;
  }

  const due  = new Date(task.dueDate);
  const hasTime = task.dueTime != null;

  let startStr, endStr;

  if (hasTime) {
    const [h, m]  = task.dueTime;
    const start   = new Date(due.getFullYear(), due.getMonth(), due.getDate(), h, m, 0);
    const end     = new Date(start.getTime() + 60 * 60 * 1000); // 1hr default
    // GCal format: YYYYMMDDTHHmmss
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}00`;
    startStr = fmt(start);
    endStr   = fmt(end);
  } else {
    // All-day event
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    startStr = fmt(due);
    const nextDay = new Date(due.getTime() + 24*60*60*1000);
    endStr = fmt(nextDay);
  }

  const details = encodeURIComponent(task.description ?? "");
  const title   = encodeURIComponent(task.title);

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Error", "Could not open Google Calendar.");
  } catch {
    Alert.alert("Error", "Could not open Google Calendar.");
  }
};

const TaskModal = ({ visible, task, onClose, onSave }) => {
  const { profile }     = useUserProfile();
  const classes         = profile?.classes ?? [];
  const ac              = getAccentColors();

  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority]       = useState("MEDIUM");
  const [dueDate, setDueDate]         = useState(null);
  const [dueTime, setDueTime]         = useState(null); // [hour, minute] or null
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [classId, setClassId]         = useState(null);
  const [className, setClassName]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setPriority(task.priority || "MEDIUM");
      setDueDate(task.dueDate ? new Date(task.dueDate) : null);
      setDueTime(task.dueTime ?? null);
      setClassId(task.classId   ?? null);
      setClassName(task.className ?? null);
    } else {
      setTitle(""); setDescription(""); setPriority("MEDIUM");
      setDueDate(null); setDueTime(null);
      setClassId(null); setClassName(null);
    }
    setShowTimePicker(false);
    setError("");
  }, [task, visible]);

  const selectClass = (cls) => {
    if (classId === cls.id) { setClassId(null); setClassName(null); }
    else                     { setClassId(cls.id); setClassName(cls.name); }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("Task title is required"); return; }
    setSaving(true); setError("");
    try {
      await onSave({
        title:       title.trim(),
        description: description.trim(),
        priority,
        dueDate:     dueDate || null,
        dueTime:     dueDate ? dueTime : null, // only save time if there's a date
        classId:     classId   ?? null,
        className:   className ?? null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const timeLabel = dueTime
    ? `${formatHour(dueTime[0])}:${String(dueTime[1]).padStart(2,"0") === "00" ? "00" : dueTime[1]}`
    : "Add time";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{task ? "Edit Task" : "New Task"}</Text>
            <View style={styles.headerRight}>
              {/* Google Calendar export — only if task exists and has a date */}
              {task && task.dueDate && (
                <TouchableOpacity
                  onPress={() => openInGoogleCalendar({ ...task, dueTime })}
                  style={[styles.calBtn, { backgroundColor: ac.accentGlow, borderColor: ac.accent }]}
                >
                  <Feather name="calendar" size={14} color={ac.accent} />
                  <Text style={[styles.calBtnText, { color: ac.accent }]}>Add to Calendar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>

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
            {classes.length > 0 && (
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
                            selected && { backgroundColor: ac.accentGlow, borderColor: ac.accent },
                          ]}
                        >
                          <Text style={[styles.classChipText, selected && { color: ac.accent }]}>
                            {cls.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

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

            {/* Due Date */}
            <View style={styles.field}>
              <View style={styles.dateHeaderRow}>
                <Text style={styles.label}>DUE DATE</Text>
                {dueDate && (
                  <View style={[styles.dateBadge, { backgroundColor: ac.accentGlow, borderColor: ac.accent + "80" }]}>
                    <Text style={[styles.dateBadgeText, { color: ac.accentLight }]}>
                      {format(dueDate, "MMM d, yyyy")}
                    </Text>
                  </View>
                )}
              </View>
              <DatePicker value={dueDate} onChange={setDueDate} onClear={() => { setDueDate(null); setDueTime(null); }} />
            </View>

            {/* Time picker — only shown if a date is selected */}
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
                  style={[styles.timeToggleBtn, showTimePicker && { borderColor: ac.accent }]}
                  onPress={() => setShowTimePicker((v) => !v)}
                >
                  <Feather name="clock" size={15} color={dueTime ? ac.accent : colors.textMuted} />
                  <Text style={[styles.timeToggleText, dueTime && { color: ac.accent }]}>{timeLabel}</Text>
                  <Feather
                    name={showTimePicker ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {showTimePicker && (
                  <View style={styles.timePicker}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.timeGrid}>
                        {HOURS.map((h) =>
                          MINUTES.map((m) => {
                            const minNum  = parseInt(m);
                            const isSelected = dueTime && dueTime[0] === h && dueTime[1] === minNum;
                            return (
                              <TouchableOpacity
                                key={`${h}:${m}`}
                                style={[
                                  styles.timeCell,
                                  isSelected && { backgroundColor: ac.accent, borderColor: ac.accent },
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

            {/* Google Calendar hint */}
            {dueDate && (
              <TouchableOpacity
                style={[styles.calExportRow, { borderColor: ac.accentGlow }]}
                onPress={() => openInGoogleCalendar({ title, description, dueDate, dueTime })}
              >
                <Feather name="calendar" size={14} color={ac.accent} />
                <Text style={[styles.calExportText, { color: ac.accent }]}>
                  {dueTime ? "Export to Google Calendar with time" : "Export to Google Calendar (all-day)"}
                </Text>
                <Feather name="external-link" size={12} color={ac.accent} />
              </TouchableOpacity>
            )}

            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color="#FF5C5C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: ac.accent }, saving && { opacity: 0.6 }]}
              disabled={saving}
            >
              <Feather name={saving ? "loader" : task ? "save" : "plus"} size={18} color="#fff" />
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : task ? "Save Changes" : "Create Task"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  container:   { position: "absolute", bottom: 0, left: 0, right: 0, top: 120 },
  sheet: {
    backgroundColor: "#16161F", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 48, maxHeight: "100%",
  },
  handle: {
    width: 40, height: 4, backgroundColor: "#2A2A3A",
    borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#F0F0FF" },
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
    fontSize: 11, fontWeight: "700", color: "#6666AA",
    letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1C1C27", borderWidth: 1, borderColor: "#2A2A3A",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: "#F0F0FF", fontSize: 15,
  },
  textArea:   { height: 80, paddingTop: 12 },
  classRow:   { flexDirection: "row", gap: 8 },
  classChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: "#2A2A3A", backgroundColor: "#1C1C27",
  },
  classChipText:    { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  priorityRow:      { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#2A2A3A", gap: 5,
  },
  priorityLabel:    { fontSize: 14, color: "#6666AA", fontWeight: "600" },
  dateHeaderRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dateBadge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  dateBadgeText:    { fontSize: 12, fontWeight: "700" },

  timeToggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1C1C27", borderWidth: 1, borderColor: "#2A2A3A",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  timeToggleText:   { flex: 1, fontSize: 15, color: colors.textMuted },
  clearTimeText:    { fontSize: 12, color: colors.high, fontWeight: "600" },

  timePicker: {
    marginTop: 8, backgroundColor: "#1C1C27",
    borderRadius: 12, borderWidth: 1, borderColor: "#2A2A3A",
    maxHeight: 160,
  },
  timeGrid:      { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  timeCell: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: "#2A2A3A",
    backgroundColor: "#16161F",
  },
  timeCellText:     { fontSize: 12, color: colors.textSecondary },

  calExportRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    marginBottom: spacing.md,
  },
  calExportText:    { flex: 1, fontSize: 13, fontWeight: "500" },

  errorRow:         { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 6 },
  errorText:        { color: "#FF5C5C", fontSize: 13 },
  saveBtn: {
    borderRadius: 12, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
  },
  saveBtnText:      { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default TaskModal;