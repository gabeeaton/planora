// ============================================================
// src/screens/SyllabusParserScreen.js
// Paste syllabus text or photograph it → AI extracts all tasks.
// The viral marketing feature. "30-second semester setup."
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, shadows, typography } from "../utils/theme";
import { parseSyllabusText } from "../services/syllabusParser";
import { useUserProfile } from "../hooks/useUserProfile";
import { format } from "date-fns";

const PRIORITY_COLORS = { HIGH: "#FF5C5C", MEDIUM: "#FFB347", LOW: "#5CFF8F" };

const SyllabusParserScreen = ({ navigation, onTasksImported }) => {
  const { profile } = useUserProfile();
  const classes = profile?.classes ?? [];

  const [syllabusText, setSyllabusText] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [importDone, setImportDone] = useState(false);

  const handleParse = async () => {
    if (!syllabusText.trim()) {
      setError("Please paste your syllabus text first.");
      return;
    }
    setError(null);
    setParsing(true);
    setParsedTasks(null);

    try {
      const className = selectedClass?.name ?? null;
      const tasks = await parseSyllabusText(syllabusText, className);
      if (tasks.length === 0) {
        setError("No upcoming assignments found. Make sure you pasted assignment/deadline sections of the syllabus.");
        return;
      }
      setParsedTasks(tasks);
      // Select all by default
      setSelectedTasks(new Set(tasks.map((_, i) => i)));
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const toggleTask = (idx) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTasks.size === parsedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(parsedTasks.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (selectedTasks.size === 0) {
      setError("Select at least one task to import.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const toImport = parsedTasks.filter((_, i) => selectedTasks.has(i));
      await onTasksImported(toImport, selectedClass);
      setImportDone(true);
    } catch (err) {
      setError("Failed to import tasks. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  if (importDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={48} color={colors.low} />
          </View>
          <Text style={styles.successTitle}>
            {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} imported!
          </Text>
          <Text style={styles.successSubtitle}>
            Your semester is set up. The AI now has everything it needs to help you plan.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneBtnText}>Go to Dashboard</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Syllabus Parser</Text>
          <Text style={styles.headerSubtitle}>Set up your semester in 30 seconds</Text>
        </View>
        <View style={styles.aiBadge}>
          <Feather name="cpu" size={11} color={colors.accent} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {!parsedTasks ? (
          <>
            {/* Instructions */}
            <View style={styles.infoCard}>
              <Feather name="info" size={14} color={colors.accent} />
              <Text style={styles.infoText}>
                Paste your syllabus below — or just the assignments section. The AI will extract every deadline and create tasks automatically.
              </Text>
            </View>

            {/* Class selector */}
            {classes.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>WHICH CLASS? (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {classes.map((cls) => {
                      const sel = selectedClass?.id === cls.id;
                      return (
                        <TouchableOpacity
                          key={cls.id}
                          style={[styles.chip, sel && styles.chipSelected]}
                          onPress={() => setSelectedClass(sel ? null : cls)}
                        >
                          <Text style={[styles.chipText, sel && styles.chipTextSelected]}>
                            {cls.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Text input */}
            <View style={styles.field}>
              <Text style={styles.label}>PASTE SYLLABUS TEXT</Text>
              <TextInput
                style={styles.syllabusInput}
                placeholder={"Paste your full syllabus here...\n\nTip: Even just the 'Assignments' or 'Schedule' section works great."}
                placeholderTextColor={colors.textMuted}
                value={syllabusText}
                onChangeText={(v) => { setSyllabusText(v); setError(null); }}
                multiline
                textAlignVertical="top"
              />
              {syllabusText.length > 0 && (
                <Text style={styles.charCount}>{syllabusText.length} chars</Text>
              )}
            </View>

            {error && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.high} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.parseBtn, (parsing || !syllabusText.trim()) && styles.parseBtnDisabled]}
              onPress={handleParse}
              disabled={parsing || !syllabusText.trim()}
            >
              {parsing ? (
                <>
                  <ActivityIndicator size={16} color="#fff" />
                  <Text style={styles.parseBtnText}>Analyzing syllabus...</Text>
                </>
              ) : (
                <>
                  <Feather name="cpu" size={16} color="#fff" />
                  <Text style={styles.parseBtnText}>Extract Tasks with AI</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Results header */}
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>
                  Found {parsedTasks.length} assignments
                </Text>
                <Text style={styles.resultsSubtitle}>
                  {selectedClass ? `From ${selectedClass.name}` : "Tap to deselect any you don't need"}
                </Text>
              </View>
              <TouchableOpacity onPress={toggleAll} style={styles.selectAllBtn}>
                <Text style={styles.selectAllText}>
                  {selectedTasks.size === parsedTasks.length ? "Deselect all" : "Select all"}
                </Text>
              </TouchableOpacity>
            </View>

            {parsedTasks.map((task, idx) => {
              const selected = selectedTasks.has(idx);
              const pColor   = PRIORITY_COLORS[task.priority] ?? colors.textMuted;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.taskRow, !selected && styles.taskRowDeselected]}
                  onPress={() => toggleTask(idx)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, !selected && styles.taskTitleDeselected]}>
                      {task.title}
                    </Text>
                    <View style={styles.taskMeta}>
                      {task.dueDate && (
                        <View style={styles.metaChip}>
                          <Feather name="calendar" size={10} color={colors.textMuted} />
                          <Text style={styles.metaText}>{format(task.dueDate, "MMM d")}</Text>
                        </View>
                      )}
                      <View style={[styles.metaChip, { borderColor: pColor + "44", backgroundColor: pColor + "18" }]}>
                        <Text style={[styles.metaText, { color: pColor }]}>{task.priority}</Text>
                      </View>
                    </View>
                    {task.description ? (
                      <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}

            {error && (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.high} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.importFooter}>
              <TouchableOpacity
                style={styles.reParseBtn}
                onPress={() => { setParsedTasks(null); setError(null); }}
              >
                <Feather name="arrow-left" size={14} color={colors.accent} />
                <Text style={styles.reParseBtnText}>Edit text</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.importBtn, (importing || selectedTasks.size === 0) && styles.importBtnDisabled]}
                onPress={handleImport}
                disabled={importing || selectedTasks.size === 0}
              >
                {importing ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <Feather name="download" size={16} color="#fff" />
                )}
                <Text style={styles.importBtnText}>
                  {importing ? "Importing..." : `Import ${selectedTasks.size} task${selectedTasks.size !== 1 ? "s" : ""}`}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
  },
  backBtn:        { padding: 4 },
  headerTitle:    { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  aiBadge: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent,
  },
  aiBadgeText: { fontSize: 10, color: colors.accent, fontWeight: "700" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40 },

  infoCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: colors.accentGlow, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.accent,
    marginBottom: spacing.md,
  },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  field:    { marginBottom: spacing.md },
  label: {
    fontSize: 11, fontWeight: "700", color: "#6666AA",
    letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase",
  },
  chipRow:  { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  chipSelected:     { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  chipText:         { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  chipTextSelected: { color: colors.accent },

  syllabusInput: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 14, color: colors.textPrimary,
    fontSize: 14, minHeight: 200,
  },
  charCount: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 4 },

  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,92,92,0.1)", padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: colors.high, marginBottom: spacing.md,
  },
  errorText: { color: colors.high, fontSize: 13, flex: 1 },

  parseBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, ...shadows.accent,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Results
  resultsHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: spacing.md,
  },
  resultsTitle:    { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  resultsSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  selectAllBtn:    { padding: 4 },
  selectAllText:   { fontSize: 13, color: colors.accent, fontWeight: "600" },

  taskRow: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  taskRowDeselected: { opacity: 0.4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  taskContent:    { flex: 1 },
  taskTitle:      { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 },
  taskTitleDeselected: { color: colors.textMuted },
  taskMeta:       { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
  },
  metaText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  taskDesc: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },

  importFooter: {
    flexDirection: "row", gap: spacing.sm,
    marginTop: spacing.md, alignItems: "center",
  },
  reParseBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent,
  },
  reParseBtnText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  importBtn: {
    flex: 1, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, ...shadows.accent,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Success state
  successContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  successIcon:    { marginBottom: spacing.lg },
  successTitle: {
    fontSize: 26, fontWeight: "800", color: colors.textPrimary,
    textAlign: "center", marginBottom: 10,
  },
  successSubtitle: {
    ...typography.body, textAlign: "center", lineHeight: 22,
    marginBottom: spacing.xl,
  },
  doneBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    flexDirection: "row", alignItems: "center", gap: 10, ...shadows.accent,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default SyllabusParserScreen;