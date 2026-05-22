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
  Image,
  Linking,
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
import * as Haptics from "expo-haptics";
import { VERCEL_API_URL, FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;
import { requestNotificationPermissions } from "../services/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getIsSubscribed } from "../services/purchases";
// syllabusParser removed — ICS-only import
import {
  parseIcsText,
  isValidIcs,
  countIcsEvents,
} from "../services/icsImport";
import { generateTerms, WORK_TIMES, GRADES, CREDIT_OPTS } from "../utils/termHelpers";
import { searchCanvasSchools } from "../utils/canvasSchools";
import { track, identify } from "../services/analytics";

const ScalePressable = ({ onPress, style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

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
      height: 4,
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
    brandName: { fontSize: 16, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary },

    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
    stepContainer: {},
    stepTitle: {
      fontSize: 30,
      fontFamily: "Outfit-ExtraBold",
      color: colors.textPrimary,
      marginBottom: 10,
      letterSpacing: -0.6,
    },
    stepSubtitle: {
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: "Outfit-Bold",
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
      fontFamily: "Outfit-Medium",
    },
    optionTextSelected: { color: colors.accent, fontFamily: "Outfit-Bold" },
    systemToggleRow: {
      flexDirection: "row",
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: spacing.sm,
      padding: 3,
      gap: 2,
    },
    systemToggleBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    systemToggleBtnActive: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    systemToggleText: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textSecondary },
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
      fontFamily: "Outfit-Bold",
      textTransform: "uppercase",
    },
    subLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: "Outfit-SemiBold",
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
      backgroundColor: colors.bgCard,
    },
    chipSmSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
    },
    chipSmText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: "Outfit-SemiBold",
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
    addClassText: { color: colors.accent, fontFamily: "Outfit-SemiBold", fontSize: 14 },

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
    nextBtnText: { color: "#fff", fontSize: 15, fontFamily: "Outfit-Bold" },

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
    parseBtnText: { color: "#fff", fontSize: 14, fontFamily: "Outfit-Bold" },

    infoCard: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: colors.isDark ? colors.accentGlow : colors.bgCard,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.accent : colors.border,
      marginBottom: spacing.md,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    infoLink: { color: colors.accent, fontFamily: "Outfit-Bold" },
    schoolSearchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingLeft: 10,
      marginBottom: 4,
    },
    schoolSearchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      paddingVertical: 10,
      paddingLeft: 8,
      paddingRight: 10,
      fontFamily: "Outfit-Regular",
    },
    lmsDomainWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgInput,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingLeft: 10,
      marginBottom: spacing.sm,
      gap: 0,
    },
    lmsDomainPrefix: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: "Outfit-Regular",
    },
    lmsDomainInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      paddingVertical: 10,
      paddingLeft: 4,
      paddingRight: 4,
      fontFamily: "Outfit-Regular",
    },
    lmsDomainBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    lmsDomainBtnText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 12 },
    schoolResultsList: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginBottom: spacing.sm,
      overflow: "hidden",
    },
    schoolResultItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    schoolResultItemLast: { borderBottomWidth: 0 },
    schoolResultName: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
    schoolResultDomain: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },
    openCanvasBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 11,
      marginBottom: spacing.sm,
    },
    openCanvasBtnText: { color: "#fff", fontSize: 13, fontFamily: "Outfit-Bold" },
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
    fetchBtnText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 13 },
    orRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginVertical: 10,
    },
    orLine: { flex: 1, height: 1, backgroundColor: colors.border },
    orText: { fontSize: 11, color: colors.textMuted, fontFamily: "Outfit-SemiBold" },
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
      fontFamily: "Outfit-SemiBold",
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
      fontSize: 15,
      fontFamily: "Outfit-Bold",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    lmsTabRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: spacing.sm,
      flexWrap: "wrap",
    },
    lmsTabBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    lmsTabBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
    },
    lmsTabText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
    lmsTabTextActive: { color: colors.accent },
    stepRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
      alignItems: "flex-start",
    },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: colors.accentGlow,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      marginTop: 1,
    },
    stepNumText: { fontSize: 11, fontFamily: "Outfit-ExtraBold", color: colors.accent },
    stepText: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 21,
    },

    // Parsed tasks preview
    parsedPreview: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.low : colors.border,
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
      fontFamily: "Outfit-Bold",
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
    manualTaskHint: {
      fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit-Medium",
      marginBottom: spacing.sm,
    },
    manualTaskRow: {
      flexDirection: "row", gap: 8, alignItems: "center", marginBottom: spacing.sm,
    },
    notifBenefit: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 13, paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
    },
    notifBenefitLast: { borderBottomWidth: 0 },
    notifIconWrap: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: colors.accentGlow,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },

    // ── Success screen ─────────────────────────────────────────
    successIconWrap: {
      alignItems: "center",
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
    },
    successIconLg: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.isDark ? "rgba(52,199,89,0.15)" : "rgba(52,199,89,0.10)",
      borderWidth: 2, borderColor: colors.low,
      alignItems: "center", justifyContent: "center",
    },
    successTitle: {
      fontSize: 30, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
      marginBottom: 6, letterSpacing: -0.5, textAlign: "center",
    },
    successSubtitle: {
      fontSize: 15, color: colors.textSecondary, fontFamily: "Outfit-Medium",
      marginBottom: spacing.md, lineHeight: 22, textAlign: "center",
    },
    successBadgeRow: {
      flexDirection: "row", flexWrap: "wrap", gap: 6,
      justifyContent: "center", marginBottom: spacing.lg,
    },
    successBadge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: radius.full, borderWidth: 1,
      borderColor: colors.accent + "50", backgroundColor: colors.accentGlow,
    },
    successBadgeText: {
      fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.accent,
    },
    successCard: {
      borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.isDark ? colors.border : "#EBEBF5",
      marginBottom: spacing.md, overflow: "hidden",
      backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.10, shadowRadius: 8, elevation: 3,
      }),
    },
    successRow: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: spacing.md, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
    },
    successRowLast: { borderBottomWidth: 0 },
    successRowDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    successRowTitle: { flex: 1, fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
    successRowDate: { fontSize: 11, color: colors.textMuted, fontFamily: "Outfit-Medium" },
    successMore: {
      paddingHorizontal: spacing.md, paddingVertical: 10,
      fontSize: 12, color: colors.textMuted, fontFamily: "Outfit-SemiBold",
    },
    successNote: {
      fontSize: 13, color: colors.textMuted, lineHeight: 20, textAlign: "center",
    },

    // ── Value prop screen ──────────────────────────────────────
    valuePropLogoWrap: {
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    valuePropLogo: {
      width: 78,
      height: 78,
      borderRadius: 18,
    },
    sampleTaskCard: {
      flexDirection: "row",
      backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.isDark ? colors.border : "#EBEBF5",
      overflow: "hidden",
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      }),
    },
    samplePriorityBar: {
      width: 4,
      alignSelf: "stretch",
      marginRight: 12,
    },
    sampleTaskContent: {
      flex: 1,
      paddingVertical: 11,
      justifyContent: "center",
    },
    sampleTaskTitle: {
      fontSize: 13,
      fontFamily: "Outfit-SemiBold",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    sampleTaskClass: {
      fontSize: 11,
      fontFamily: "Outfit-Medium",
      color: colors.textMuted,
    },
    sampleTaskDate: {
      fontSize: 11,
      fontFamily: "Outfit-SemiBold",
      color: colors.textMuted,
      paddingRight: 14,
      alignSelf: "center",
    },
    lmsPlatformBtn: {
      width: "47%",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.bgCard,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 18,
      position: "relative",
    },
    lmsPlatformText: {
      fontSize: 15,
      fontFamily: "Outfit-SemiBold",
      color: colors.textSecondary,
    },
    importBackBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: spacing.md,
      alignSelf: "flex-start",
    },
    importBackText: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: "Outfit-SemiBold",
    },
    undoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    undoBtnText: {
      fontSize: 12,
      fontFamily: "Outfit-SemiBold",
      color: colors.high,
    },
  });

const generateId = () => Math.random().toString(36).substr(2, 9);

// ── Import Step Sub-component ─────────────────────────────────
const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

const LMS_OPTIONS = [
  { key: "Canvas",      logo: require("../assets/canvas-logo.png"),       color: "#E30613", darkColor: "#FF3344" },
  { key: "Brightspace", logo: require("../assets/brightspace-logo.webp"), color: "#FF6200", darkColor: "#FF8533" },
  { key: "Blackboard",  logo: require("../assets/blackboard-logo.png"),   color: "#3A6BC4", darkColor: "#6B9EFF" },
  { key: "Moodle",      logo: require("../assets/moodle-logo.png"),        color: "#F98012", darkColor: "#FFB03A" },
];

const CANVAS_STEPS = () => [
  "Open Canvas on your school's website and sign in with your school account",
  "Tap Calendar in the left sidebar",
  'Scroll to the bottom → tap "Calendar Feed" → copy the link',
  "Replace webcal:// with https:// if needed, then tap Next",
];
const LMS_STEPS = {
  Brightspace: [
    "Open Brightspace on your school's website and sign in",
    "Tap your name (top-right) → Notifications → Subscribe to Calendar",
    "Copy the iCal URL",
    "Tap Next below and paste the link",
  ],
  Blackboard: [
    "Open Blackboard on your school's website and sign in",
    "Go to Calendar → tap the gear icon → Subscribe to Calendar",
    "Copy the calendar URL",
    "Tap Next below and paste the link",
  ],
  Moodle: [
    "Open Moodle on your school's website and sign in",
    'Go to Calendar → scroll down → tap "Export or subscribe"',
    'Tap "Get calendar URL" (not Export) → copy it',
    "Tap Next below and paste the link",
  ],
};

const ImportStep = ({ onImported, onClassDetected, onUrlSaved, styles, colors }) => {
  const { createManyTasks } = useTasks();
  const [subStep, setSubStep]         = useState(0); // 0=pick LMS, 1=find link, 2=paste link
  const [selectedLms, setSelectedLms] = useState(null);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolResults, setSchoolResults] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [lmsDomain, setLmsDomain]     = useState("");
  const [icsUrl, setIcsUrl]           = useState("");
  const [icsLoading, setIcsLoading]   = useState(false);
  const [parsedTasks, setParsedTasks] = useState(null);
  const [importing, setImporting]     = useState(false);
  const [error, setError]             = useState(null);
  const [loadedFromUrl, setLoadedFromUrl] = useState(null);

  const searchSchools = (query) => {
    setSchoolQuery(query);
    setSelectedSchool(null);
    setSchoolResults(searchCanvasSchools(query));
  };

  const openCanvasCalendar = () => {
    const domain = selectedSchool?.domain;
    if (!domain) return;
    Linking.openURL(`https://${domain}/calendar`).catch(() => {});
  };

  const openLmsCalendar = () => {
    const d = lmsDomain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (!d) return;
    const paths = {
      Brightspace: `https://${d}/d2l/le/calendar/0/`,
      Blackboard:  `https://${d}/webapps/calendar/viewcalendar`,
      Moodle:      `https://${d}/calendar/view.php?view=upcoming`,
    };
    Linking.openURL(paths[selectedLms] ?? `https://${d}`).catch(() => {});
  };

  const parseAndSet = (text) => {
    try {
      const tasks = parseIcsText(text);
      if (tasks.length === 0) { setError("No upcoming assignments found in this calendar."); return; }
      setParsedTasks(tasks);
    } catch { setError("Couldn't parse this file. Try exporting again."); }
  };

  const handleFetchUrl = async () => {
    const url = icsUrl.trim();
    if (!url) return;
    setIcsLoading(true); setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) { setError("That URL didn't return a valid calendar. Make sure you copied the full feed URL."); return; }
      setIcsText(text); setLoadedFromUrl(url); parseAndSet(text);
    } catch { setError("Couldn't load that URL. Make sure it starts with https:// — replace webcal:// if needed."); }
    finally { setIcsLoading(false); }
  };
  const [icsText, setIcsText] = useState(null);

  const handlePickFile = async () => {
    setIcsLoading(true); setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/calendar", "application/octet-stream", "*/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) { setIcsLoading(false); return; }
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      if (!isValidIcs(text)) { setError("This doesn't look like a valid .ics file."); return; }
      setIcsText(text); setLoadedFromUrl(null); parseAndSet(text);
    } catch { setError("Couldn't read that file."); }
    finally { setIcsLoading(false); }
  };

  const handleImport = async () => {
    if (!parsedTasks?.length) return;
    setImporting(true); setError(null);
    try {
      const toImport = parsedTasks.map(t => ({ ...t, dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : null) }));
      await createManyTasks(toImport);
      onImported(toImport.length, toImport);
      if (loadedFromUrl && onUrlSaved) onUrlSaved(loadedFromUrl);
      if (onClassDetected) {
        const names = [...new Set(toImport.map(t => t.className).filter(Boolean))];
        names.forEach(n => onClassDetected(n));
      }
    } catch { setError("Import failed. You can try again from the dashboard."); }
    finally { setImporting(false); }
  };

  // ── Sub-step 0: Pick platform ─────────────────────────────────
  if (subStep === 0) return (
    <View>
      <Text style={[styles.stepsTitle, { marginBottom: spacing.md }]}>Which platform does your school use?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {LMS_OPTIONS.map(lms => {
          const c = colors.isDark ? lms.darkColor : lms.color;
          return (
            <TouchableOpacity
              key={lms.key}
              style={[styles.lmsPlatformBtn, selectedLms === lms.key && { borderColor: c, backgroundColor: c + "18" }]}
              onPress={() => { tap(); setSelectedLms(lms.key); }}
            >
              <Image source={lms.logo} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="contain" />
              <Text style={[styles.lmsPlatformText, selectedLms === lms.key && { color: c, fontFamily: "Outfit-Bold" }]}>{lms.key}</Text>
              {selectedLms === lms.key && <Feather name="check" size={13} color={c} style={{ position: "absolute", top: 8, right: 8 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.parseBtn, { marginTop: spacing.md }, !selectedLms && styles.parseBtnDisabled]}
        onPress={() => { tap(); setSubStep(1); }}
        disabled={!selectedLms}
      >
        <Text style={styles.parseBtnText}>Next</Text>
        <Feather name="arrow-right" size={15} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // ── Sub-step 1: Find the link ─────────────────────────────────
  if (subStep === 1) {
    const steps = selectedLms === "Canvas" ? CANVAS_STEPS() : (LMS_STEPS[selectedLms] ?? []);
    return (
      <View>
        <TouchableOpacity onPress={() => { tap(); setSubStep(0); }} style={styles.importBackBtn}>
          <Feather name="arrow-left" size={14} color={colors.textMuted} />
          <Text style={styles.importBackText}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.stepsTitle, { marginBottom: spacing.sm }]}>
          How to get your {selectedLms} link
        </Text>

        <View style={styles.stepsCard}>
          {steps.map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.parseBtn} onPress={() => { tap(); setSubStep(2); }}>
          <Text style={styles.parseBtnText}>I have the link</Text>
          <Feather name="arrow-right" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Sub-step 2: Paste & import ────────────────────────────────
  if (parsedTasks) return (
    <View>
      <View style={styles.parsedPreview}>
        <View style={styles.parsedHeader}>
          <Feather name="check-circle" size={16} color={colors.low} />
          <Text style={styles.parsedTitle}>{parsedTasks.length} assignments found</Text>
        </View>
        {parsedTasks.slice(0, 5).map((t, i) => {
          const dotColor = t.priority === "HIGH" ? colors.high : t.priority === "MEDIUM" ? colors.medium : colors.accent;
          return (
            <View key={i} style={styles.parsedItem}>
              <View style={[styles.parsedDot, { backgroundColor: dotColor }]} />
              <Text style={styles.parsedText} numberOfLines={1}>{t.title}</Text>
              {t.className ? <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-SemiBold" }}>{t.className}</Text> : null}
            </View>
          );
        })}
        {parsedTasks.length > 5 && <Text style={[styles.stepText, { color: colors.textMuted, marginTop: 6 }]}>+ {parsedTasks.length - 5} more</Text>}
      </View>
      <TouchableOpacity style={[styles.parseBtn, importing && styles.parseBtnDisabled]} onPress={() => { tap(); handleImport(); }} disabled={importing}>
        {importing ? <ActivityIndicator size={15} color="#fff" /> : <Feather name="download" size={15} color="#fff" />}
        <Text style={styles.parseBtnText}>{importing ? "Importing..." : `Add all ${parsedTasks.length} tasks`}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { tap(); setParsedTasks(null); setError(null); }} style={styles.skipBtn}>
        <Text style={styles.skipBtnText}>← Try a different link</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      <TouchableOpacity onPress={() => { tap(); setSubStep(1); }} style={styles.importBackBtn}>
        <Feather name="arrow-left" size={14} color={colors.textMuted} />
        <Text style={styles.importBackText}>Back</Text>
      </TouchableOpacity>
      <Text style={[styles.stepsTitle, { marginBottom: spacing.sm }]}>Paste your calendar link</Text>
      <View style={styles.urlInputWrap}>
        <TextInput
          style={styles.urlInput}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          value={icsUrl}
          onChangeText={v => { setIcsUrl(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.fetchBtn, (icsLoading || !icsUrl.trim()) && { opacity: 0.5 }]}
          onPress={() => { tap(); handleFetchUrl(); }}
          disabled={icsLoading || !icsUrl.trim()}
        >
          {icsLoading ? <ActivityIndicator size={13} color="#fff" /> : <Feather name="download-cloud" size={13} color="#fff" />}
          <Text style={styles.fetchBtnText}>{icsLoading ? "Loading..." : "Import"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR PICK A FILE</Text><View style={styles.orLine} /></View>
      <TouchableOpacity style={[styles.pickFileBtn, icsLoading && { opacity: 0.5 }]} onPress={() => { tap(); handlePickFile(); }} disabled={icsLoading}>
        <Feather name="upload" size={15} color={colors.textMuted} />
        <Text style={styles.pickFileBtnText}>Pick a .ics file from Files</Text>
      </TouchableOpacity>
      {error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color={colors.high} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
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

  const isEditing = useRef(!!profile?.onboardingComplete && !FEATURE_FLAGS.FORCE_ONBOARDING).current;
  const STEP_COUNT = isEditing ? 4 : 6;
  const { createTask, removeTask, createManyTasks } = useTasks();

  const [step, setStepp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importedTasks, setImportedTasks] = useState([]);

  // Import flow state (for new-user steps 1-3)
  const [importLms, setImportLms] = useState(null);
  const [importIcsUrl, setImportIcsUrl] = useState("");
  const [importIcsLoading, setImportIcsLoading] = useState(false);
  const [importParsedTasks, setImportParsedTasks] = useState(null);
  const [importingTasks, setImportingTasks] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importLoadedFromUrl, setImportLoadedFromUrl] = useState(null);
  const [importIcsText, setImportIcsText] = useState(null);

  // New personalization state
  const [year, setYear] = useState(null);
  const [classCount, setClassCount] = useState(null);
  const [learningStyle, setLearningStyle] = useState(null);

  // Manual task fallback
  const [manualTaskTitle, setManualTaskTitle] = useState("");
  const [manualTaskCreated, setManualTaskCreated] = useState(false);
  const [manualTaskId, setManualTaskId] = useState(null);
  const [addingManualTask, setAddingManualTask] = useState(false);

  // Value prop entrance animations
  const vpLogoAnim  = useRef(new Animated.Value(0)).current;
  const vpTextAnim  = useRef(new Animated.Value(0)).current;
  const vpTask1Anim = useRef(new Animated.Value(0)).current;
  const vpTask2Anim = useRef(new Animated.Value(0)).current;
  const vpTask3Anim = useRef(new Animated.Value(0)).current;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  // Trigger value prop entrance animations on mount (only for new user flow)
  useEffect(() => {
    if (isEditing || step !== 0) return;
    [vpLogoAnim, vpTextAnim, vpTask1Anim, vpTask2Anim, vpTask3Anim].forEach((a) => a.setValue(0));
    Animated.stagger(70, [
      Animated.spring(vpLogoAnim,  { toValue: 1, speed: 9, bounciness: 10, useNativeDriver: true }),
      Animated.timing(vpTextAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(vpTask1Anim, { toValue: 1, speed: 14, bounciness: 3, useNativeDriver: true }),
      Animated.spring(vpTask2Anim, { toValue: 1, speed: 14, bounciness: 3, useNativeDriver: true }),
      Animated.spring(vpTask3Anim, { toValue: 1, speed: 14, bounciness: 3, useNativeDriver: true }),
    ]).start();
  }, [step, isEditing]);

  const goToStep = (newStep) => {
    const dir = newStep > step_n ? 1 : -1;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -dir * 22, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setStepp(newStep);
      slideAnim.setValue(dir * 22);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 24, bounciness: 3, useNativeDriver: true }),
      ]).start();
    });
  };

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

  // Pre-fill with demo data — lets you tap through onboarding without typing
  useEffect(() => {
    if (!DEMO_MODE) return;
    setName("Alex Johnson");
    setSchoolSystem("semester");
    setSemester("Spring 2026");
    setYear("sophomore");
    setClasses([
      { id: generateId(), name: "CHEM 201",  creditHours: "4", grade: "B+" },
      { id: generateId(), name: "HIST 110",  creditHours: "3", grade: "A-" },
      { id: generateId(), name: "MATH 240",  creditHours: "3", grade: "B"  },
      { id: generateId(), name: "PSYC 101",  creditHours: "3", grade: "A"  },
    ]);
    setWorkTime("afternoon");
    setLearningStyle("procrastinator");
    // Pre-populate import success screen with realistic canned tasks
    const now = Date.now();
    const day = 86400000;
    const demoImported = [
      { title: "Lab Report — Oxidation Reactions",  className: "CHEM 201", dueDate: new Date(now + 3 * day),  priority: "HIGH"   },
      { title: "Midterm Exam",                       className: "CHEM 201", dueDate: new Date(now + 7 * day),  priority: "HIGH"   },
      { title: "Essay: Causes of WWI",               className: "HIST 110", dueDate: new Date(now + 5 * day),  priority: "HIGH"   },
      { title: "Weekly Reading Chapters 8–9",        className: "PSYC 101", dueDate: new Date(now + 2 * day),  priority: "MEDIUM" },
      { title: "Problem Set 5",                      className: "MATH 240", dueDate: new Date(now + 4 * day),  priority: "MEDIUM" },
      { title: "Problem Set 6",                      className: "MATH 240", dueDate: new Date(now + 9 * day),  priority: "MEDIUM" },
      { title: "Research Paper Outline",             className: "HIST 110", dueDate: new Date(now + 11 * day), priority: "MEDIUM" },
      { title: "Lab Practical",                      className: "CHEM 201", dueDate: new Date(now + 14 * day), priority: "MEDIUM" },
      { title: "Chapter 10–11 Quiz",                 className: "PSYC 101", dueDate: new Date(now + 6 * day),  priority: "LOW"    },
      { title: "Integration Techniques Worksheet",   className: "MATH 240", dueDate: new Date(now + 8 * day),  priority: "LOW"    },
    ];
    setImportedTasks(demoImported);
    setImportedCount(demoImported.length);
  }, []);

  // Pre-fill when editing
  useEffect(() => {
    if (DEMO_MODE || !profile) return;
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
        return [...prev, { id: generateId(), name, creditHours: "3", grade: "No grade yet" }];
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

  const handleAddManualTask = async () => {
    if (!manualTaskTitle.trim() || !user) return;
    setAddingManualTask(true);
    try {
      const docRef = await createTask({ title: manualTaskTitle.trim(), priority: "MEDIUM" });
      setManualTaskId(docRef?.id ?? null);
      setManualTaskCreated(true);
    } catch {}
    finally { setAddingManualTask(false); }
  };

  const handleUndoManualTask = async () => {
    try {
      if (manualTaskId) await removeTask(manualTaskId, null);
    } catch {}
    setManualTaskCreated(false);
    setManualTaskId(null);
    setManualTaskTitle("");
  };

  // ── Import functions (new-user flow) ─────────────────────────
  const importParseAndSet = (text) => {
    try {
      const tasks = parseIcsText(text);
      if (tasks.length === 0) { setImportError("No upcoming assignments found in this calendar."); return; }
      setImportParsedTasks(tasks);
    } catch { setImportError("Couldn't parse this file. Try exporting again."); }
  };

  const handleImportFetchUrl = async () => {
    const url = importIcsUrl.trim();
    if (!url) return;
    setImportIcsLoading(true); setImportError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!isValidIcs(text)) { setImportError("That URL didn't return a valid calendar. Make sure you copied the full feed URL."); return; }
      setImportIcsText(text); setImportLoadedFromUrl(url); importParseAndSet(text);
    } catch { setImportError("Couldn't load that URL. Make sure it starts with https:// — replace webcal:// if needed."); }
    finally { setImportIcsLoading(false); }
  };

  const handleImportPickFile = async () => {
    setImportIcsLoading(true); setImportError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/calendar", "application/octet-stream", "*/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) { setImportIcsLoading(false); return; }
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      if (!isValidIcs(text)) { setImportError("This doesn't look like a valid .ics file."); return; }
      setImportIcsText(text); setImportLoadedFromUrl(null); importParseAndSet(text);
    } catch { setImportError("Couldn't read that file."); }
    finally { setImportIcsLoading(false); }
  };

  const handleImportTasksNow = async () => {
    if (!importParsedTasks?.length) return;
    setImportingTasks(true); setImportError(null);
    try {
      const toImport = importParsedTasks.map(t => ({ ...t, dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : null) }));
      await createManyTasks(toImport);
      setImportedCount(toImport.length);
      setImportedTasks(toImport);
      setImportParsedTasks(null);
      if (importLoadedFromUrl && user) saveUserProfile(user.uid, { icsUrl: importLoadedFromUrl }).catch(() => {});
      const names = [...new Set(toImport.map(t => t.className).filter(Boolean))];
      names.forEach(n => handleClassDetected(n));
    } catch { setImportError("Import failed. You can try again from the dashboard."); }
    finally { setImportingTasks(false); }
  };

  const canAdvance = () => {
    if (isEditing) {
      if (step_n === 0) return !!semester || isEditing;
      if (step_n === 1) return true;
      if (step_n === 2) return true;
      if (step_n === 3) return !!workTime || isEditing;
      return false;
    }
    if (step_n === 3 && importingTasks) return false;
    return true;
  };

  const handleNext = async () => {
    if (!isEditing) {
      // step 1: if no LMS chosen, skip past import steps to personalization
      if (step_n === 1 && !importLms) { goToStep(4); return; }
      // step 3: if tasks parsed, import them first
      if (step_n === 3 && importParsedTasks?.length) {
        await handleImportTasksNow();
        goToStep(4);
        return;
      }
      // last step: request notifications then finish
      if (step_n === STEP_COUNT - 1) {
        await requestNotificationPermissions().catch(() => {});
        handleFinish();
        return;
      }
    }
    if (step_n < STEP_COUNT - 1) goToStep(step_n + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaving(true);
    try {
      let data;
      if (isEditing) {
        data = {
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
      } else {
        const workTimeFromStyle = { "on-top": "morning", "procrastinator": "evening", "structured": "morning" };
        data = {
          name: name.trim() || null,
          schoolSystem,
          semester,
          studentYear: year,
          classCount,
          learningStyle,
          preferredWorkTime: workTime ?? (workTimeFromStyle[learningStyle] ?? null),
          classes: classes.filter((c) => c.name.trim()).map((c) => ({
            id: c.id,
            name: c.name.trim(),
            creditHours: parseInt(c.creditHours) || 3,
            grade: c.grade,
          })),
          hardestClass: hardestClass ?? null,
          onboardingComplete: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isPro: false,
          createdAt: new Date().toISOString(),
          welcomeEmailSent: true,
        };
      }

      if (!DEMO_MODE) {
        await saveUserProfile(user.uid, data);
        if (!isEditing && user?.uid) {
          identify(user.uid, { semester: data.semester, year: data.studentYear, learningStyle: data.learningStyle });
          track("onboarding_completed", { class_count: data.classes?.length ?? 0, has_import: !!(importParsedTasks?.length) });
        }
      }

      if (!isEditing && !DEMO_MODE && !FEATURE_FLAGS.FORCE_ONBOARDING && !profile?.welcomeEmailSent && user?.email) {
        fetch(`${VERCEL_API_URL}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "welcome", email: user.email, name: null }),
        }).catch(() => {});
      }

      if (isEditing && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Check paywall eligibility BEFORE navigating so there's no flash
        const forceOnboarding = FEATURE_FLAGS.FORCE_ONBOARDING;
        const [offered, alreadyPro] = await Promise.all([
          AsyncStorage.getItem("@planora_trial_offered").catch(() => null),
          getIsSubscribed().catch(() => false),
        ]);
        // When FORCE_ONBOARDING is on, always show paywall (don't check/set the offered flag)
        const showPaywall = forceOnboarding ? !alreadyPro : (!offered && !alreadyPro);
        if (showPaywall && !forceOnboarding) {
          await AsyncStorage.setItem("@planora_trial_offered", "true").catch(() => {});
        }
        if (showPaywall) {
          // Mark paywall as pending — AppNavigator will show it after the walkthrough
          // (or immediately if the walkthrough has already been seen)
          await AsyncStorage.setItem("@planora_paywall_pending", "true").catch(() => {});
        }
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
        A few quick details so the AI can plan your semester around you.
      </Text>

      <Text style={styles.fieldLabel}>YOUR NAME (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        selectionColor={colors.accent}
      />

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
        SCHOOL SYSTEM
      </Text>
      <View style={styles.systemToggleRow}>
        {["semester", "quarter"].map((sys) => (
          <TouchableOpacity
            key={sys}
            style={[styles.systemToggleBtn, schoolSystem === sys && styles.systemToggleBtnActive]}
            onPress={() => { tap(); setSchoolSystem(sys); setSemester(null); }}
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
        <ScalePressable
          key={s}
          style={[styles.optionBtn, semester === s && styles.optionBtnSelected]}
          onPress={() => { tap(); setSemester(s); }}
        >
          <Text style={[styles.optionText, semester === s && styles.optionTextSelected]}>{s}</Text>
          {semester === s && <Feather name="check" size={16} color={colors.accent} />}
        </ScalePressable>
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
              <TouchableOpacity onPress={() => { tap(); removeClass(cls.id); }}>
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
                onPress={() => { tap(); updateClass(cls.id, "creditHours", c); }}
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
                onPress={() => { tap(); updateClass(cls.id, "grade", g); }}
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

      <TouchableOpacity style={styles.addClassBtn} onPress={() => { tap(); addClass(); }}>
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
        <ScalePressable
          key={t}
          style={[styles.optionBtn, workTime === t && styles.optionBtnSelected]}
          onPress={() => { tap(); setWorkTime(t); }}
        >
          <Text style={[styles.optionText, workTime === t && styles.optionTextSelected]}>{t}</Text>
          {workTime === t && <Feather name="check" size={16} color={colors.accent} />}
        </ScalePressable>
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
                  onPress={() => { tap(); setHardestClass(hardestClass === cls.id ? null : cls.id); }}
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
  const successIconAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (importedCount > 0) {
      Animated.parallel([
        Animated.timing(importSuccessAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(successIconAnim, { toValue: 1, speed: 10, bounciness: 12, useNativeDriver: true }),
      ]).start();
    }
  }, [importedCount]);

  const detectedClasses = classes.filter((c) => c.name.trim());

  const renderStep4 = () => {
    const detectedClassNames = [...new Set(importedTasks.map((t) => t.className).filter(Boolean))];
    const highCount = importedTasks.filter((t) => t.priority === "HIGH").length;
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoonCount = importedTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
      return d >= now && d <= weekOut;
    }).length;

    return (
    <View style={styles.stepContainer}>
      {importedCount > 0 ? (
        <Animated.View style={[
          styles.stepContainer,
          {
            opacity: importSuccessAnim,
            transform: [{ translateY: importSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }
        ]}>
          {/* Animated checkmark icon */}
          <View style={styles.successIconWrap}>
            <Animated.View style={{ transform: [{ scale: successIconAnim }] }}>
              <View style={styles.successIconLg}>
                <Feather name="check" size={40} color={colors.low} />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.successTitle}>
            {importedCount} task{importedCount !== 1 ? "s" : ""} loaded
          </Text>
          <Text style={styles.successSubtitle}>
            Your semester is ready to plan around.
          </Text>

          {/* Stats badges */}
          <View style={styles.successBadgeRow}>
            {detectedClassNames.length > 0 && (
              <View style={styles.successBadge}>
                <Feather name="book-open" size={11} color={colors.accent} />
                <Text style={styles.successBadgeText}>
                  {detectedClassNames.length} {detectedClassNames.length === 1 ? "class" : "classes"}
                </Text>
              </View>
            )}
            {highCount > 0 && (
              <View style={[styles.successBadge, { borderColor: colors.high + "50", backgroundColor: colors.high + "12" }]}>
                <Feather name="alert-circle" size={11} color={colors.high} />
                <Text style={[styles.successBadgeText, { color: colors.high }]}>
                  {highCount} urgent
                </Text>
              </View>
            )}
            {dueSoonCount > 0 && (
              <View style={[styles.successBadge, { borderColor: colors.medium + "50", backgroundColor: colors.medium + "12" }]}>
                <Feather name="clock" size={11} color={colors.medium} />
                <Text style={[styles.successBadgeText, { color: colors.medium }]}>
                  {dueSoonCount} due this week
                </Text>
              </View>
            )}
          </View>

          {importedTasks.length > 0 && (
            <View style={styles.successCard}>
              {importedTasks.slice(0, 4).map((t, i) => {
                const isLast = i === Math.min(3, importedTasks.length - 1) && importedCount <= 4;
                const d = t.dueDate ? (t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate)) : null;
                const dateLabel = d && !isNaN(d) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                const dotColor = t.priority === "HIGH" ? colors.high : t.priority === "MEDIUM" ? colors.medium : colors.accent;
                return (
                  <View key={i} style={[styles.successRow, isLast && styles.successRowLast]}>
                    <View style={[styles.successRowDot, { backgroundColor: dotColor }]} />
                    <Text style={styles.successRowTitle} numberOfLines={1}>{t.title}</Text>
                    {dateLabel ? <Text style={styles.successRowDate}>{dateLabel}</Text> : null}
                  </View>
                );
              })}
              {importedCount > 4 && (
                <Text style={styles.successMore}>+{importedCount - 4} more tasks</Text>
              )}
            </View>
          )}

          <Text style={styles.successNote}>
            Tap Get Started — the AI will coach you around every deadline.
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.importHero}>
          <View style={styles.importHeroIcon}>
            <Feather name="calendar" size={30} color={colors.accent} />
          </View>
          <Text style={[styles.stepTitle, { textAlign: "center" }]}>
            Your whole semester,{"\n"}in seconds
          </Text>
          <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
            Connect Canvas, Brightspace, or Blackboard and every deadline lands in your planner automatically.
          </Text>
        </View>
      )}

      {importedCount === 0 && (
        <>
          <ImportStep
            onImported={(count, tasks) => { setImportedCount(count); setImportedTasks(tasks ?? []); }}
            onClassDetected={handleClassDetected}
            onUrlSaved={handleUrlSaved}
            styles={styles}
            colors={colors}
          />
          {!isEditing && !manualTaskCreated && (
            <>
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>OR START WITH ONE TASK</Text>
                <View style={styles.orLine} />
              </View>
              <Text style={styles.manualTaskHint}>What's your most important assignment right now?</Text>
              <View style={styles.manualTaskRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="e.g. Study for midterm..."
                  placeholderTextColor={colors.textMuted}
                  value={manualTaskTitle}
                  onChangeText={setManualTaskTitle}
                />
                <TouchableOpacity
                  style={[styles.fetchBtn, (!manualTaskTitle.trim() || addingManualTask) && { opacity: 0.4 }]}
                  onPress={() => { tap(); handleAddManualTask(); }}
                  disabled={!manualTaskTitle.trim() || addingManualTask}
                >
                  {addingManualTask
                    ? <ActivityIndicator size={13} color="#fff" />
                    : <Text style={styles.fetchBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
          {!isEditing && manualTaskCreated && (
            <View style={[styles.parsedPreview, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <Feather name="check-circle" size={15} color={colors.low} />
              <Text style={[styles.parsedTitle, { fontSize: 13, flex: 1 }]}>"{manualTaskTitle}" added.</Text>
              <TouchableOpacity style={styles.undoBtn} onPress={() => { tap(); handleUndoManualTask(); }}>
                <Feather name="x" size={12} color={colors.high} />
                <Text style={styles.undoBtnText}>Undo</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
    );
  };

  // ── New onboarding screens ────────────────────────────────────

  const renderValueProp = () => {
    const taskAnims = [vpTask1Anim, vpTask2Anim, vpTask3Anim];
    const sampleTasks = [
      { title: "Research Paper Draft", class: "ENGL 301", date: "Apr 22", dotColor: colors.high },
      { title: "Problem Set 7", class: "MATH 240", date: "Apr 25", dotColor: colors.medium },
      { title: "Lab Report", class: "BIO 210", date: "Apr 28", dotColor: colors.accent },
    ];
    return (
      <View style={styles.stepContainer}>
        {/* Logo */}
        <Animated.View style={[styles.valuePropLogoWrap, {
          opacity: vpLogoAnim,
          transform: [{ scale: vpLogoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
        }]}>
          <Image source={require("../assets/planora-brand.jpg")} style={styles.valuePropLogo} resizeMode="cover" />
        </Animated.View>

        {/* Headline + subtitle */}
        <Animated.View style={{
          opacity: vpTextAnim,
          transform: [{ translateY: vpTextAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          marginBottom: spacing.lg,
        }}>
          <Text style={[styles.stepTitle, { textAlign: "center", fontSize: 30 }]}>
            Your whole semester,{"\n"}organized.
          </Text>
          <Text style={[styles.stepSubtitle, { textAlign: "center", marginBottom: 0 }]}>
            Import your classes once — Planora tracks every deadline, coaches you with AI, and keeps your streak alive.
          </Text>
        </Animated.View>

        {/* Animated sample task cards */}
        <View style={{ gap: 8 }}>
          {sampleTasks.map((task, i) => (
            <Animated.View key={i} style={[styles.sampleTaskCard, {
              opacity: taskAnims[i],
              transform: [{ translateX: taskAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            }]}>
              <View style={[styles.samplePriorityBar, { backgroundColor: task.dotColor }]} />
              <View style={styles.sampleTaskContent}>
                <Text style={styles.sampleTaskTitle} numberOfLines={1}>{task.title}</Text>
                <Text style={styles.sampleTaskClass}>{task.class}</Text>
              </View>
              <Text style={styles.sampleTaskDate}>{task.date}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    );
  };

  const renderPersonalization = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tell us about you</Text>
      <Text style={styles.stepSubtitle}>
        Helps the AI personalize your plan. All optional.
      </Text>

      <Text style={styles.fieldLabel}>YOUR NAME (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        selectionColor={colors.accent}
      />

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>SCHOOL SYSTEM</Text>
      <View style={[styles.systemToggleRow, { marginBottom: spacing.sm }]}>
        {["semester", "quarter"].map((sys) => (
          <TouchableOpacity
            key={sys}
            style={[styles.systemToggleBtn, schoolSystem === sys && styles.systemToggleBtnActive]}
            onPress={() => { tap(); setSchoolSystem(sys); setSemester(null); }}
          >
            <Text style={[styles.systemToggleText, schoolSystem === sys && styles.systemToggleTextActive]}>
              {sys.charAt(0).toUpperCase() + sys.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>CURRENT TERM</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
        {generateTerms(schoolSystem).slice(0, 4).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chipSm, semester === s && styles.chipSmSelected]}
            onPress={() => { tap(); setSemester(semester === s ? null : s); }}
          >
            <Text style={[styles.chipSmText, semester === s && styles.chipSmTextSelected]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>WHAT YEAR ARE YOU?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md }}>
        {["Freshman", "Sophomore", "Junior", "Senior", "Grad"].map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.chipSm, year === y && styles.chipSmSelected]}
            onPress={() => { tap(); setYear(year === y ? null : y); }}
          >
            <Text style={[styles.chipSmText, year === y && styles.chipSmTextSelected]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>WHEN DO YOU WORK BEST?</Text>
      {WORK_TIMES.map((t) => (
        <ScalePressable key={t} style={[styles.optionBtn, workTime === t && styles.optionBtnSelected]} onPress={() => { tap(); setWorkTime(workTime === t ? null : t); }}>
          <Text style={[styles.optionText, workTime === t && styles.optionTextSelected]}>{t}</Text>
          {workTime === t && <Feather name="check" size={16} color={colors.accent} />}
        </ScalePressable>
      ))}

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>HOW WOULD YOU DESCRIBE YOURSELF?</Text>
      {[
        { key: "on-top",         label: "I stay on top of things" },
        { key: "procrastinator", label: "I tend to procrastinate" },
        { key: "structured",     label: "I need structure to stay on track" },
      ].map((s) => (
        <ScalePressable key={s.key} style={[styles.optionBtn, learningStyle === s.key && styles.optionBtnSelected]} onPress={() => { tap(); setLearningStyle(s.key); }}>
          <Text style={[styles.optionText, learningStyle === s.key && styles.optionTextSelected]}>{s.label}</Text>
          {learningStyle === s.key && <Feather name="check" size={16} color={colors.accent} />}
        </ScalePressable>
      ))}
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.importHeroIcon, { alignSelf: "center", width: 80, height: 80, borderRadius: 40, marginBottom: spacing.lg }]}>
        <Feather name="bell" size={32} color={colors.accent} />
      </View>
      <Text style={[styles.stepTitle, { textAlign: "center" }]}>Stay ahead of every deadline</Text>
      <Text style={[styles.stepSubtitle, { textAlign: "center" }]}>
        Planora works best when it can remind you before things are due.
      </Text>

      <View style={styles.successCard}>
        {[
          { icon: "clock", label: "24 hours before every deadline" },
          { icon: "sun", label: "Morning digest of today's tasks" },
          { icon: "zap", label: "Streak reminder to keep your momentum" },
        ].map((item, i) => (
          <View key={i} style={[styles.notifBenefit, i === 2 && styles.notifBenefitLast]}>
            <View style={styles.notifIconWrap}>
              <Feather name={item.icon} size={16} color={colors.accent} />
            </View>
            <Text style={[styles.successRowTitle, { fontSize: 14 }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.successNote, { marginTop: spacing.sm }]}>
        You can adjust notification preferences anytime in settings.
      </Text>
    </View>
  );

  // ── Import step renderers (new-user steps 1-3) ───────────────

  const renderLmsPicker = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Import your semester</Text>
      <Text style={styles.stepSubtitle}>Which platform does your school use?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {LMS_OPTIONS.map(lms => {
          const c = colors.isDark ? lms.darkColor : lms.color;
          return (
            <TouchableOpacity
              key={lms.key}
              style={[styles.lmsPlatformBtn, importLms === lms.key && { borderColor: c, backgroundColor: c + "18" }]}
              onPress={() => { tap(); setImportLms(lms.key); }}
            >
              <Image source={lms.logo} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="contain" />
              <Text style={[styles.lmsPlatformText, importLms === lms.key && { color: c, fontFamily: "Outfit-Bold" }]}>{lms.key}</Text>
              {importLms === lms.key && <Feather name="check" size={13} color={c} style={{ position: "absolute", top: 8, right: 8 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.stepSubtitle, { marginTop: spacing.lg, marginBottom: 0, textAlign: "center" }]}>
        Not sure or don't use one of these?{"\n"}Tap Skip below — you can always add tasks manually.
      </Text>
    </View>
  );

  const renderLmsDirections = () => {
    const dirSteps = importLms === "Canvas" ? CANVAS_STEPS() : (LMS_STEPS[importLms] ?? []);
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>How to get your link</Text>
        <Text style={styles.stepSubtitle}>Follow these steps in your browser, then come back here.</Text>
        <View style={styles.stepsCard}>
          {dirSteps.map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderLmsPaste = () => {
    const detectedClassNames = [...new Set(importedTasks.map(t => t.className).filter(Boolean))];
    const highCount = importedTasks.filter(t => t.priority === "HIGH").length;
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoonCount = importedTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
      return d >= now && d <= weekOut;
    }).length;

    // Success state
    if (importedCount > 0) return (
      <Animated.View style={[styles.stepContainer, { opacity: importSuccessAnim, transform: [{ translateY: importSuccessAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        <View style={styles.successIconWrap}>
          <Animated.View style={{ transform: [{ scale: successIconAnim }] }}>
            <View style={styles.successIconLg}><Feather name="check" size={40} color={colors.low} /></View>
          </Animated.View>
        </View>
        <Text style={styles.successTitle}>{importedCount} task{importedCount !== 1 ? "s" : ""} loaded</Text>
        <Text style={styles.successSubtitle}>Your semester is ready to plan around.</Text>
        <View style={styles.successBadgeRow}>
          {detectedClassNames.length > 0 && <View style={styles.successBadge}><Feather name="book-open" size={11} color={colors.accent} /><Text style={styles.successBadgeText}>{detectedClassNames.length} {detectedClassNames.length === 1 ? "class" : "classes"}</Text></View>}
          {highCount > 0 && <View style={[styles.successBadge, { borderColor: colors.high + "50", backgroundColor: colors.high + "12" }]}><Feather name="alert-circle" size={11} color={colors.high} /><Text style={[styles.successBadgeText, { color: colors.high }]}>{highCount} urgent</Text></View>}
          {dueSoonCount > 0 && <View style={[styles.successBadge, { borderColor: colors.medium + "50", backgroundColor: colors.medium + "12" }]}><Feather name="clock" size={11} color={colors.medium} /><Text style={[styles.successBadgeText, { color: colors.medium }]}>{dueSoonCount} due this week</Text></View>}
        </View>
        {importedTasks.length > 0 && (
          <View style={styles.successCard}>
            {importedTasks.slice(0, 4).map((t, i) => {
              const isLast = i === Math.min(3, importedTasks.length - 1) && importedCount <= 4;
              const d = t.dueDate ? (t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate)) : null;
              const dateLabel = d && !isNaN(d) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
              const dotColor = t.priority === "HIGH" ? colors.high : t.priority === "MEDIUM" ? colors.medium : colors.accent;
              return (
                <View key={i} style={[styles.successRow, isLast && styles.successRowLast]}>
                  <View style={[styles.successRowDot, { backgroundColor: dotColor }]} />
                  <Text style={styles.successRowTitle} numberOfLines={1}>{t.title}</Text>
                  {dateLabel ? <Text style={styles.successRowDate}>{dateLabel}</Text> : null}
                </View>
              );
            })}
            {importedCount > 4 && <Text style={styles.successMore}>+{importedCount - 4} more tasks</Text>}
          </View>
        )}
      </Animated.View>
    );

    // Parsed preview state
    if (importParsedTasks) return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Ready to import</Text>
        <View style={styles.parsedPreview}>
          <View style={styles.parsedHeader}>
            <Feather name="check-circle" size={16} color={colors.low} />
            <Text style={styles.parsedTitle}>{importParsedTasks.length} assignments found</Text>
          </View>
          {importParsedTasks.slice(0, 5).map((t, i) => {
            const dotColor = t.priority === "HIGH" ? colors.high : t.priority === "MEDIUM" ? colors.medium : colors.accent;
            return (
              <View key={i} style={styles.parsedItem}>
                <View style={[styles.parsedDot, { backgroundColor: dotColor }]} />
                <Text style={styles.parsedText} numberOfLines={1}>{t.title}</Text>
                {t.className ? <Text style={{ fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-SemiBold" }}>{t.className}</Text> : null}
              </View>
            );
          })}
          {importParsedTasks.length > 5 && <Text style={[styles.stepText, { color: colors.textMuted, marginTop: 6 }]}>+ {importParsedTasks.length - 5} more</Text>}
        </View>
        <TouchableOpacity style={[styles.skipBtn]} onPress={() => { tap(); setImportParsedTasks(null); setImportError(null); }}>
          <Text style={styles.skipBtnText}>← Try a different link</Text>
        </TouchableOpacity>
      </View>
    );

    // Default: paste URL
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Paste your calendar link</Text>
        <Text style={styles.stepSubtitle}>Paste the link you copied, or pick the .ics file.</Text>
        <View style={styles.urlInputWrap}>
          <TextInput
            style={styles.urlInput}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            value={importIcsUrl}
            onChangeText={v => { setImportIcsUrl(v); setImportError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.fetchBtn, (importIcsLoading || !importIcsUrl.trim()) && { opacity: 0.5 }]}
            onPress={() => { tap(); handleImportFetchUrl(); }}
            disabled={importIcsLoading || !importIcsUrl.trim()}
          >
            {importIcsLoading ? <ActivityIndicator size={13} color="#fff" /> : <Feather name="download-cloud" size={13} color="#fff" />}
            <Text style={styles.fetchBtnText}>{importIcsLoading ? "Loading..." : "Import"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR PICK A FILE</Text><View style={styles.orLine} /></View>
        <TouchableOpacity style={[styles.pickFileBtn, importIcsLoading && { opacity: 0.5 }]} onPress={() => { tap(); handleImportPickFile(); }} disabled={importIcsLoading}>
          <Feather name="upload" size={15} color={colors.textMuted} />
          <Text style={styles.pickFileBtnText}>Pick a .ics file from Files</Text>
        </TouchableOpacity>
        {importError && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={13} color={colors.high} />
            <Text style={styles.errorText}>{importError}</Text>
          </View>
        )}
      </View>
    );
  };

  const steps = isEditing
    ? [renderStep0, renderStep4, renderStep1, renderStep2]
    : [renderValueProp, renderLmsPicker, renderLmsDirections, renderLmsPaste, renderPersonalization, renderNotifications];

  const getNextLabel = () => {
    if (saving) return "Saving...";
    if (isEditing && step_n === STEP_COUNT - 1) return "Save Changes";
    if (!isEditing && step_n === 0) return "Get started";
    if (!isEditing && step_n === 1) return importLms ? "Next" : "Skip import";
    if (!isEditing && step_n === 2) return "I have the link";
    if (!isEditing && step_n === 3) {
      if (importingTasks) return "Adding...";
      if (importParsedTasks?.length) return `Add ${importParsedTasks.length} tasks`;
      if (importedCount > 0) return "Next";
      return "Skip for now";
    }
    if (!isEditing && step_n === STEP_COUNT - 1) return "Enable & Get Started";
    return "Next";
  };

  const getNextIcon = () => {
    if (saving) return null;
    if (isEditing && step_n === STEP_COUNT - 1) return "check";
    if (!isEditing && step_n === STEP_COUNT - 1) return "bell";
    if (!isEditing && step_n === 0) return "arrow-right";
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
          <Image source={require("../assets/planora-brand.jpg")} style={{ width: 24, height: 24, borderRadius: 6 }} resizeMode="cover" />
          <Text style={styles.brandName}>Planora</Text>
          {isEditing ? (
            <TouchableOpacity
              onPress={() => {
                tap();
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
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            {steps[step_n]?.()}
          </Animated.View>
        </ScrollView>

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          {step_n > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                tap();
                // If user skipped import (no LMS selected) and is now on personalization, go back to picker
                const backStep = (!isEditing && step_n === 4 && !importLms) ? 1 : step_n - 1;
                goToStep(backStep);
              }}
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
              (step_n === 0) && { marginLeft: "auto" },
              (!isEditing && step_n === 0) && { flex: 1, justifyContent: "center" },
            ]}
            onPress={() => { tap(); handleNext(); }}
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
