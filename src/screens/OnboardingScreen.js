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

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Animated,
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
import { VERCEL_API_URL } from "../config";
// syllabusParser removed — ICS-only import
import {
  parseIcsText,
  isValidIcs,
  countIcsEvents,
} from "../services/icsImport";
import { generateTerms, WORK_TIMES, GRADES, CREDIT_OPTS } from "../utils/termHelpers";

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
    systemToggleRow: {
      flexDirection: "row",
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    systemToggleBtn: {
      flex: 1,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    systemToggleBtnActive: { backgroundColor: colors.accent },
    systemToggleText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    systemToggleTextActive: { color: "#fff" },
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

const STEP_COUNT = 4;

const generateId = () => Math.random().toString(36).substr(2, 9);

// ── Import Step Sub-component ─────────────────────────────────
const ImportStep = ({ onImported, onClassDetected, onUrlSaved, styles, colors }) => {
  const { createManyTasks } = useTasks();
  const [icsUrl, setIcsUrl] = useState("");
  const [icsLoading, setIcsLoading] = useState(false);
  const [icsText, setIcsText] = useState(null);
  const [parsedTasks, setParsedTasks] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [loadedFromUrl, setLoadedFromUrl] = useState(null);
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const parseAndSet = (text) => {
    try {
      const tasks = parseIcsText(text);
      if (tasks.length === 0) {
        setError("No upcoming assignments found in this calendar.");
        return;
      }
      setParsedTasks(tasks);
    } catch {
      setError("Couldn't parse this file. Try exporting again.");
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
        setError("That URL didn't return a valid calendar. Make sure you copied the full feed URL from Canvas.");
        return;
      }
      setIcsText(text);
      setLoadedFromUrl(url);
      parseAndSet(text);
    } catch {
      setError("Couldn't load that URL. Make sure it starts with https:// — replace webcal:// if needed.");
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
        return;
      }
      setIcsText(text);
      setLoadedFromUrl(null);
      parseAndSet(text);
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setIcsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedTasks?.length) return;
    setImporting(true);
    setError(null);
    try {
      const toImport = parsedTasks.map((t) => ({
        ...t,
        dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : null),
      }));
      await createManyTasks(toImport);
      onImported(toImport.length);
      if (loadedFromUrl && onUrlSaved) onUrlSaved(loadedFromUrl);
      // Notify parent of every unique class name found in imported tasks
      if (onClassDetected) {
        const detectedNames = [...new Set(toImport.map((t) => t.className).filter(Boolean))];
        detectedNames.forEach((name) => onClassDetected(name));
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
      {/* ICS / Calendar import */}
      <>
        <View style={styles.infoCard}>
          <Feather name="zap" size={13} color={colors.accent} />
          <Text style={styles.infoText}>
            <Text style={styles.infoLink}>Paste your school calendar URL </Text>
            for the fastest setup — works with Canvas, Brightspace, Blackboard, and Moodle.
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
            <Text style={styles.pickFileBtnText}>Pick a .ics file from Files</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={colors.high} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

        </>
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
  const [schoolSystem, setSchoolSystem] = useState("semester");
  const [semester, setSemester] = useState(null);

  // Step 1 — classes
  const [classes, setClasses] = useState([
    { id: generateId(), name: "", creditHours: "3", grade: "No grade yet" },
  ]);

  // Step 2 — work time preferences
  const [workTime, setWorkTime] = useState(null);
  const [hardestClass, setHardestClass] = useState(null);


  // Pre-fill when editing
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSchoolSystem(profile.schoolSystem ?? "semester");
      setSemester(profile.semester ?? null);
      setClasses(
        profile.classes?.length
          ? profile.classes.map((c) => ({
              ...c,
              creditHours: String(c.creditHours ?? 3),
            }))
          : [{ id: generateId(), name: "", creditHours: "3", grade: "No grade yet" }]
      );
      setWorkTime(profile.preferredWorkTime ?? null);
      setHardestClass(profile.hardestClass ?? null);
    }
  }, []);

  const handleUrlSaved = useCallback(async (url) => {
    if (!url || !user) return;
    await saveUserProfile(user.uid, { icsUrl: url }).catch(() => {});
  }, [user]);

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
      { id: generateId(), name: "", creditHours: "3", grade: "No grade yet" },
    ]);
  const removeClass = (id) => setClasses((p) => p.filter((c) => c.id !== id));
  const updateClass = (id, field, value) =>
    setClasses((p) =>
      p.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );

  const canAdvance = () => {
    if (step_n === 0) return !!semester || isEditing; // editing: allow even if semester was cleared
    if (step_n === 1) return true; // import optional
    if (step_n === 2) return true; // classes optional
    if (step_n === 3) return !!workTime || isEditing; // editing: work time already set previously
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
        schoolSystem,
        semester,
        classes: classes.filter((c) => c.name.trim()).map((c) => ({
          id: c.id,
          name: c.name.trim(),
          creditHours: parseInt(c.creditHours) || 3,
          grade: c.grade,
        })),
        preferredWorkTime: workTime,
        hardestClass: hardestClass ?? null,
        onboardingComplete: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      if (!isEditing) {
        data.isPro = false;
        data.createdAt = new Date().toISOString();
        data.welcomeEmailSent = true;
      }
      await saveUserProfile(user.uid, data);

      // Send welcome email on first-time onboarding — non-blocking
      if (!isEditing && user?.email) {
        fetch(`${VERCEL_API_URL}/api/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-secret": process.env.EXPO_PUBLIC_EMAIL_API_SECRET ?? "",
          },
          body: JSON.stringify({ type: "welcome", email: user.email, name: name.trim() || null }),
        }).catch(() => {});
      }

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
        SCHOOL SYSTEM
      </Text>
      <View style={styles.systemToggleRow}>
        {["semester", "quarter"].map((sys) => (
          <TouchableOpacity
            key={sys}
            style={[styles.systemToggleBtn, schoolSystem === sys && styles.systemToggleBtnActive]}
            onPress={() => { setSchoolSystem(sys); setSemester(null); }}
          >
            <Text style={[styles.systemToggleText, schoolSystem === sys && styles.systemToggleTextActive]}>
              {sys.charAt(0).toUpperCase() + sys.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
        CURRENT TERM
      </Text>
      {generateTerms(schoolSystem).map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.optionBtn, semester === s && styles.optionBtnSelected]}
          onPress={() => setSemester(s)}
        >
          <Text style={[styles.optionText, semester === s && styles.optionTextSelected]}>
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


  const importSuccessAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (importedCount > 0) {
      Animated.spring(importSuccessAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 7,
      }).start();
    }
  }, [importedCount]);

  const detectedClasses = classes.filter((c) => c.name.trim());

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      {importedCount > 0 ? (
        <Animated.View style={[
          styles.importHero,
          { opacity: importSuccessAnim, transform: [{ scale: importSuccessAnim }] }
        ]}>
          {/* Success icon */}
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: "rgba(34,197,94,0.12)",
            borderWidth: 2.5, borderColor: "#22C55E",
            alignItems: "center", justifyContent: "center",
            marginBottom: spacing.lg,
            shadowColor: "#22C55E", shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
          }}>
            <Feather name="check" size={38} color="#22C55E" />
          </View>

          <Text style={[styles.stepTitle, { textAlign: "center", fontSize: 26 }]}>
            You're all set up
          </Text>
          <Text style={[styles.stepSubtitle, { textAlign: "center", marginBottom: spacing.lg }]}>
            Planora has everything it needs to coach you through this semester.
          </Text>

          {/* Stats row */}
          <View style={{
            flexDirection: "row", gap: spacing.md,
            marginBottom: spacing.lg, width: "100%",
          }}>
            <View style={[styles.infoCard, {
              flex: 1, flexDirection: "column", alignItems: "center",
              gap: 4, paddingVertical: spacing.md,
            }]}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#22C55E" }}>
                {importedCount}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>
                tasks imported
              </Text>
            </View>
            {detectedClasses.length > 0 && (
              <View style={[styles.infoCard, {
                flex: 1, flexDirection: "column", alignItems: "center",
                gap: 4, paddingVertical: spacing.md,
              }]}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: colors.accent }}>
                  {detectedClasses.length}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>
                  classes found
                </Text>
              </View>
            )}
          </View>

          {/* What's next */}
          <View style={[styles.infoCard, { width: "100%" }]}>
            <Feather name="zap" size={16} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>
              The AI will use your deadlines and patterns to tell you exactly what to work on each day.
            </Text>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.importHero}>
          <View style={styles.importHeroIcon}>
            <Feather name="zap" size={30} color={colors.accent} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>
            Load your term
          </Text>
          <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
            Import from Canvas, Brightspace, Blackboard, or Moodle. You can skip this and add tasks manually.
          </Text>
        </View>
      )}

      {importedCount === 0 && (
        <ImportStep
          onImported={(count) => setImportedCount(count)}
          onClassDetected={handleClassDetected}
          onUrlSaved={handleUrlSaved}
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
