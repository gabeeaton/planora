// ============================================================
// src/screens/SyllabusParserScreen.js
// Two tabs:
//   1. Syllabus Text  — AI extracts tasks from pasted text
//   2. Calendar (.ics) — import from Canvas, Google, Apple, Outlook
//
// The .ics tab replaces the old Canvas API approach.
// Works with any calendar export — no tokens, no OAuth, no CORS.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { parseSyllabusText } from "../services/syllabusParser";
import { parseIcsText, isValidIcs, countIcsEvents } from "../services/icsImport";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const makeStyles = (colors) =>
  StyleSheet.create({
    safe:   { flex: 1, backgroundColor: colors.bg },

    // ── Header ──
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
    },
    backBtn:        { padding: 4 },
    headerText:     { flex: 1 },
    headerTitle:    { fontSize: 18, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    aiBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: colors.accentGlow, borderRadius: radius.full,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: colors.accent,
    },
    aiBadgeText: { fontSize: 10, color: colors.accent, fontWeight: "700", letterSpacing: 0.5 },

    // ── Tab bar ──
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    tabItem: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 13, gap: 6,
      borderBottomWidth: 2, borderBottomColor: "transparent",
    },
    tabItemActive:  { borderBottomColor: colors.accent },
    tabText:        { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    tabTextActive:  { color: colors.accent },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 48 },

    // ── Info / tip cards ──
    infoCard: {
      flexDirection: "row", gap: 10, alignItems: "flex-start",
      backgroundColor: colors.accentGlow, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1, borderColor: colors.accent,
      marginBottom: spacing.md,
    },
    infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    infoLink: { color: colors.accent, fontWeight: "700" },

    // ── Form fields ──
    field:  { marginBottom: spacing.md },
    label: {
      fontSize: 10, fontWeight: "700", color: colors.textMuted,
      letterSpacing: 1, marginBottom: 8, textTransform: "uppercase",
    },

    // Class chips
    chipRow:          { flexDirection: "row", gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
    },
    chipSelected:     { borderColor: colors.accent, backgroundColor: colors.accentGlow },
    chipText:         { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
    chipTextSelected: { color: colors.accent },

    // Syllabus textarea
    syllabusInput: {
      backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.md, padding: 14, color: colors.textPrimary,
      fontSize: 14, minHeight: 200, textAlignVertical: "top",
    },
    charCount: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 4 },

    // ── ICS drop zone ──
    dropZone: {
      borderWidth: 2, borderStyle: "dashed", borderColor: colors.border,
      borderRadius: radius.lg, paddingVertical: 40,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.bgCard, marginBottom: spacing.md, gap: 10,
    },
    dropZoneActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
    dropIcon: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    dropTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
    dropSub:   { fontSize: 12, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
    dropBtn: {
      marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.accent, borderRadius: radius.full,
      paddingHorizontal: 18, paddingVertical: 9, ...shadows.accent,
    },
    dropBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

    // File loaded state
    fileLoaded: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.bgCard, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1, borderColor: colors.low,
      marginBottom: spacing.md,
    },
    fileLoadedIcon: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: "rgba(92,255,143,0.12)", alignItems: "center", justifyContent: "center",
    },
    fileName:      { fontSize: 14, fontWeight: "700", color: colors.textPrimary, flex: 1 },
    fileEventCount:{ fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    fileChangeBtn: { padding: 6 },

    // URL input for calendar feed
    urlInputWrap: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.md, paddingLeft: 14, marginBottom: spacing.sm,
    },
    urlInputWrapActive: { borderColor: colors.accent },
    urlInput: {
      flex: 1, color: colors.textPrimary, fontSize: 14,
      paddingVertical: 13, paddingRight: 12,
    },
    urlFetchBtn: {
      paddingHorizontal: 14, paddingVertical: 13,
      backgroundColor: colors.accent, borderRadius: radius.md,
      flexDirection: "row", alignItems: "center", gap: 5,
    },
    urlFetchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    orDivider: {
      flexDirection: "row", alignItems: "center", gap: 8, marginVertical: spacing.sm,
    },
    orLine:  { flex: 1, height: 1, backgroundColor: colors.border },
    orText:  { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

    // How-to steps
    stepsCard: {
      backgroundColor: colors.bgCard, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, marginBottom: spacing.md,
    },
    stepsTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, marginBottom: 10 },
    step: { flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" },
    stepNum: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent,
      alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
    },
    stepNumText: { fontSize: 10, fontWeight: "800", color: colors.accent },
    stepText:    { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 19 },
    stepLink:    { color: colors.accent, fontWeight: "600" },

    // Other sources
    sourcesRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
    sourceChip: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.bgCard, borderRadius: radius.md,
      paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
    },
    sourceText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },

    // ── Error ──
    errorRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(255,92,92,0.08)", padding: 12, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.high, marginBottom: spacing.md,
    },
    errorText: { color: colors.high, fontSize: 13, flex: 1, lineHeight: 18 },

    // ── Primary action button ──
    primaryBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, ...shadows.accent,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },

    // ── Results ──
    resultsHeader: {
      flexDirection: "row", justifyContent: "space-between",
      alignItems: "center", marginBottom: spacing.md,
    },
    resultsMeta:     { flex: 1 },
    resultsTitle:    { fontSize: 17, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.2 },
    resultsSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    selectAllBtn:    { padding: 4 },
    selectAllText:   { fontSize: 13, color: colors.accent, fontWeight: "700" },

    taskRow: {
      flexDirection: "row", alignItems: "flex-start",
      backgroundColor: colors.bgCard, borderRadius: radius.md,
      padding: spacing.md, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, gap: 12,
    },
    taskRowDeselected: { opacity: 0.35 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
      borderColor: colors.border, alignItems: "center", justifyContent: "center", marginTop: 1,
    },
    checkboxSelected:  { backgroundColor: colors.accent, borderColor: colors.accent },
    taskContent:       { flex: 1 },
    taskTitle:         { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 },
    taskTitleDeselected: { color: colors.textMuted },
    taskMeta:          { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    metaChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
    },
    metaText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
    taskDesc: { fontSize: 11, color: colors.textMuted, marginTop: 5, fontStyle: "italic", lineHeight: 15 },

    importFooter: {
      flexDirection: "row", gap: spacing.sm,
      marginTop: spacing.md, alignItems: "center",
    },
    backBtn2: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 14, paddingHorizontal: spacing.md,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    },
    backBtn2Text: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
    importBtn: {
      flex: 1, backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8, ...shadows.accent,
    },
    importBtnDisabled: { opacity: 0.45 },
    importBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },

    // ── Success ──
    successWrap: {
      flex: 1, alignItems: "center", justifyContent: "center",
      paddingHorizontal: spacing.xl, paddingTop: 60,
    },
    successRing: {
      width: 88, height: 88, borderRadius: 44,
      borderWidth: 2, borderColor: "#5CFF8F",
      backgroundColor: "rgba(92,255,143,0.1)",
      alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
    },
    successTitle: {
      fontSize: 26, fontWeight: "800", color: colors.textPrimary,
      textAlign: "center", letterSpacing: -0.5, marginBottom: 10,
    },
    successSubtitle: {
      ...typography.body, color: colors.textSecondary,
      textAlign: "center", lineHeight: 22, marginBottom: spacing.xl,
    },
    doneBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, paddingHorizontal: spacing.xl,
      flexDirection: "row", alignItems: "center", gap: 10, ...shadows.accent,
    },
    doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });

const PRIORITY_COLORS = { HIGH: "#FF5C5C", MEDIUM: "#FFB347", LOW: "#5CFF8F" };

// ─────────────────────────────────────────────────────────────
// Shared task results list
// ─────────────────────────────────────────────────────────────
const TaskResultsList = ({
  parsedTasks, selectedTasks, toggleTask, toggleAll,
  importing, handleImport, onBack, styles, colors,
}) => (
  <>
    <View style={styles.resultsHeader}>
      <View style={styles.resultsMeta}>
        <Text style={styles.resultsTitle}>{parsedTasks.length} assignments found</Text>
        <Text style={styles.resultsSubtitle}>Tap any to deselect</Text>
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
          activeOpacity={0.75}
        >
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Feather name="check" size={11} color="#fff" />}
          </View>
          <View style={styles.taskContent}>
            <Text style={[styles.taskTitle, !selected && styles.taskTitleDeselected]} numberOfLines={2}>
              {task.title}
            </Text>
            <View style={styles.taskMeta}>
              {task.dueDate && (
                <View style={styles.metaChip}>
                  <Feather name="calendar" size={10} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    {format(task.dueDate, "MMM d")}
                    {task.dueTime ? `  ${task.dueTime}` : ""}
                  </Text>
                </View>
              )}
              {task.className && (
                <View style={styles.metaChip}>
                  <Feather name="book" size={10} color={colors.textMuted} />
                  <Text style={styles.metaText} numberOfLines={1}>{task.className}</Text>
                </View>
              )}
              <View style={[styles.metaChip, { borderColor: pColor + "55", backgroundColor: pColor + "15" }]}>
                <Text style={[styles.metaText, { color: pColor }]}>{task.priority}</Text>
              </View>
            </View>
            {task.description ? (
              <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    })}

    <View style={styles.importFooter}>
      <TouchableOpacity style={styles.backBtn2} onPress={onBack}>
        <Feather name="arrow-left" size={14} color={colors.textSecondary} />
        <Text style={styles.backBtn2Text}>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.importBtn, (importing || selectedTasks.size === 0) && styles.importBtnDisabled]}
        onPress={handleImport}
        disabled={importing || selectedTasks.size === 0}
      >
        {importing
          ? <ActivityIndicator size={16} color="#fff" />
          : <Feather name="download" size={16} color="#fff" />}
        <Text style={styles.importBtnText}>
          {importing
            ? "Importing..."
            : `Add ${selectedTasks.size} task${selectedTasks.size !== 1 ? "s" : ""}`}
        </Text>
      </TouchableOpacity>
    </View>
  </>
);

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────
const SyllabusParserScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles     = makeStyles(colors);
  const { createManyTasks }    = useTasks();
  const { profile }            = useUserProfile();
  const classes                = profile?.classes ?? [];

  const [activeTab, setActiveTab] = useState("ics");

  // Shared
  const [parsedTasks,   setParsedTasks]   = useState(null);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [importing,     setImporting]     = useState(false);
  const [error,         setError]         = useState(null);
  const [importDone,    setImportDone]    = useState(false);
  const [importCount,   setImportCount]   = useState(0);

  // Syllabus tab
  const [syllabusText,   setSyllabusText]   = useState("");
  const [selectedClass,  setSelectedClass]  = useState(null);
  const [parsing,        setParsing]        = useState(false);

  // ICS tab
  const [icsFileName,    setIcsFileName]    = useState(null);
  const [icsEventCount,  setIcsEventCount]  = useState(0);
  const [icsText,        setIcsText]        = useState(null);
  const [icsLoading,     setIcsLoading]     = useState(false);
  const [icsUrl,         setIcsUrl]         = useState("");
  const [urlInputFocused, setUrlInputFocused] = useState(false);

  // ── Shared helpers ────────────────────────────────────────
  const toggleTaskItem = (idx) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTasks.size === parsedTasks.length) setSelectedTasks(new Set());
    else setSelectedTasks(new Set(parsedTasks.map((_, i) => i)));
  };

  const handleImport = async () => {
    if (selectedTasks.size === 0) { setError("Select at least one task to import."); return; }
    setImporting(true); setError(null);
    try {
      const toImport = parsedTasks
        .filter((_, i) => selectedTasks.has(i))
        .map((t) => ({
          ...t,
          dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : null),
        }));
      await createManyTasks(toImport);
      setImportCount(toImport.length);
      setImportDone(true);
    } catch {
      setError("Failed to import tasks. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const resetResults = () => { setParsedTasks(null); setError(null); };

  const switchTab = (tab) => {
    setActiveTab(tab);
    resetResults();
  };

  // ── Syllabus tab ─────────────────────────────────────────
  const handleParse = async () => {
    if (!syllabusText.trim()) { setError("Please paste your syllabus text first."); return; }
    setError(null); setParsing(true); setParsedTasks(null);
    try {
      const className = selectedClass?.name ?? null;
      const semesterLabel = profile?.semester ?? null;
      const tasks = await parseSyllabusText(syllabusText, className, semesterLabel);
      if (tasks.length === 0) {
        setError("No upcoming assignments found. Try pasting just the assignments or schedule section.");
        return;
      }
      setParsedTasks(tasks);
      setSelectedTasks(new Set(tasks.map((_, i) => i)));
    } catch (err) {
      setError(err.message ?? "Parsing failed. Please try again.");
    } finally {
      setParsing(false);
    }
  };

  // ── ICS tab ───────────────────────────────────────────────
  const handleFetchUrl = async () => {
    const url = icsUrl.trim();
    if (!url) { setError("Paste your Canvas calendar feed URL first."); return; }
    setIcsLoading(true); setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) {
        setError("That URL didn't return a valid calendar file. Make sure you copied the full feed URL from Canvas, not the calendar page URL.");
        setIcsLoading(false);
        return;
      }
      const eventCount = countIcsEvents(text);
      setIcsFileName("Canvas Calendar Feed");
      setIcsEventCount(eventCount);
      setIcsText(text);
    } catch (err) {
      setError("Couldn't load that URL. Check your internet connection and make sure the URL starts with https://. If it starts with webcal://, replace that part with https://");
    } finally {
      setIcsLoading(false);
    }
  };

  const handlePickFile = async () => {
    setIcsLoading(true); setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setIcsLoading(false);
        return;
      }

      const asset = result.assets[0];
      const name  = asset.name ?? "calendar.ics";

      // Read the file
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!isValidIcs(text)) {
        setError("This doesn't look like a valid .ics calendar file. Make sure you exported a calendar feed, not a webpage.");
        setIcsLoading(false);
        return;
      }

      const eventCount = countIcsEvents(text);
      setIcsFileName(name);
      setIcsEventCount(eventCount);
      setIcsText(text);
    } catch (err) {
      setError("Couldn't read the file. Try saving it to Files first, then pick it from there.");
    } finally {
      setIcsLoading(false);
    }
  };

  const handleParseIcs = () => {
    if (!icsText) { setError("Please pick a .ics file first."); return; }
    setError(null);
    try {
      const tasks = parseIcsText(icsText);
      if (tasks.length === 0) {
        setError("No upcoming assignments found in this calendar file. The file may only contain past events or class sessions without assignments.");
        return;
      }
      setParsedTasks(tasks);
      setSelectedTasks(new Set(tasks.map((_, i) => i)));
    } catch {
      setError("Couldn't parse this file. Please try exporting your calendar again.");
    }
  };

  // ── Success screen ────────────────────────────────────────
  if (importDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successRing}>
            <Feather name="check" size={36} color="#5CFF8F" />
          </View>
          <Text style={styles.successTitle}>
            {importCount} task{importCount !== 1 ? "s" : ""} added!
          </Text>
          <Text style={styles.successSubtitle}>
            Your semester is loaded. The AI now has your full schedule to plan around.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Import Tasks</Text>
          <Text style={styles.headerSubtitle}>Set up your semester in seconds</Text>
        </View>
        <View style={styles.aiBadge}>
          <Feather name="cpu" size={11} color={colors.accent} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[
          { key: "ics",      icon: "calendar",  label: "Calendar File" },
          { key: "syllabus", icon: "file-text", label: "Syllabus Text" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => switchTab(t.key)}
          >
            <Feather
              name={t.icon} size={15}
              color={activeTab === t.key ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════════ SYLLABUS TAB ══════════════ */}
        {activeTab === "syllabus" && (
          !parsedTasks ? (
            <>
              <View style={styles.infoCard}>
                <Feather name="info" size={14} color={colors.accent} />
                <Text style={styles.infoText}>
                  Paste your syllabus below — or just the assignments section. The AI extracts every deadline automatically.
                </Text>
              </View>

              {classes.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Which class? (optional)</Text>
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

              <View style={styles.field}>
                <Text style={styles.label}>Paste syllabus text</Text>
                <TextInput
                  style={styles.syllabusInput}
                  placeholder={"Paste your full syllabus here...\n\nTip: Even just the 'Assignments' section works."}
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
                style={[styles.primaryBtn, (parsing || !syllabusText.trim()) && styles.primaryBtnDisabled]}
                onPress={handleParse}
                disabled={parsing || !syllabusText.trim()}
              >
                {parsing
                  ? <><ActivityIndicator size={16} color="#fff" /><Text style={styles.primaryBtnText}>Analyzing...</Text></>
                  : <><Feather name="cpu" size={16} color="#fff" /><Text style={styles.primaryBtnText}>Extract Tasks with AI</Text></>
                }
              </TouchableOpacity>
            </>
          ) : (
            <TaskResultsList
              parsedTasks={parsedTasks} selectedTasks={selectedTasks}
              toggleTask={toggleTaskItem} toggleAll={toggleAll}
              importing={importing} handleImport={handleImport}
              onBack={resetResults} styles={styles} colors={colors}
            />
          )
        )}

        {/* ══════════════ ICS TAB ══════════════ */}
        {activeTab === "ics" && (
          !parsedTasks ? (
            <>
              {/* Primary method: paste URL */}
              <View style={styles.infoCard}>
                <Feather name="zap" size={14} color={colors.accent} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoLink}>Easiest way: </Text>
                  Get your Canvas feed URL and paste it below — no file download needed.
                </Text>
              </View>

              <Text style={styles.label}>Paste your Canvas calendar feed URL</Text>
              <View style={[styles.urlInputWrap, urlInputFocused && styles.urlInputWrapActive]}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="https://canvas.instructure.com/feeds/calendars/..."
                  placeholderTextColor={colors.textMuted}
                  value={icsUrl}
                  onChangeText={(v) => { setIcsUrl(v); setError(null); }}
                  onFocus={() => setUrlInputFocused(true)}
                  onBlur={() => setUrlInputFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[styles.urlFetchBtn, (icsLoading || !icsUrl.trim()) && { opacity: 0.5 }]}
                  onPress={handleFetchUrl}
                  disabled={icsLoading || !icsUrl.trim()}
                >
                  {icsLoading
                    ? <ActivityIndicator size={14} color="#fff" />
                    : <Feather name="download-cloud" size={14} color="#fff" />}
                  <Text style={styles.urlFetchBtnText}>{icsLoading ? "Loading..." : "Import"}</Text>
                </TouchableOpacity>
              </View>

              {/* How to get the URL */}
              <View style={styles.stepsCard}>
                <Text style={styles.stepsTitle}>How to get your Canvas feed URL</Text>
                {[
                  { n: "1", text: "Open the Canvas Student app on your phone" },
                  { n: "2", text: "Tap the hamburger menu (☰) in the top left, then tap Settings" },
                  { n: "3", text: "Tap \"Subscribe to Calendar Feed\" — this shows you the URL" },
                  { n: "4", text: "Long-press the URL and copy it, then paste it in the box above" },
                ].map((s) => (
                  <View key={s.n} style={styles.step}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                    <Text style={styles.stepText}>{s.text}</Text>
                  </View>
                ))}
                <View style={[styles.infoCard, { marginTop: 10, marginBottom: 0 }]}>
                  <Feather name="monitor" size={13} color={colors.accent} />
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLink}>On desktop: </Text>
                    Canvas → Calendar → "Calendar Feed" link (bottom right of sidebar) → copy the URL shown in the popup.
                    {"\n"}If the URL starts with <Text style={styles.infoLink}>webcal://</Text>, replace that with <Text style={styles.infoLink}>https://</Text> before pasting.
                  </Text>
                </View>
              </View>

              {/* OR divider */}
              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR PICK A FILE</Text>
                <View style={styles.orLine} />
              </View>

              {/* File picker fallback */}
              {icsFileName ? (
                <View style={styles.fileLoaded}>
                  <View style={styles.fileLoadedIcon}>
                    <Feather name="calendar" size={20} color="#5CFF8F" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{icsFileName}</Text>
                    <Text style={styles.fileEventCount}>{icsEventCount} events in file</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setIcsFileName(null); setIcsText(null); setIcsUrl(""); }} style={styles.fileChangeBtn}>
                    <Feather name="x" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.dropZone, icsLoading && styles.dropZoneActive]}
                  onPress={handlePickFile}
                  disabled={icsLoading}
                  activeOpacity={0.75}
                >
                  <View style={styles.dropIcon}>
                    {icsLoading
                      ? <ActivityIndicator size={20} color={colors.accent} />
                      : <Feather name="upload" size={22} color={colors.textMuted} />}
                  </View>
                  <Text style={styles.dropTitle}>{icsLoading ? "Reading file..." : "Pick a .ics file"}</Text>
                  <Text style={styles.dropSub}>If you have an .ics file saved to your phone, pick it here</Text>
                  {!icsLoading && (
                    <View style={styles.dropBtn}>
                      <Feather name="folder" size={13} color="#fff" />
                      <Text style={styles.dropBtnText}>Browse Files</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Also works with */}
              <Text style={[styles.label, { marginTop: spacing.sm, marginBottom: 8 }]}>Also works with</Text>
              <View style={styles.sourcesRow}>
                {[
                  { icon: "calendar", label: "Google Cal" },
                  { icon: "smartphone", label: "Apple Cal" },
                  { icon: "briefcase", label: "Outlook" },
                ].map((s) => (
                  <View key={s.label} style={styles.sourceChip}>
                    <Feather name={s.icon} size={13} color={colors.textMuted} />
                    <Text style={styles.sourceText}>{s.label}</Text>
                  </View>
                ))}
              </View>

              {error && (
                <View style={styles.errorRow}>
                  <Feather name="alert-circle" size={14} color={colors.high} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (!icsText || icsLoading) && styles.primaryBtnDisabled]}
                onPress={handleParseIcs}
                disabled={!icsText || icsLoading}
              >
                <Feather name="calendar" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {icsText ? `Parse ${icsEventCount} Events` : "Load calendar first"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TaskResultsList
              parsedTasks={parsedTasks} selectedTasks={selectedTasks}
              toggleTask={toggleTaskItem} toggleAll={toggleAll}
              importing={importing} handleImport={handleImport}
              onBack={resetResults} styles={styles} colors={colors}
            />
          )
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default SyllabusParserScreen;