import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, typography, spacing, radius } from "../utils/theme";
import { format } from "date-fns";
import DatePicker from "./Datepicker";

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_META = {
  HIGH: { icon: "alert-circle", color: "#FF5C5C", label: "High" },
  MEDIUM: { icon: "minus-circle", color: "#FFB347", label: "Medium" },
  LOW: { icon: "check-circle", color: "#5CFF8F", label: "Low" },
};

const TaskModal = ({ visible, task, onClose, onSave }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setPriority(task.priority || "MEDIUM");
      setDueDate(task.dueDate ? new Date(task.dueDate) : null);
    } else {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate(null);
    }
    setError("");
  }, [task, visible]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{task ? "Edit Task" : "New Task"}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={true} indicatorStyle="white" contentContainerStyle={{ paddingRight: 8 }}>
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
                returnKeyType="next"
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

            {/* Priority */}
            <View style={styles.field}>
              <Text style={styles.label}>PRIORITY</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const meta = PRIORITY_META[p];
                  const selected = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[styles.priorityBtn, selected && { backgroundColor: meta.color + "22", borderColor: meta.color }]}
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
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{format(dueDate, "MMM d, yyyy")}</Text>
                  </View>
                )}
              </View>
              <DatePicker value={dueDate} onChange={setDueDate} onClear={() => setDueDate(null)} />
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color="#FF5C5C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
            >
              <Feather name={saving ? "loader" : task ? "save" : "plus"} size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : task ? "Save Changes" : "Create Task"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  container: { position: "absolute", bottom: 0, left: 0, right: 0, top: 120 },
  sheet: {
    backgroundColor: "#16161F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "100%",
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
  closeBtn: { padding: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "700", color: "#6666AA", letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase" },
  input: {
    backgroundColor: "#1C1C27", borderWidth: 1, borderColor: "#2A2A3A",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: "#F0F0FF", fontSize: 15,
  },
  textArea: { height: 80, paddingTop: 12 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#2A2A3A", gap: 5,
  },
  priorityLabel: { fontSize: 14, color: "#6666AA", fontWeight: "600" },
  dateHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dateBadge: {
    backgroundColor: "rgba(108,99,255,0.25)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(108,99,255,0.5)",
  },
  dateBadgeText: { fontSize: 12, fontWeight: "700", color: "#B8B0FF" },
  errorRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 6 },
  errorText: { color: "#FF5C5C", fontSize: 13 },
  saveBtn: {
    backgroundColor: "#6C63FF", borderRadius: 12, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, marginTop: 8,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

export default TaskModal;