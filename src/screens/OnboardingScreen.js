// ============================================================
// src/screens/OnboardingScreen.js
// Changes:
//   - REMOVED: "Start 14-Day Trial" button text
//   - Final step CTA is now "Get Started" (no trial language)
//   - ADDED: Step 4 — import your semester (syllabus or ICS)
//     This is the "aha moment" step. Student can skip it.
//   - Step count goes from 4 to 5 (new import step at end)
//   - Import step has "Skip for now" so it's never a blocker
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { saveUserProfile } from "../services/firebase";
import { parseSyllabusText } from "../services/syllabusParser";
import {
  parseIcsText,
  isValidIcs,
  countIcsEvents,
} from "../services/icsImport";

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    progressBar: {
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    progressSegment: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    progressSegmentActive: { backgroundColor: colors.accent },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    brandName: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },

    scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    stepContainer: { paddingTop: spacing.md },
    stepTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    stepSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 0.8,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
      marginBottom: 4,
    },
    optionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionBtnSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
    },
    optionText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    optionTextSelected: { color: colors.accent, fontWeight: "700" },
    classCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    classCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    classCardLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    subLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: 10,
      marginBottom: 6,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chipSm: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgInput,
    },
    chipSmSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
    },
    chipSmText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    chipSmTextSelected: { color: colors.accent },
    addClassBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 12,
      justifyContent: "center",
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.accent,
      borderRadius: radius.md,
    },
    addClassText: { color: colors.accent, fontWeight: "600", fontSize: 14 },

    bottomNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
    },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4 },
    backBtnText: { color: colors.textSecondary, fontSize: 15 },
    nextBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 13,
      paddingHorizontal: spacing.lg,
      ...shadows.accent,
    },
    nextBtnDisabled: { opacity: 0.4 },
    nextBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

    // ── Import step styles ─────────────────────────────────
    importHero: {
      alignItems: "center",
      paddingVertical: spacing.lg,
    },
    importHeroIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accentGlow,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      ...shadows.accent,
    },
    importTabRow: {
      flexDirection: "row",
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      overflow: "hidden",
    },
    importTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
    },
    importTabActive: { backgroundColor: colors.accent },
    importTabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    importTabTextActive: { color: "#fff" },

    syllabusInput: {
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 14,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 140,
      textAlignVertical: "top",
      marginBottom: spacing.sm,
    },
    parseBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...shadows.accent,
      marginBottom: spacing.sm,
    },
    parseBtnDisabled: { opacity: 0.45 },
    parseBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

    infoCard: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: colors.accentGlow,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.accent,
      marginBottom: spacing.md,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    infoLink: { color: colors.accent, fontWeight: "700" },
    urlInputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingLeft: 14,
      marginBottom: spacing.sm,
    },
    urlInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: 12,
      paddingRight: 12,
    },
    fetchBtn: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    fetchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    orRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginVertical: 10,
    },
    orLine: { flex: 1, height: 1, backgroundColor: colors.border },
    orText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
    pickFileBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: 14,
      marginBottom: spacing.sm,
    },
    pickFileBtnText: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "600",
    },
    stepsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    stepsTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    stepRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
      alignItems: "flex-start",
    },
    stepNum: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumText: { fontSize: 9, fontWeight: "800", color: colors.accent },
    stepText: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 17,
    },

    // Parsed tasks preview
    parsedPreview: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.low,
      marginBottom: spacing.sm,
    },
    parsedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: spacing.sm,
    },
    parsedTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
      flex: 1,
    },
    parsedItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    parsedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    parsedText: { fontSize: 13, color: colors.textPrimary, flex: 1 },

    // Error
    errorRow: {
      flexDirection: "row",
      gap: 6,
      alignItems: "flex-start",
      backgroundColor: "rgba(255,92,92,0.08)",
      padding: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.high,
      marginBottom: spacing.sm,
    },
    errorText: { color: colors.high, fontSize: 12, flex: 1, lineHeight: 17 },

    skipBtn: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    skipBtnText: { color: colors.textMuted, fontSize: 14 },
  });

// ── Dynamic semester generation ───────────────────────────────
const generateSemesters = () => {
  const now = new Date();
  const year = now.getFullYear();
  const results = [];
  for (let y = year; y <= year + 2; y++) {
    const seasons = [
      { name: `Spring ${y}`, startMonth: 0 },
      { name: `Summer ${y}`, startMonth: 4 },
      { name: `Fall ${y}`, startMonth: 7 },
    ];
    seasons.forEach(({ name, startMonth }) => {
      const monthsAgo =
        (now.getFullYear() - y) * 12 + (now.getMonth() - startMonth);
      if (monthsAgo <= 3) results.push(name);
    });
  }
  return [...new Set(results)].slice(0, 8);
};

const SEMESTERS = generateSemesters();
const WORK_TIMES = [
  "Morning (6am–12pm)",
  "Afternoon (12pm–5pm)",
  "Evening (5pm–9pm)",
  "Night (9pm+)",
];
const GRADES = ["A", "B", "C", "D", "Not sure"];
const CREDIT_OPTS = ["1", "2", "3", "4", "5+"];
const STEP_COUNT = 5; // was 4, added import step

const LIFESTYLE_OPTIONS = [
  { id: "student", label: "📚 Academics", desc: "Classes, assignments, exams" },
  {
    id: "fitness",
    label: "💪 Fitness & Health",
    desc: "Gym, workouts, nutrition",
  },
  { id: "work", label: "💼 Work / Career", desc: "Job, freelance, internship" },
  {
    id: "personal",
    label: "🌱 Personal Growth",
    desc: "Hobbies, reading, side projects",
  },
  { id: "social", label: "🤝 Social", desc: "Friends, family, events" },
  { id: "finance", label: "💰 Finance", desc: "Budgeting, bills, savings" },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// ── Import Step Sub-component ─────────────────────────────────
const ImportStep = ({ onImported, onClassDetected, styles, colors }) => {
  const { createManyTasks } = useTasks();
  const [activeTab, setActiveTab] = useState("ics");
  const [syllabusText, setSyllabusText] = useState("");
  const [manualClassName, setManualClassName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsLoading, setIcsLoading] = useState(false);
  const [icsText, setIcsText] = useState(null);
  const [icsEventCount, setIcsEventCount] = useState(0);
  const [parsedTasks, setParsedTasks] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const handleParseSyllabus = async () => {
    if (!syllabusText.trim()) return;
    setError(null);
    setParsing(true);
    try {
      const className = manualClassName.trim() || null;
      const tasks = await parseSyllabusText(syllabusText, className);
      if (tasks.length === 0) {
        setError(
          "No assignments found. Try pasting just the schedule section."
        );
        return;
      }
      setParsedTasks(tasks);
    } catch (err) {
      setError(err.message ?? "Parsing failed. Try again.");
    } finally {
      setParsing(false);
    }
  };

  const handleFetchUrl = async () => {
    const url = icsUrl.trim();
    if (!url) return;
    setIcsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) {
        setError(
          "That URL didn't return a valid calendar. Make sure you copied the full feed URL from Canvas."
        );
        setIcsLoading(false);
        return;
      }
      const count = countIcsEvents(text);
      setIcsText(text);
      setIcsEventCount(count);
    } catch {
      setError(
        "Couldn't load that URL. Make sure it starts with https:// — replace webcal:// if needed."
      );
    } finally {
      setIcsLoading(false);
    }
  };

  const handlePickFile = async () => {
    setIcsLoading(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        setIcsLoading(false);
        return;
      }
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!isValidIcs(text)) {
        setError("This doesn't look like a valid .ics file.");
        setIcsLoading(false);
        return;
      }
      setIcsText(text);
      setIcsEventCount(countIcsEvents(text));
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setIcsLoading(false);
    }
  };

  const handleParseIcs = () => {
    if (!icsText) return;
    setError(null);
    try {
      const tasks = parseIcsText(icsText);
      if (tasks.length === 0) {
        setError("No upcoming assignments found in this calendar.");
        return;
      }
      setParsedTasks(tasks);
    } catch {
      setError("Couldn't parse this file. Try exporting again.");
    }
  };

  const handleImport = async () => {
    if (!parsedTasks?.length) return;
    setImporting(true);
    setError(null);
    try {
      const toImport = parsedTasks.map((t) => ({
        ...t,
        dueDate:
          t.dueDate instanceof Date
            ? t.dueDate
            : t.dueDate
            ? new Date(t.dueDate)
            : null,
      }));
      await createManyTasks(toImport);
      setImportCount(toImport.length);
      setImportDone(true);
      onImported(toImport.length);
      if (manualClassName.trim() && onClassDetected) {
        onClassDetected(manualClassName.trim());
      }
    } catch {
      setError("Import failed. You can try again from the dashboard.");
    } finally {
      setImporting(false);
    }
  };

  if (importDone) {
    return (
      <View style={[styles.importHero, { paddingVertical: spacing.xl }]}>
        <View
          style={[
            styles.importHeroIcon,
            {
              borderColor: "#5CFF8F",
              backgroundColor: "rgba(92,255,143,0.12)",
            },
          ]}
        >
          <Feather name="check" size={32} color="#5CFF8F" />
        </View>
        <Text style={[styles.stepTitle, { textAlign: "center" }]}>
          {importCount} tasks added!
        </Text>
        <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
          The AI now has your full semester to plan around.
        </Text>
      </View>
    );
  }

  if (parsedTasks) {
    return (
      <View>
        <View style={styles.parsedPreview}>
          <View style={styles.parsedHeader}>
            <Feather name="check-circle" size={16} color="#5CFF8F" />
            <Text style={styles.parsedTitle}>
              {parsedTasks.length} assignments found
            </Text>
          </View>
          {parsedTasks.slice(0, 5).map((t, i) => (
            <View key={i} style={styles.parsedItem}>
              <View style={styles.parsedDot} />
              <Text style={styles.parsedText} numberOfLines={1}>
                {t.title}
              </Text>
            </View>
          ))}
          {parsedTasks.length > 5 && (
            <Text
              style={[
                styles.stepText,
                { color: colors.textMuted, marginTop: 6 },
              ]}
            >
              + {parsedTasks.length - 5} more
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.parseBtn, importing && styles.parseBtnDisabled]}
          onPress={handleImport}
          disabled={importing}
        >
          {importing ? (
            <ActivityIndicator size={15} color="#fff" />
          ) : (
            <Feather name="download" size={15} color="#fff" />
          )}
          <Text style={styles.parseBtnText}>
            {importing ? "Importing..." : `Add all ${parsedTasks.length} tasks`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setParsedTasks(null)}
          style={styles.skipBtn}
        >
          <Text style={styles.skipBtnText}>← Try a different method</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Tabs */}
      <View style={styles.importTabRow}>
        {[
          { key: "ics", icon: "calendar", label: "Calendar" },
          { key: "syllabus", icon: "file-text", label: "Syllabus" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.importTab,
              activeTab === t.key && styles.importTabActive,
            ]}
            onPress={() => {
              setActiveTab(t.key);
              setError(null);
            }}
          >
            <Feather
              name={t.icon}
              size={14}
              color={activeTab === t.key ? "#fff" : colors.textMuted}
            />
            <Text
              style={[
                styles.importTabText,
                activeTab === t.key && styles.importTabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Syllabus tab */}
      {activeTab === "syllabus" && (
        <>
          <View style={styles.infoCard}>
            <Feather name="info" size={13} color={colors.accent} />
            <Text style={styles.infoText}>
              Paste your syllabus below — or just the assignments section. The
              AI extracts every deadline automatically.
            </Text>
          </View>

          <View style={{ marginBottom: spacing.sm }}>
            <Text style={styles.fieldLabel}>CLASS NAME (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HIST 201 — World History"
              placeholderTextColor={colors.textMuted}
              value={manualClassName}
              onChangeText={setManualClassName}
            />
          </View>

          <TextInput
            style={styles.syllabusInput}
            placeholder={
              "Paste your syllabus here…\n\nEven just the assignments section works."
            }
            placeholderTextColor={colors.textMuted}
            value={syllabusText}
            onChangeText={(v) => {
              setSyllabusText(v);
              setError(null);
            }}
            multiline
            textAlignVertical="top"
          />

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={colors.high} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.parseBtn,
              (parsing || !syllabusText.trim()) && styles.parseBtnDisabled,
            ]}
            onPress={handleParseSyllabus}
            disabled={parsing || !syllabusText.trim()}
          >
            {parsing ? (
              <ActivityIndicator size={15} color="#fff" />
            ) : (
              <Feather name="cpu" size={15} color="#fff" />
            )}
            <Text style={styles.parseBtnText}>
              {parsing ? "Analyzing..." : "Extract Tasks with AI"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Calendar / ICS tab */}
      {activeTab === "ics" && (
        <>
          <View style={styles.infoCard}>
            <Feather name="zap" size={13} color={colors.accent} />
            <Text style={styles.infoText}>
              <Text style={styles.infoLink}>Paste your Canvas feed URL </Text>
              for the fastest setup — no file download needed.
            </Text>
          </View>

          <View style={styles.urlInputWrap}>
            <TextInput
              style={styles.urlInput}
              placeholder="https://canvas.instructure.com/feeds/calendars/..."
              placeholderTextColor={colors.textMuted}
              value={icsUrl}
              onChangeText={(v) => {
                setIcsUrl(v);
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[
                styles.fetchBtn,
                (icsLoading || !icsUrl.trim()) && { opacity: 0.5 },
              ]}
              onPress={handleFetchUrl}
              disabled={icsLoading || !icsUrl.trim()}
            >
              {icsLoading ? (
                <ActivityIndicator size={13} color="#fff" />
              ) : (
                <Feather name="download-cloud" size={13} color="#fff" />
              )}
              <Text style={styles.fetchBtnText}>
                {icsLoading ? "Loading..." : "Import"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How to get your Canvas URL</Text>
            {[
              "Open the Canvas Student app on your phone",
              "Tap ☰ menu → Settings",
              'Tap "Subscribe to Calendar Feed" — copy that URL',
              "Paste it in the box above",
            ].map((text, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR PICK A FILE</Text>
            <View style={styles.orLine} />
          </View>

          <TouchableOpacity
            style={[styles.pickFileBtn, icsLoading && { opacity: 0.5 }]}
            onPress={handlePickFile}
            disabled={icsLoading}
          >
            <Feather name="upload" size={15} color={colors.textMuted} />
            <Text style={styles.pickFileBtnText}>
              {icsText
                ? `✓ ${icsEventCount} events loaded`
                : "Pick a .ics file from Files"}
            </Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={colors.high} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {icsText && (
            <TouchableOpacity
              style={[styles.parseBtn, icsLoading && styles.parseBtnDisabled]}
              onPress={handleParseIcs}
              disabled={icsLoading}
            >
              <Feather name="calendar" size={15} color="#fff" />
              <Text style={styles.parseBtnText}>
                Parse {icsEventCount} Events
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

// ── Main Onboarding Screen ────────────────────────────────────
const OnboardingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const isEditing = !!profile?.onboardingComplete;

  const [step, setStepp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Alias to avoid conflict with imported step in stepsCard
  const step_n = step;
  const setStep = setStepp;

  // Step 0 — identity
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(null);

  // Step 1 — classes
  const [classes, setClasses] = useState([
    { id: generateId(), name: "", creditHours: "3", grade: "B" },
  ]);

  // Step 2 — work time preferences
  const [workTime, setWorkTime] = useState(null);
  const [hardestClass, setHardestClass] = useState(null);

  // Step 3 — lifestyle goals
  const [lifestyleGoals, setLifestyleGoals] = useState([]);

  // Pre-fill when editing
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSemester(profile.semester ?? null);
      setClasses(
        profile.classes?.length
          ? profile.classes.map((c) => ({
              ...c,
              creditHours: String(c.creditHours ?? 3),
            }))
          : [{ id: generateId(), name: "", creditHours: "3", grade: "B" }]
      );
      setWorkTime(profile.preferredWorkTime ?? null);
      setHardestClass(profile.hardestClass ?? null);
    }
  }, []);

  const handleClassDetected = (name) => {
    setClasses((prev) => {
      if (prev.length === 1 && !prev[0].name.trim()) {
        return [{ ...prev[0], name }];
      }
      if (!prev.some((c) => c.name.trim() === name)) {
        return [...prev, { id: generateId(), name, creditHours: "3", grade: "B" }];
      }
      return prev;
    });
  };

  const addClass = () =>
    setClasses((p) => [
      ...p,
      { id: generateId(), name: "", creditHours: "3", grade: "B" },
    ]);
  const removeClass = (id) => setClasses((p) => p.filter((c) => c.id !== id));
  const updateClass = (id, field, value) =>
    setClasses((p) =>
      p.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );

  const canAdvance = () => {
    if (step_n === 0) return !!semester;
    if (step_n === 1) return true; // import optional
    if (step_n === 2) return true; // classes optional
    if (step_n === 3) return !!workTime;
    if (step_n === 4) return true; // lifestyle goals optional
    return false;
  };

  const handleNext = () => {
    if (step_n < STEP_COUNT - 1) setStep(step_n + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const data = {
        name: name.trim() || null,
        semester,
        classes: classes.filter((c) => c.name.trim()).map((c) => ({
          id: c.id,
          name: c.name.trim(),
          creditHours: parseInt(c.creditHours) || 3,
          grade: c.grade,
        })),
        preferredWorkTime: workTime,
        hardestClass: hardestClass ?? null,
        lifestyleGoals:
          lifestyleGoals.length > 0 ? lifestyleGoals : ["student"],
        onboardingComplete: true,
      };
      if (!isEditing) {
        data.isPro = false;
        data.createdAt = new Date().toISOString();
      }
      await saveUserProfile(user.uid, data);
      if (isEditing && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace("Main");
      }
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  // ── Step renderers ─────────────────────────────────────────

  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Let's get you set up</Text>
      <Text style={styles.stepSubtitle}>
        This helps the AI personalize your schedule.
      </Text>

      <Text style={styles.fieldLabel}>YOUR NAME (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
        CURRENT SEMESTER
      </Text>
      {SEMESTERS.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.optionBtn, semester === s && styles.optionBtnSelected]}
          onPress={() => setSemester(s)}
        >
          <Text
            style={[
              styles.optionText,
              semester === s && styles.optionTextSelected,
            ]}
          >
            {s}
          </Text>
          {semester === s && (
            <Feather name="check" size={16} color={colors.accent} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Add your classes</Text>
      <Text style={styles.stepSubtitle}>
        Optional — but helps the AI weight recommendations by difficulty and credit hours. You can also add classes later in your profile.
      </Text>

      {classes.map((cls, idx) => (
        <View key={cls.id} style={styles.classCard}>
          <View style={styles.classCardHeader}>
            <Text style={styles.classCardLabel}>Class {idx + 1}</Text>
            {classes.length > 1 && (
              <TouchableOpacity onPress={() => removeClass(cls.id)}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. HIST 201 — World History"
            placeholderTextColor={colors.textMuted}
            value={cls.name}
            onChangeText={(v) => updateClass(cls.id, "name", v)}
          />
          <Text style={styles.subLabel}>Credit Hours</Text>
          <View style={styles.chipRow}>
            {CREDIT_OPTS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chipSm,
                  cls.creditHours === c && styles.chipSmSelected,
                ]}
                onPress={() => updateClass(cls.id, "creditHours", c)}
              >
                <Text
                  style={[
                    styles.chipSmText,
                    cls.creditHours === c && styles.chipSmTextSelected,
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.subLabel}>Current Grade</Text>
          <View style={styles.chipRow}>
            {GRADES.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.chipSm,
                  cls.grade === g && styles.chipSmSelected,
                ]}
                onPress={() => updateClass(cls.id, "grade", g)}
              >
                <Text
                  style={[
                    styles.chipSmText,
                    cls.grade === g && styles.chipSmTextSelected,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addClassBtn} onPress={addClass}>
        <Feather name="plus" size={16} color={colors.accent} />
        <Text style={styles.addClassText}>Add Another Class</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>When do you work best?</Text>
      <Text style={styles.stepSubtitle}>
        We'll schedule your hardest tasks during your peak hours.
      </Text>

      {WORK_TIMES.map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.optionBtn, workTime === t && styles.optionBtnSelected]}
          onPress={() => setWorkTime(t)}
        >
          <Text
            style={[
              styles.optionText,
              workTime === t && styles.optionTextSelected,
            ]}
          >
            {t}
          </Text>
          {workTime === t && (
            <Feather name="check" size={16} color={colors.accent} />
          )}
        </TouchableOpacity>
      ))}

      {classes.filter((c) => c.name.trim()).length > 0 && (
        <>
          <Text style={[styles.stepSubtitle, { marginTop: spacing.lg }]}>
            Which class do you struggle with most? (optional)
          </Text>
          <View style={styles.chipRow}>
            {classes
              .filter((c) => c.name.trim())
              .map((cls) => (
                <TouchableOpacity
                  key={cls.id}
                  style={[
                    styles.chipSm,
                    hardestClass === cls.id && styles.chipSmSelected,
                  ]}
                  onPress={() =>
                    setHardestClass(hardestClass === cls.id ? null : cls.id)
                  }
                >
                  <Text
                    style={[
                      styles.chipSmText,
                      hardestClass === cls.id && styles.chipSmTextSelected,
                    ]}
                  >
                    {cls.name.trim()}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What do you want to track?</Text>
      <Text style={styles.stepSubtitle}>
        Pick everything that applies. The AI will balance all of these, not just
        school.
      </Text>
      {LIFESTYLE_OPTIONS.map((opt) => {
        const selected = lifestyleGoals.includes(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.optionBtn, selected && styles.optionBtnSelected]}
            onPress={() =>
              setLifestyleGoals((prev) =>
                prev.includes(opt.id)
                  ? prev.filter((x) => x !== opt.id)
                  : [...prev, opt.id]
              )
            }
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {opt.label}
              </Text>
              <Text
                style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}
              >
                {opt.desc}
              </Text>
            </View>
            {selected && (
              <Feather name="check" size={16} color={colors.accent} />
            )}
          </TouchableOpacity>
        );
      })}
      <Text
        style={{
          fontSize: 11,
          color: colors.textMuted,
          marginTop: spacing.md,
          fontStyle: "italic",
        }}
      >
        You can change this any time in your profile.
      </Text>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.importHero}>
        <View style={styles.importHeroIcon}>
          <Feather name="zap" size={30} color={colors.accent} />
        </View>
        <Text style={[styles.stepTitle, { textAlign: "center" }]}>
          {importedCount > 0 ? "Semester loaded! ✓" : "Load your semester"}
        </Text>
        <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
          {importedCount > 0
            ? `${importedCount} tasks imported. The AI has your full schedule.`
            : "Import from your syllabus or Canvas calendar. You can also skip this and add tasks manually."}
        </Text>
      </View>

      {importedCount === 0 && (
        <ImportStep
          onImported={(count) => setImportedCount(count)}
          onClassDetected={handleClassDetected}
          styles={styles}
          colors={colors}
        />
      )}
    </View>
  );

  const steps = [
    renderStep0, // identity
    renderStep4, // import
    renderStep1, // classes (optional)
    renderStep2, // work time
    renderStep3, // lifestyle
  ];

  const getNextLabel = () => {
    if (saving) return "Saving...";
    if (isEditing && step_n === STEP_COUNT - 1) return "Save Changes";
    if (step_n === STEP_COUNT - 1)
      return importedCount > 0 ? "Get Started →" : "Get Started";
    return "Next";
  };

  const getNextIcon = () => {
    if (saving) return null;
    if (step_n === STEP_COUNT - 1) return "check";
    return "arrow-right";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Progress bar */}
        <View style={styles.progressBar}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= step_n && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>

        {/* Brand row */}
        <View style={styles.brandRow}>
          <Feather name="check-square" size={20} color={colors.accent} />
          <Text style={styles.brandName}>Planora</Text>
          {isEditing ? (
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate("Main");
              }}
              style={{ marginLeft: "auto" }}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {steps[step_n]?.()}
        </ScrollView>

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          {step_n > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep(step_n - 1)}
            >
              <Feather
                name="arrow-left"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canAdvance() && styles.nextBtnDisabled,
              step_n === 0 && { marginLeft: "auto" },
            ]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
          >
            <Text style={styles.nextBtnText}>{getNextLabel()}</Text>
            {!saving && getNextIcon() && (
              <Feather name={getNextIcon()} size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OnboardingScreen;
