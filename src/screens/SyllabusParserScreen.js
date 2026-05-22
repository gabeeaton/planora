// ============================================================
// src/screens/SyllabusParserScreen.js
// Calendar (.ics) import — Canvas, Brightspace, Blackboard, Moodle
// Saved calendar URL for one-click re-sync.
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { parseIcsText, isValidIcs } from "../services/icsImport";
import * as Haptics from "expo-haptics";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../hooks/useAuth";
import { saveUserProfile } from "../services/firebase";
import { track } from "../services/analytics";
// ─────────────────────────────────────────────────────────────
// LMS step content
// ─────────────────────────────────────────────────────────────
const LMS_PLATFORMS = ["Canvas", "Brightspace", "Blackboard", "Moodle"];

const LMS_STEPS = {
  Canvas: {
    steps: [
      "Open the Canvas Student app on your phone",
      "Tap ☰ (top left) → Settings → \"Subscribe to Calendar Feed\"",
      "Copy the URL",
      "Paste the URL in the box above",
    ],
    tip: "On desktop: Canvas → Calendar → \"Calendar Feed\" link (bottom right sidebar) → copy the URL. Replace webcal:// with https:// if needed.",
  },
  Brightspace: {
    steps: [
      "Log in to Brightspace on desktop or mobile browser",
      "Click the calendar icon in the top navigation bar",
      "Click \"Subscribe\" in the top right of the calendar view",
      "Copy the iCal URL and paste it above",
    ],
    tip: "If the URL starts with webcal://, replace that part with https:// before pasting.",
  },
  Blackboard: {
    steps: [
      "Log in to Blackboard and open Calendar from the left menu",
      "Click the settings gear ⚙ in the top right of the calendar",
      "Select \"Get Calendar Feed\" and copy the URL",
      "Paste the URL above",
    ],
    tip: "Replace webcal:// with https:// if needed. Some Blackboard versions call this \"iCal Feed\" instead.",
  },
  Moodle: {
    steps: [
      "Log in to Moodle and navigate to your Calendar",
      "Scroll to the bottom of the calendar page",
      "Click \"Export calendar\" → select \"All events\" → \"Get calendar URL\"",
      "Copy the URL and paste above",
    ],
    tip: "Replace webcal:// with https:// if needed. The export option is at the very bottom of the calendar page.",
  },
};

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
    headerTitle:    { fontSize: 18, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 32 },

    // ── Sync card (saved URL) ──
    syncCard: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.isDark
      ? "rgba(92,255,143,0.07)"
      : "rgba(22,101,52,0.08)",
      borderColor: colors.isDark
    ? "rgba(92,255,143,0.3)"
    : "rgba(22,101,52,1)",
      borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1,
      marginBottom: spacing.sm, gap: 12,
    },
    syncIcon: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: colors.isDark
    ? "rgba(92,255,143,0.12)"
    : "#fff",
      alignItems: "center", justifyContent: "center",
    },
    syncInfo:     { flex: 1 },
    syncTitle:    { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary },
    syncSub:      { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    syncBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md,
      paddingHorizontal: 14, paddingVertical: 8,
    },
    syncBtnText:  { color: "#fff", fontSize: 13, fontFamily: "Outfit-Bold" },
    changeUrlBtn: { alignSelf: "flex-start", marginBottom: spacing.md, marginTop: 2 },
    changeUrlText:{ fontSize: 12, color: colors.textMuted },

    // ── Info card ──
    infoCard: {
      flexDirection: "row", gap: 10, alignItems: "flex-start",
      backgroundColor: colors.accentGlow, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1, borderColor: colors.accent,
      marginBottom: spacing.md,
    },
    infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    infoLink: { color: colors.accent, fontFamily: "Outfit-Bold" },

    // ── URL input ──
    label: {
      fontSize: 10, fontFamily: "Outfit-Bold", color: colors.textMuted,
      letterSpacing: 1, marginBottom: 8, textTransform: "uppercase",
    },
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
    urlFetchBtnText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 13 },

    orDivider: {
      flexDirection: "row", alignItems: "center", gap: 8, marginVertical: spacing.sm,
    },
    orLine: { flex: 1, height: 1, backgroundColor: colors.border },
    orText: { fontSize: 11, color: colors.textMuted, fontFamily: "Outfit-SemiBold" },

    // ── LMS instruction card ──
    stepsCard: {
      backgroundColor: colors.bgCard, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, marginBottom: spacing.md,
    },
    stepsTitle: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 12 },

    // Platform tabs inside the card
    lmsTabs: {
      flexDirection: "row", gap: 6, marginBottom: 14,
      flexWrap: "wrap",
    },
    lmsTab: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: radius.full, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.bgElevated,
    },
    lmsTabActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
    lmsTabText:   { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
    lmsTabTextActive: { color: colors.accent },

    step: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
    stepNum: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent,
      alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
    },
    stepNumText: { fontSize: 10, fontFamily: "Outfit-ExtraBold", color: colors.accent },
    stepText:    { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 19 },

    tipRow: {
      flexDirection: "row", gap: 8, alignItems: "flex-start",
      marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
    },
    tipText: { fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 17 },

    // ── File picker ──
    dropZone: {
      borderWidth: 2, borderStyle: "dashed", borderColor: colors.border,
      borderRadius: radius.lg, paddingVertical: 36,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.bgCard, marginBottom: spacing.md, gap: 8,
    },
    dropZoneActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
    dropIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    dropTitle: { fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary },
    dropSub:   { fontSize: 12, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
    dropBtn: {
      marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.accent, borderRadius: radius.full,
      paddingHorizontal: 16, paddingVertical: 8, ...shadows.accent,
    },
    dropBtnText: { fontSize: 12, color: "#fff", fontFamily: "Outfit-Bold" },

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
    fileName:     { fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary, flex: 1 },
    fileEventCount: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    fileChangeBtn:  { padding: 6 },

    // ── Error ──
    errorRow: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(255,92,92,0.08)", padding: 12, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.high, marginBottom: spacing.md,
    },
    errorText: { color: colors.high, fontSize: 13, flex: 1, lineHeight: 18 },

    // ── Parse button ──
    primaryBtn: {
      backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, ...shadows.accent,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Outfit-Bold" },

    // ── Results (task list) ──
    resultsBar: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    resultsTitle:    { fontSize: 15, fontFamily: "Outfit-Bold", color: colors.textPrimary },
    resultsSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    selectAllText:   { fontSize: 13, color: colors.accent, fontFamily: "Outfit-Bold" },

    taskList: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 16 },
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
    checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    taskContent:  { flex: 1 },
    taskTitle:    { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, marginBottom: 6 },
    taskTitleDeselected: { color: colors.textMuted },
    taskMeta:     { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    metaChip: {
      flexDirection: "row", alignItems: "center", gap: 4,
      borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 3,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
    },
    metaText: { fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-SemiBold" },

    // ── Sticky import footer ──
    stickyFooter: {
      flexDirection: "row", gap: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    footerBack: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 14, paddingHorizontal: spacing.md,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    },
    footerBackText: { color: colors.textSecondary, fontFamily: "Outfit-SemiBold", fontSize: 14 },
    importBtn: {
      flex: 1, backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8, ...shadows.accent,
    },
    importBtnDisabled: { opacity: 0.45 },
    importBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Outfit-Bold" },

    // ── Success ──
    successWrap: {
      flex: 1, alignItems: "center", justifyContent: "center",
      paddingHorizontal: spacing.xl, paddingTop: 60,
    },
    successRing: {
      width: 88, height: 88, borderRadius: 44,
      borderWidth: 2, borderColor: colors.low,
      backgroundColor: colors.lowGlow,
      alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
    },
    successTitle: {
      fontSize: 26, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
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
    doneBtnText: { color: "#fff", fontSize: 16, fontFamily: "Outfit-Bold" },
    importingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center", justifyContent: "center", gap: 16,
    },
    importingText: { color: "#fff", fontSize: 15, fontFamily: "Outfit-SemiBold" },

    gradeNudgeCard: {
      flexDirection: "row", alignItems: "center",
      marginTop: spacing.lg, backgroundColor: colors.bgCard,
      borderRadius: radius.lg, padding: spacing.md,
      borderWidth: 1, borderColor: colors.accentGlow,
      gap: 10, width: "100%",
    },
    gradeNudgeLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    gradeNudgeTitle: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary },
    gradeNudgeSub:   { fontSize: 11, color: colors.accent, marginTop: 2 },
  });

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────
const SyllabusParserScreen = ({ navigation }) => {
  const { colors }           = useTheme();
  const styles               = makeStyles(colors);
  const { createManyTasks }  = useTasks();
  const { profile }          = useUserProfile();
  const { user }             = useAuth();

  const savedUrl = profile?.icsUrl ?? null;

  // ── State ─────────────────────────────────────────────────
  const successRingAnim = useRef(new Animated.Value(0)).current;
  const successTextAnim = useRef(new Animated.Value(0)).current;

  const [importing,      setImporting]      = useState(false);
  const [error,          setError]          = useState(null);
  const [importDone,     setImportDone]     = useState(false);
  const [importCount,    setImportCount]    = useState(0);
  const [skippedCount,   setSkippedCount]   = useState(0);
  const [newClassNames,  setNewClassNames]  = useState([]);

  const [icsText,        setIcsText]        = useState(null);
  const [icsLoading,     setIcsLoading]     = useState(false);
  const [icsUrl,         setIcsUrl]         = useState("");
  const [urlInputFocused, setUrlInputFocused] = useState(false);
  const [loadedFromUrl,  setLoadedFromUrl]  = useState(null); // URL that produced icsText
  const [showChangeUrl,  setShowChangeUrl]  = useState(false);
  const [syncing,        setSyncing]        = useState(false);
  const [selectedLms,    setSelectedLms]    = useState("Canvas");

  useEffect(() => {
    if (!importDone) return;
    Animated.stagger(80, [
      Animated.spring(successRingAnim, { toValue: 1, speed: 9, bounciness: 12, useNativeDriver: true }),
      Animated.timing(successTextAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [importDone]);

  // ── Parse + auto-import (skip review screen) ─────────────
  const parseAndShow = async (text) => {
    let tasks;
    try {
      tasks = parseIcsText(text);
      if (tasks.length === 0) {
        setError("No upcoming assignments found in this calendar. It may only contain past events or class sessions.");
        return;
      }
    } catch {
      setError("Couldn't parse this calendar file. Try exporting again.");
      return;
    }

    // Auto-import immediately — no review step
    setImporting(true); setError(null);
    try {
      const toImport = tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : null),
      }));

      const result  = await createManyTasks(toImport);
      const created = result?.created ?? toImport.length;
      const skipped = result?.skipped ?? 0;
      setImportCount(created);
      setSkippedCount(skipped);
      track("import_completed", { task_count: created });

      if (loadedFromUrl) {
        await saveUserProfile(user.uid, { icsUrl: loadedFromUrl });
      }

      const existingNames = new Set((profile?.classes ?? []).map((c) => c.name));
      const newNames = [...new Set(toImport.map((t) => t.className).filter(Boolean))]
        .filter((n) => !existingNames.has(n));
      if (newNames.length > 0) {
        const newEntries = newNames.map((name, i) => ({
          id: `${Date.now()}${i}`, name, creditHours: "3", grade: "No grade yet",
        }));
        await saveUserProfile(user.uid, { classes: [...(profile?.classes ?? []), ...newEntries] });
        setNewClassNames(newNames);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setImportDone(true);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  // ── URL fetch ─────────────────────────────────────────────
  const handleFetchUrl = async () => {
    const url = icsUrl.trim();
    if (!url) { setError("Paste your calendar feed URL first."); return; }
    setIcsLoading(true); setError(null);
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) {
        setError("That URL didn't return a valid calendar. Make sure you copied the full feed URL, not the calendar page URL.");
        return;
      }
      setIcsText(text);
      setLoadedFromUrl(url);
      setShowChangeUrl(false);
      await parseAndShow(text);
    } catch (err) {
      if (!err?.message?.includes("Import failed")) {
        setError("Couldn't load that URL. Check your connection and make sure it starts with https://. If it starts with webcal://, replace that with https://.");
      }
    } finally {
      setIcsLoading(false);
    }
  };

  // ── File pick ─────────────────────────────────────────────
  const handlePickFile = async () => {
    setIcsLoading(true); setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const text  = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!isValidIcs(text)) {
        setError("This doesn't look like a valid .ics file.");
        return;
      }
      setIcsText(text);
      setLoadedFromUrl(null);
      await parseAndShow(text);
    } catch {
      setError("Couldn't read the file. Try saving it to Files first, then pick it from there.");
    } finally {
      setIcsLoading(false);
    }
  };

  // ── One-click sync from saved URL ─────────────────────────
  const handleSyncNow = async () => {
    if (!savedUrl) return;
    setSyncing(true); setError(null);
    try {
      const res  = await fetch(savedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) throw new Error("Invalid ICS");
      setIcsText(text);
      setLoadedFromUrl(savedUrl);
      await parseAndShow(text);
    } catch {
      setError("Couldn't sync your calendar. The URL may have expired — try re-entering it.");
    } finally {
      setSyncing(false);
    }
  };

  // ── LMS steps data ────────────────────────────────────────
  const lmsData = LMS_STEPS[selectedLms];

  // ── Success screen ────────────────────────────────────────
  if (importDone) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <Animated.View style={{
            transform: [{ scale: successRingAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            opacity: successRingAnim,
            marginBottom: spacing.lg,
          }}>
            <View style={[styles.successRing, { marginBottom: 0 }]}>
              <Feather name="check" size={36} color={colors.low} />
            </View>
          </Animated.View>
          <Animated.View style={{
            opacity: successTextAnim,
            transform: [{ translateY: successTextAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            alignItems: "center", width: "100%",
          }}>
          <Text style={styles.successTitle}>
            {importCount} task{importCount !== 1 ? "s" : ""} added!
          </Text>
          <Text style={styles.successSubtitle}>
            {skippedCount > 0
              ? `${skippedCount} already-imported task${skippedCount !== 1 ? "s" : ""} skipped. Your semester is loaded.`
              : "Your semester is loaded. The AI now has your full schedule to plan around."
            }
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
          {newClassNames.length > 0 && (
            <TouchableOpacity
              style={styles.gradeNudgeCard}
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.8}
            >
              <View style={styles.gradeNudgeLeft}>
                <Feather name="award" size={15} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gradeNudgeTitle}>Add grades for your classes</Text>
                  <Text style={styles.gradeNudgeSub}>Helps the AI prioritize correctly → Profile</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={15} color={colors.accent} />
            </TouchableOpacity>
          )}
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main import form ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Import Calendar</Text>
          <Text style={styles.headerSubtitle}>Connect your school calendar to load assignments</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Saved URL sync card ── */}
        {savedUrl && !showChangeUrl ? (
          <>
            <View style={styles.syncCard}>
              <View style={styles.syncIcon}>
              <Feather name="check-circle" size={18} color={colors.isDark ? "#5CFF8F" : "#16653A"} />
              </View>
              <View style={styles.syncInfo}>
                <Text style={styles.syncTitle}>Calendar connected</Text>
                <Text style={styles.syncSub} numberOfLines={1}>{savedUrl}</Text>
              </View>
              <TouchableOpacity
                style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
                onPress={handleSyncNow}
                disabled={syncing}
              >
                {syncing
                  ? <ActivityIndicator size={13} color="#fff" />
                  : <Text style={styles.syncBtnText}>Sync</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.changeUrlBtn} onPress={() => setShowChangeUrl(true)}>
              <Text style={styles.changeUrlText}>Use a different URL</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* URL input */}
            <View style={styles.infoCard}>
              <Feather name="zap" size={14} color={colors.accent} />
              <Text style={styles.infoText}>
                <Text style={styles.infoLink}>Easiest way: </Text>
                Paste your school's calendar feed URL below — no file download needed.
              </Text>
            </View>

            <Text style={styles.label}>Calendar feed URL</Text>
            <View style={[styles.urlInputWrap, urlInputFocused && styles.urlInputWrapActive]}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://your-school.instructure.com/feeds/..."
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
                <Text style={styles.urlFetchBtnText}>{icsLoading ? "Loading..." : "Load"}</Text>
              </TouchableOpacity>
            </View>

            {/* LMS instructions */}
            <View style={styles.stepsCard}>
              <Text style={styles.stepsTitle}>How to get your feed URL</Text>

              {/* Platform switcher */}
              <View style={styles.lmsTabs}>
                {LMS_PLATFORMS.map((lms) => (
                  <TouchableOpacity
                    key={lms}
                    style={[styles.lmsTab, selectedLms === lms && styles.lmsTabActive]}
                    onPress={() => setSelectedLms(lms)}
                  >
                    <Text style={[styles.lmsTabText, selectedLms === lms && styles.lmsTabTextActive]}>
                      {lms}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Steps for selected platform */}
              {lmsData.steps.map((text, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}

              {/* Tip */}
              <View style={styles.tipRow}>
                <Feather name="info" size={12} color={colors.textMuted} />
                <Text style={styles.tipText}>{lmsData.tip}</Text>
              </View>
            </View>
          </>
        )}

        {/* OR divider */}
        <View style={styles.orDivider}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR PICK A FILE</Text>
          <View style={styles.orLine} />
        </View>

        {/* File picker */}
        <TouchableOpacity
          style={[styles.dropZone, icsLoading && styles.dropZoneActive]}
          onPress={handlePickFile}
          disabled={icsLoading || importing}
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

        {error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.high} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

      </ScrollView>

      {/* Full-screen importing overlay */}
      {importing && (
        <View style={styles.importingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.importingText}>Importing your assignments...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SyllabusParserScreen;
