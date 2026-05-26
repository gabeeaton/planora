// ============================================================
// src/screens/ProfileScreen.js
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, TextInput, Modal,
  FlatList, KeyboardAvoidingView, Platform, Linking,
  Animated, PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth }         from "../hooks/useAuth";
import { useUserProfile }  from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { typography, spacing, radius, shadows, COLOR_THEMES } from "../utils/theme";
import { generateTerms, WORK_TIMES, GRADES, CREDIT_OPTS } from "../utils/termHelpers";
import { useTheme } from "../utils/ThemeContext";
import { saveUserProfile, deleteUserAccount, deleteAllUserTasks, clearIncompleteTasksForSemester } from "../services/firebase";
import { useTasks } from "../hooks/useTasks";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

const tap = () => Haptics.selectionAsync().catch(() => {});

const DAYS_SHORT = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];

const parseTimeStr = (str) => {
  if (!str) { const d = new Date(); d.setHours(9, 0, 0, 0); return d; }
  const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) { const d = new Date(); d.setHours(9, 0, 0, 0); return d; }
  let h = parseInt(m[1]), mn = parseInt(m[2]);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  const d = new Date(); d.setHours(h, mn, 0, 0); return d;
};

const formatTimeDate = (date) => {
  if (!date) return "";
  let h = date.getHours(), mn = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(mn).padStart(2, "0")} ${period}`;
};

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },

  header: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.isDark ? "transparent" : colors.bg,
  },
  avatar: {
    width: 84, // Slightly larger for better presence
    height: 84, 
    borderRadius: 42,
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard, // Solid base
    
    // Instead of a simple border, use a thick "halo" effect
    borderWidth: 4, 
    borderColor: colors.isDark ? colors.border : colors.accent,

    // Modern "Soft Glow" Shadow
    ...(colors.isDark ? {} : {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  avatarText: { 
    fontSize: 32, // Adjusted for the larger avatar
    fontFamily: "Outfit-ExtraBold",
    letterSpacing: -1,
  },
  avatarText:    { fontSize: 28, fontFamily: "Outfit-ExtraBold" },
  nameRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  displayName:   { fontSize: 16, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  nameEditRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  nameInput: {
    flex: 1, backgroundColor: colors.bgCard, borderWidth: 1,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8,
    color: colors.textPrimary, fontSize: 15,
  },
  nameSaveBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  nameCancelBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  planBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.bgCard, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.border,
  },
  planText: { fontSize: 12, color: colors.textMuted, fontFamily: "Outfit-Bold" },

  upgradeCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1.5,
  },
  upgradeLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  upgradeTitle:    { fontSize: 15, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  upgradeSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  sectionHeader: {
    ...typography.label,
    color: colors.isDark ? colors.textMuted : colors.textPrimary,
    marginBottom: 6,
    marginTop: spacing.sm,
    paddingLeft: 4,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.isDark ? 0 : 0.07,
    shadowRadius: 12,
    elevation: colors.isDark ? 0 : 3,
  },

  themeRow:      { flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  themeItem:     { alignItems: "center", gap: 4 },
  themeDot:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  themeDotActive:{ borderWidth: 3, borderColor: "#fff" },
  themeLabel:    { fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-Medium" },

  modeToggleRow: {
    flexDirection: "column",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  modeToggleLabel: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  modeToggleBtns:  { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 9,
    borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.isDark ? colors.border : "#C0C0CC",
  },
  modeBtnActive:  { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  modeBtnText:    { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.isDark ? colors.textMuted : "#6B6B80" },
  modeBtnTextActive: { color: colors.accent },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    gap: 12,
    borderBottomWidth: colors.isDark ? 0 : 1,
    borderBottomColor: "#F0F0F5",
  },
  rowIcon:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowIconDanger: { backgroundColor: colors.highGlow },
  rowLabel:      { flex: 1, fontSize: 15, color: colors.textPrimary, fontFamily: "Outfit-Medium" },
  rowRight:      { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue:      { fontSize: 13, color: colors.textSecondary },
  divider: {
    height: 1,
    backgroundColor: colors.isDark ? colors.border : "transparent",
    marginLeft: 56
  },

  classRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 12, gap: 10 },
  classRowInfo:  { flex: 1 },
  className:     { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  classMeta:     { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gradeChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1,
  },
  gradeChipText: { fontSize: 11, fontFamily: "Outfit-Bold" },

  // ── Class schedule display ──
  scheduleRow: { flexDirection: "row", alignItems: "center", overflow: "hidden" },
  scheduleStrip: { width: 4, alignSelf: "stretch", minHeight: 52 },
  scheduleRowInfo: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 12 },
  scheduleName: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  scheduleMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // ── Schedule editor ──
  scheduleEditorCard: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg,
    marginBottom: spacing.sm, gap: 4,
  },
  scheduleEditorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scheduleEditorLabel: { fontSize: 10, fontFamily: "Outfit-ExtraBold", color: colors.textMuted, letterSpacing: 0.8 },
  scheduleNameInput: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9,
    color: colors.textPrimary, fontSize: 15, marginTop: 6,
  },
  scheduleChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  scheduleChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  scheduleChipText: { fontSize: 12, fontFamily: "Outfit-Medium", color: colors.textSecondary },
  scheduleChipTextSel: { color: colors.accent, fontFamily: "Outfit-SemiBold" },
  scheduleDayRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  scheduleDayChip: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  scheduleDayChipActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  scheduleDayText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
  scheduleDayTextActive: { color: colors.accent },
  timeRow: { flexDirection: "row", gap: 8, marginTop: 14, alignItems: "flex-end" },
  timeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
  },
  timeBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  timeBtnText: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textSecondary },
  iosPicker: { height: 120, marginTop: 4 },

  version: { textAlign: "center", fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },

  // ── Modal shared ──
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36,
  },
  sheetHandleArea: {
    alignSelf: "stretch", alignItems: "center",
    paddingTop: 12, paddingBottom: 8,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle:  { fontSize: 17, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  sheetDone: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.accent, borderRadius: radius.sm,
  },
  sheetDoneText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 14 },

  optionBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  optionBtnSelected: {
    backgroundColor: colors.accentGlow,
  },
  optionText:         { fontSize: 15, color: colors.textPrimary },
  optionTextSelected: { color: colors.accent, fontFamily: "Outfit-Bold" },

  systemToggleRow: {
    flexDirection: "row", backgroundColor: colors.bgElevated,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm,
    padding: 3, gap: 2,
  },
  systemToggleBtn: {
    flex: 1, paddingVertical: 9, alignItems: "center", justifyContent: "center",
    borderRadius: radius.sm,
  },
  systemToggleBtnActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  systemToggleText:       { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
  systemToggleTextActive: { color: "#fff" },

  // Work time option
  workTimeBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  workTimeBtnSelected: { backgroundColor: colors.accentGlow },
  workTimeIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  workTimeLabel:    { fontSize: 15, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  workTimeLabelSel: { color: colors.accent },
  workTimeSub:      { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  // ── Classes editor ──
  classEditorRow: {
    backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg,
    marginBottom: spacing.sm, gap: 8,
  },
  classNameInput: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 15,
  },
  classMetaRow:  { flexDirection: "row", gap: 8 },
  classPicker:   { flex: 1, flexDirection: "row", gap: 4, flexWrap: "wrap" },
  classChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  classChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  classChipText:     { fontSize: 12, color: colors.textMuted, fontFamily: "Outfit-SemiBold" },
  classChipTextSelected: { color: colors.accent },
  classChipLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  removeClassBtn: { alignSelf: "flex-start", padding: 4 },
  addClassBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: spacing.lg, marginTop: 4, paddingVertical: 8,
  },
  addClassText: { fontSize: 14, color: colors.accent, fontFamily: "Outfit-SemiBold" },
});

// ── ProfileScreen ─────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const { user, logout }                          = useAuth();
  const { colors, accentKey, isDark, colorMode, setTheme, setColorMode } = useTheme();
  const styles = makeStyles(colors);
  const { profile }                               = useUserProfile();
  const { isPro, hasProAccess }                   = useSubscription();
  const { tasks, streak }                         = useTasks();

  const [activeThemeKey, setActiveThemeKeyState] = useState(profile?.colorTheme ?? accentKey);
  const [editingName, setEditingName]             = useState(false);
  const [nameInput, setNameInput]                 = useState("");

  // Modal state
  const [modal, setModal] = useState(null); // "semester" | "worktime" | "classes" | "schedule"
  // Classes editor local state
  const [editClasses, setEditClasses] = useState([]);
  // Schedule editor local state
  const [editSchedule, setEditSchedule] = useState([]);
  // { id, field: "startTime"|"endTime" } — which picker is open
  const [timePicking, setTimePicking] = useState(null);

  // ── Sheet animation (shared across all modals) ─────────────
  const sheetAnim = useRef(new Animated.Value(400)).current;

  const openModal = (name) => {
    sheetAnim.setValue(400);
    setModal(name);
    Animated.spring(sheetAnim, { toValue: 0, speed: 18, bounciness: 3, useNativeDriver: true }).start();
  };

  const closeModal = () => {
    Animated.timing(sheetAnim, { toValue: 400, duration: 220, useNativeDriver: true })
      .start(() => setModal(null));
  };

  const sheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) sheetAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        closeModal();
      } else {
        Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
    },
  })).current;

  useEffect(() => {
    setNameInput(profile?.name ?? "");
    if (profile?.colorTheme) setActiveThemeKeyState(profile.colorTheme);
  }, [profile?.name, profile?.colorTheme]);

  const ac = {
    accent: colors.accent,
    accentGlow: colors.accentGlow,
    accentShadow: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  };

  const displayInitial = profile?.name
    ? profile.name[0].toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all data. This cannot be undone.\n\nEnter your password to confirm.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.prompt(
              "Confirm Password",
              "Enter your password to delete your account.",
              async (password) => {
                if (!password) return;
                try {
                  await deleteUserAccount(password);
                } catch (err) {
                  const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
                    ? "Incorrect password. Please try again."
                    : err.message ?? "Something went wrong. Please try again.";
                  Alert.alert("Error", msg);
                }
              },
              "secure-text"
            );
          },
        },
      ]
    );
  };

  const handleSaveName = async () => {
    await saveUserProfile(user.uid, { name: nameInput.trim() || null });
    setEditingName(false);
  };

  const handleThemeChange = async (key) => {
    tap();
    setTheme(key);
    setActiveThemeKeyState(key);
    await saveUserProfile(user.uid, { colorTheme: key });
  };

// ── Term picker ──
  const openSemester = () => openModal("semester");
  const pickSystem = async (sys) => {
    await saveUserProfile(user.uid, { schoolSystem: sys, semester: null });
  };
  const pickSemester = async (s) => {
    const isNewTerm = profile?.semester && profile.semester !== s;
    if (isNewTerm) {
      closeModal();
      Alert.alert(
        "New Semester",
        `Switch to ${s}?`,
        [
          { text: "Clear Tasks + Classes", style: "destructive", onPress: async () => {
            const { invalidateTodayFocusCache } = await import("../services/openai");
            const { cancelStudyPlanReminders } = await import("../services/notifications");
            await Promise.all([
              saveUserProfile(user.uid, { semester: s, classes: [] }),
              clearIncompleteTasksForSemester(user.uid),
              AsyncStorage.removeItem("@planora_study_plan_cache"),
              cancelStudyPlanReminders(user.uid),
              invalidateTodayFocusCache(),
            ]).catch(() => {});
          }},
          { text: "Clear Tasks Only", style: "destructive", onPress: async () => {
            const { invalidateTodayFocusCache } = await import("../services/openai");
            const { cancelStudyPlanReminders } = await import("../services/notifications");
            await Promise.all([
              saveUserProfile(user.uid, { semester: s }),
              clearIncompleteTasksForSemester(user.uid),
              AsyncStorage.removeItem("@planora_study_plan_cache"),
              cancelStudyPlanReminders(user.uid),
              invalidateTodayFocusCache(),
            ]).catch(() => {});
          }},
          { text: "Just Switch", onPress: () => saveUserProfile(user.uid, { semester: s }) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } else {
      await saveUserProfile(user.uid, { semester: s });
      closeModal();
    }
  };

  // ── Work time picker ──
  const openWorkTime = () => openModal("worktime");
  const pickWorkTime = async (t) => {
    await saveUserProfile(user.uid, { preferredWorkTime: t });
    closeModal();
  };

  // ── Classes editor ──
  const openClasses = () => {
    const existing = (profile?.classes ?? []).map((c) => ({ ...c }));
    if (existing.length === 0) {
      existing.push({ id: Date.now().toString(), name: "", creditHours: "3", grade: "No grade yet" });
    }
    setEditClasses(existing);
    openModal("classes");
  };

  const addClassRow = () => {
    setEditClasses((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", creditHours: "3", grade: "No grade yet" },
    ]);
  };

  const updateClass = (id, field, value) => {
    setEditClasses((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeClass = (id) => {
    setEditClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const saveClasses = async () => {
    const seen = new Set();
    const valid = editClasses.filter((c) => {
      const name = c.name.trim();
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    });
    await saveUserProfile(user.uid, { classes: valid });
    closeModal();
  };

  // ── Class schedule editor ──
  const openSchedule = () => {
    const existing = (profile?.classSchedule ?? []).map((e) => ({ ...e }));
    if (existing.length === 0) {
      existing.push({ id: Date.now().toString(), className: profile?.classes?.[0]?.name ?? "", days: [], startTime: "", endTime: "" });
    }
    setEditSchedule(existing);
    setTimePicking(null);
    openModal("schedule");
  };

  const addScheduleEntry = () => {
    setEditSchedule((prev) => [
      ...prev,
      { id: Date.now().toString(), className: profile?.classes?.[0]?.name ?? "", days: [], startTime: "", endTime: "" },
    ]);
  };

  const updateScheduleEntry = (id, field, value) =>
    setEditSchedule((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));

  const toggleScheduleDay = (id, day) =>
    setEditSchedule((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const days = e.days.includes(day) ? e.days.filter((d) => d !== day) : [...e.days, day];
      return { ...e, days };
    }));

  const removeScheduleEntry = (id) =>
    setEditSchedule((prev) => prev.filter((e) => e.id !== id));

  const saveSchedule = async () => {
    const valid = editSchedule.filter((e) => e.className.trim() && e.days.length > 0 && e.startTime);
    await saveUserProfile(user.uid, { classSchedule: valid });
    closeModal();
  };

  // ── Shared components ──
  const SectionHeader = ({ title }) =>
    title ? <Text style={styles.sectionHeader}>{title}</Text> : <View style={{ height: spacing.xs }} />;

  const Row = ({ icon, label, value, onPress, danger }) => (
    <TouchableOpacity
      style={styles.row} onPress={onPress ? () => { tap(); onPress(); } : undefined}
      disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: ac.accentGlow }, danger && styles.rowIconDanger]}>
        <Feather name={icon} size={16} color={danger ? colors.high : ac.accent} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.high }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Feather name="chevron-right" size={16} color={colors.textMuted} /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: ac.accentGlow, borderColor: ac.accent, ...ac.accentShadow }]}>
            <Text style={[styles.avatarText, { color: ac.accent }]}>{displayInitial}</Text>
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[styles.nameInput, { borderColor: ac.accent }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                maxLength={40}
                autoFocus
              />
              <TouchableOpacity onPress={() => { tap(); handleSaveName(); }} style={[styles.nameSaveBtn, { backgroundColor: ac.accent }]}>
                <Feather name="check" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { tap(); setEditingName(false); }} style={styles.nameCancelBtn}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => { tap(); setEditingName(true); }}>
              <Text style={styles.displayName}>{profile?.name || user?.email}</Text>
              <Feather name="edit-2" size={13} color={colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          <View style={[styles.planBadge, hasProAccess && { borderColor: ac.accent }]}>
            <Feather name={hasProAccess ? "zap" : "user"} size={11} color={hasProAccess ? ac.accent : colors.textMuted} />
            <Text style={[styles.planText, hasProAccess && { color: ac.accent }]}>
              {isPro ? "Scholar" : "Free"}
            </Text>
          </View>
        </View>

        {/* Upgrade banner */}
        {!isPro && (
          <TouchableOpacity
            style={[styles.upgradeCard, { borderColor: ac.accent, ...ac.accentShadow }]}
            onPress={() => { tap(); navigation.navigate("Paywall"); }}
            activeOpacity={0.85}
          >
            <View style={styles.upgradeLeft}>
              <Feather name="zap" size={18} color={ac.accent} />
              <View>
                <Text style={styles.upgradeTitle}>Upgrade to Scholar</Text>
                <Text style={styles.upgradeSubtitle}>AI coaching, weekly plans & more</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={ac.accent} />
          </TouchableOpacity>
        )}

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          {/* Dark / System / Light mode */}
          <View style={styles.modeToggleRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Feather
                name={colorMode === "system" ? "monitor" : isDark ? "moon" : "sun"}
                size={16}
                color={colors.accent}
              />
              <Text style={styles.modeToggleLabel}>
                {colorMode === "system" ? "System" : isDark ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>
            <View style={styles.modeToggleBtns}>
              {[
                { mode: "light",  icon: "sun",     label: "Light"  },
                { mode: "dark",   icon: "moon",    label: "Dark"   },
                { mode: "system", icon: "monitor", label: "Auto"   },
              ].map(({ mode, icon, label }) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeBtn, colorMode === mode && styles.modeBtnActive]}
                  onPress={() => { tap(); setColorMode(mode); }}
                >
                  <Feather name={icon} size={14} color={colorMode === mode ? colors.accent : (colors.isDark ? colors.textMuted : "#6B6B80")} />
                  <Text style={[styles.modeBtnText, colorMode === mode && styles.modeBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color accent */}
          <View style={[styles.themeRow, { borderTopWidth: 1, borderTopColor: colors.isDark ? colors.border : "#F0F0F5", paddingTop: spacing.md }]}>
            {Object.values(COLOR_THEMES).map((theme) => {
              const isActive = activeThemeKey === theme.key;
              return (
                <View key={theme.key} style={styles.themeItem}>
                  <TouchableOpacity
                    style={[styles.themeDot, { backgroundColor: theme.accent }, isActive && styles.themeDotActive]}
                    onPress={() => handleThemeChange(theme.key)}
                  >
                    {isActive && <Feather name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <Text style={[styles.themeLabel, isActive && { color: theme.accent, fontFamily: "Outfit-Bold" }]}>
                    {theme.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Academic profile — each row is independently editable */}
        <SectionHeader title="Academic Profile" />
        <View style={styles.card}>
          <Row icon="book"   label="Term"           value={profile?.semester ?? "Not set"}           onPress={openSemester} />
          <View style={styles.divider} />
          <Row icon="layers" label="Classes"        value={profile?.classes?.length ? `${profile.classes.length} classes` : "Not set"} onPress={openClasses} />
          <View style={styles.divider} />
          <Row icon="clock"  label="Class Schedule" value={profile?.classSchedule?.length ? `${profile.classSchedule.length} ${profile.classSchedule.length === 1 ? "class" : "classes"}` : "Not set"} onPress={openSchedule} />
          <View style={styles.divider} />
          <Row icon="sun"    label="Best work time" value={profile?.preferredWorkTime ?? "Not set"}  onPress={openWorkTime} />
        </View>

        {/* Classes list */}
        {profile?.classes?.length > 0 && (
          <>
            <SectionHeader title="Your Classes" />
            <View style={styles.card}>
              {profile.classes.map((cls, i) => {
                const grade = cls.grade === "No grade yet" ? null : (cls.grade ?? null);
                const gradeColor = grade === "A" ? colors.low : grade === "B" ? colors.accent : grade === "C" ? colors.medium : grade === "D" || grade === "F" ? colors.high : null;
                return (
                  <View key={cls.id ?? i}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.classRow}>
                      <View style={styles.classRowInfo}>
                        <Text style={styles.className}>{cls.name}</Text>
                        <Text style={styles.classMeta}>{cls.creditHours} credits</Text>
                      </View>
                      {grade && gradeColor ? (
                        <View style={[styles.gradeChip, { borderColor: gradeColor + "66", backgroundColor: gradeColor + "18" }]}>
                          <Text style={[styles.gradeChipText, { color: gradeColor }]}>{grade}</Text>
                        </View>
                      ) : (
                        <View style={[styles.gradeChip, { borderColor: colors.border, backgroundColor: "transparent" }]}>
                          <Text style={[styles.gradeChipText, { color: colors.textMuted }]}>—</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Class Schedule summary */}
        {profile?.classSchedule?.length > 0 && (
          <>
            <SectionHeader title="Class Schedule" />
            <View style={styles.card}>
              {profile.classSchedule.map((entry, i) => (
                <View key={entry.id ?? i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.scheduleRow}>
                    <View style={[styles.scheduleStrip, { backgroundColor: colors.accent }]} />
                    <View style={styles.scheduleRowInfo}>
                      <Text style={styles.scheduleName}>{entry.className}</Text>
                      <Text style={styles.scheduleMeta}>
                        {entry.days.join(" · ")}{entry.startTime ? `  ·  ${entry.startTime}${entry.endTime ? ` – ${entry.endTime}` : ""}` : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Progress */}
        <SectionHeader title="Progress" />
        <View style={styles.card}>
          <Row
            icon="bar-chart-2"
            label="View Progress"
            onPress={() => { tap(); navigation.navigate("Stats"); }}
          />
        </View>

        {/* Calendar */}
        <SectionHeader title="Calendar" />
        <View style={styles.card}>
          <Row
            icon="refresh-cw"
            label="Sync Calendar"
            value={profile?.icsUrl ? "Connected" : "Not connected"}
            onPress={() => { tap(); navigation.navigate("SyllabusParser"); }}
          />
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <Row icon="mail" label="Email" value={user?.email} />
        </View>

        <SectionHeader title="Support" />
        <View style={styles.card}>
          <Row
            icon="mail"
            label="Contact / Report Bug"
            value="hello@planoraapp.net"
            onPress={() => Linking.openURL("mailto:hello@planoraapp.net").catch(() => {})}
          />
          <View style={styles.divider} />
          <Row
            icon="shield"
            label="Privacy Policy"
            onPress={() => Linking.openURL("https://planoraapp.net/privacy").catch(() => {})}
          />
          <View style={styles.divider} />
          <Row
            icon="file-text"
            label="Terms of Service"
            onPress={() => Linking.openURL("https://planoraapp.net/terms").catch(() => {})}
          />
        </View>

        <SectionHeader title="" />
        <View style={styles.card}>
          <Row icon="log-out" label="Sign Out" onPress={handleLogout} danger />
          <Row icon="trash-2" label="Delete Account" onPress={handleDeleteAccount} danger />
        </View>

        {/* <SectionHeader title="Developer" />
        <View style={styles.card}>
          <Row
            icon="book-open"
            label="Test Study Plan Notification"
            value="fires in 5 seconds"
            onPress={() => {
              testStudyPlanNotification();
              Alert.alert("Study plan test scheduled", "Lock your phone — notification arrives in 5 seconds. Tap it to verify it opens the study plan.");
            }}
          />
          <Row
            icon="layers"
            label="Test Batch Notifications"
            value="5 scenarios over 40s"
            onPress={() => {
              testBatchNotifications();
              Alert.alert("Batch tests scheduled", "Lock your phone — 5 batch scenarios arriving over the next 40 seconds.");
            }}
          />
          <Row
            icon="bell"
            label="Test All Notification Types"
            value="6 types over 45s"
            onPress={() => {
              testAllNotifications(tasks, streak);
              Alert.alert("Notifications scheduled", "Lock your phone — 6 notifications will arrive over the next 45 seconds.");
            }}
          />
        </View> */}

        <Text style={styles.version}>Planora v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Term picker modal ── */}
      <Modal visible={modal === "semester"} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { tap(); closeModal(); }}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandleArea} {...sheetPan.panHandlers}><View style={styles.sheetHandle} /></View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Term</Text>
              <TouchableOpacity onPress={() => { tap(); closeModal(); }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.systemToggleRow}>
              {["semester", "quarter"].map((sys) => {
                const active = (profile?.schoolSystem ?? "semester") === sys;
                return (
                  <TouchableOpacity
                    key={sys}
                    style={[styles.systemToggleBtn, active && styles.systemToggleBtnActive]}
                    onPress={() => { tap(); pickSystem(sys); }}
                  >
                    <Text style={[styles.systemToggleText, active && styles.systemToggleTextActive]}>
                      {sys.charAt(0).toUpperCase() + sys.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {generateTerms(profile?.schoolSystem ?? "semester").map((s) => {
              const sel = profile?.semester === s;
              return (
                <TouchableOpacity key={s} style={[styles.optionBtn, sel && styles.optionBtnSelected]} onPress={() => { tap(); pickSemester(s); }}>
                  <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{s}</Text>
                  {sel && <Feather name="check" size={16} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Work time picker modal ── */}
      <Modal visible={modal === "worktime"} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { tap(); closeModal(); }}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandleArea} {...sheetPan.panHandlers}><View style={styles.sheetHandle} /></View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Best Work Time</Text>
              <TouchableOpacity onPress={() => { tap(); closeModal(); }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {[
              { label: "Morning",   sub: "6am – 12pm",      icon: "sun",    val: WORK_TIMES[0] },
              { label: "Afternoon", sub: "12pm – 5pm",      icon: "cloud",  val: WORK_TIMES[1] },
              { label: "Evening",   sub: "5pm – 9pm",       icon: "sunset", val: WORK_TIMES[2] },
              { label: "Night",     sub: "9pm and later",   icon: "moon",   val: WORK_TIMES[3] },
            ].map(({ label, sub, icon, val }) => {
              const sel = profile?.preferredWorkTime === val;
              return (
                <TouchableOpacity key={val} style={[styles.workTimeBtn, sel && styles.workTimeBtnSelected]} onPress={() => { tap(); pickWorkTime(val); }}>
                  <View style={[styles.workTimeIconWrap, { backgroundColor: sel ? colors.accentGlow : colors.bgElevated }]}>
                    <Feather name={icon} size={18} color={sel ? colors.accent : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workTimeLabel, sel && styles.workTimeLabelSel]}>{label}</Text>
                    <Text style={styles.workTimeSub}>{sub}</Text>
                  </View>
                  {sel && <Feather name="check" size={16} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Classes editor modal ── */}
      <Modal visible={modal === "classes"} transparent animationType="none" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal}>
            <Animated.View style={[styles.sheet, { maxHeight: "85%", transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandleArea} {...sheetPan.panHandlers}><View style={styles.sheetHandle} /></View>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Edit Classes</Text>
                <TouchableOpacity style={styles.sheetDone} onPress={() => { tap(); saveClasses(); }}>
                  <Text style={styles.sheetDoneText}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ paddingTop: spacing.sm }}
                bounces={true}
                scrollEventThrottle={16}
                onScrollEndDrag={({ nativeEvent }) => {
                  if (nativeEvent.contentOffset.y < -52) closeModal();
                }}
              >
                {editClasses.map((cls) => (
                  <View key={cls.id} style={styles.classEditorRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TextInput
                        style={[styles.classNameInput, { flex: 1 }]}
                        placeholder="Class name (e.g. MATH 201)"
                        placeholderTextColor={colors.textMuted}
                        value={cls.name}
                        onChangeText={(v) => updateClass(cls.id, "name", v)}
                      />
                      <TouchableOpacity onPress={() => { tap(); removeClass(cls.id); }} style={styles.removeClassBtn}>
                        <Feather name="trash-2" size={16} color={colors.high} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.classMetaRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.classChipLabel}>CREDITS</Text>
                        <View style={styles.classPicker}>
                          {CREDIT_OPTS.map((c) => (
                            <TouchableOpacity
                              key={c}
                              style={[styles.classChip, cls.creditHours === c && styles.classChipSelected]}
                              onPress={() => { tap(); updateClass(cls.id, "creditHours", c); }}
                            >
                              <Text style={[styles.classChipText, cls.creditHours === c && styles.classChipTextSelected]}>{c}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.classChipLabel}>GRADE</Text>
                        <View style={styles.classPicker}>
                          {GRADES.map((g) => (
                            <TouchableOpacity
                              key={g}
                              style={[styles.classChip, cls.grade === g && styles.classChipSelected]}
                              onPress={() => { tap(); updateClass(cls.id, "grade", g); }}
                            >
                              <Text style={[styles.classChipText, cls.grade === g && styles.classChipTextSelected]}>{g}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addClassBtn} onPress={() => { tap(); addClassRow(); }}>
                  <Feather name="plus-circle" size={16} color={colors.accent} />
                  <Text style={styles.addClassText}>Add another class</Text>
                </TouchableOpacity>

                <View style={{ height: 24 }} />
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Class Schedule editor modal ── */}
      <Modal visible={modal === "schedule"} transparent animationType="none" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal}>
            <Animated.View style={[styles.sheet, { maxHeight: "90%", transform: [{ translateY: sheetAnim }] }]}>
              <View style={styles.sheetHandleArea} {...sheetPan.panHandlers}><View style={styles.sheetHandle} /></View>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Class Schedule</Text>
                <TouchableOpacity style={styles.sheetDone} onPress={() => { tap(); saveSchedule(); }}>
                  <Text style={styles.sheetDoneText}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ paddingTop: spacing.sm }}
                bounces={true}
                scrollEventThrottle={16}
                onScrollEndDrag={({ nativeEvent }) => {
                  if (nativeEvent.contentOffset.y < -52) closeModal();
                }}
              >
                {editSchedule.map((entry) => {
                  const classNames = (profile?.classes ?? []).map((c) => c.name).filter(Boolean);
                  return (
                    <View key={entry.id} style={styles.scheduleEditorCard}>
                      {/* Header row with delete */}
                      <View style={styles.scheduleEditorHeader}>
                        <Text style={styles.scheduleEditorLabel}>CLASS NAME</Text>
                        <TouchableOpacity onPress={() => { tap(); removeScheduleEntry(entry.id); }} style={{ padding: 4 }}>
                          <Feather name="trash-2" size={15} color={colors.high} />
                        </TouchableOpacity>
                      </View>

                      {/* Class name input */}
                      <TextInput
                        style={styles.scheduleNameInput}
                        placeholder="e.g. MATH 201"
                        placeholderTextColor={colors.textMuted}
                        value={entry.className}
                        onChangeText={(v) => updateScheduleEntry(entry.id, "className", v)}
                      />

                      {/* Quick-fill chips from existing classes */}
                      {classNames.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: "row", gap: 6, paddingBottom: 2 }}>
                            {classNames.map((cn) => (
                              <TouchableOpacity
                                key={cn}
                                style={[styles.scheduleChip, entry.className === cn && styles.scheduleChipSelected]}
                                onPress={() => { tap(); updateScheduleEntry(entry.id, "className", cn); }}
                              >
                                <Text style={[styles.scheduleChipText, entry.className === cn && styles.scheduleChipTextSel]}>{cn}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      )}

                      {/* Days */}
                      <Text style={[styles.scheduleEditorLabel, { marginTop: 14 }]}>DAYS</Text>
                      <View style={styles.scheduleDayRow}>
                        {DAYS_SHORT.map((day) => {
                          const active = entry.days.includes(day);
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[styles.scheduleDayChip, active && styles.scheduleDayChipActive]}
                              onPress={() => { tap(); toggleScheduleDay(entry.id, day); }}
                            >
                              <Text style={[styles.scheduleDayText, active && styles.scheduleDayTextActive]}>{day}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Start / End time */}
                      <View style={styles.timeRow}>
                        {/* Start */}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleEditorLabel}>START TIME</Text>
                          <TouchableOpacity
                            style={[
                              styles.timeBtn,
                              timePicking?.id === entry.id && timePicking?.field === "startTime" && styles.timeBtnActive,
                            ]}
                            onPress={() => {
                              tap();
                              setTimePicking(
                                timePicking?.id === entry.id && timePicking?.field === "startTime"
                                  ? null
                                  : { id: entry.id, field: "startTime" }
                              );
                            }}
                            activeOpacity={0.7}
                          >
                            <Feather name="clock" size={13} color={timePicking?.id === entry.id && timePicking?.field === "startTime" ? colors.accent : colors.textMuted} />
                            <Text style={[styles.timeBtnText, timePicking?.id === entry.id && timePicking?.field === "startTime" && { color: colors.accent }]}>
                              {entry.startTime || "Set time"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={[styles.scheduleEditorLabel, { alignSelf: "flex-end", marginBottom: 12, paddingHorizontal: 4 }]}>–</Text>

                        {/* End */}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleEditorLabel}>END TIME</Text>
                          <TouchableOpacity
                            style={[
                              styles.timeBtn,
                              timePicking?.id === entry.id && timePicking?.field === "endTime" && styles.timeBtnActive,
                            ]}
                            onPress={() => {
                              tap();
                              setTimePicking(
                                timePicking?.id === entry.id && timePicking?.field === "endTime"
                                  ? null
                                  : { id: entry.id, field: "endTime" }
                              );
                            }}
                            activeOpacity={0.7}
                          >
                            <Feather name="clock" size={13} color={timePicking?.id === entry.id && timePicking?.field === "endTime" ? colors.accent : colors.textMuted} />
                            <Text style={[styles.timeBtnText, timePicking?.id === entry.id && timePicking?.field === "endTime" && { color: colors.accent }]}>
                              {entry.endTime || "Set time"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Inline wheel picker (iOS) / fires Android dialog */}
                      {timePicking?.id === entry.id && (
                        <DateTimePicker
                          value={parseTimeStr(timePicking.field === "startTime" ? entry.startTime : entry.endTime)}
                          mode="time"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          themeVariant={colors.isDark ? "dark" : "light"}
                          onChange={(_, date) => {
                            if (!date) { if (Platform.OS === "android") setTimePicking(null); return; }
                            const formatted = formatTimeDate(date);
                            updateScheduleEntry(entry.id, timePicking.field, formatted);
                            if (Platform.OS === "android") setTimePicking(null);
                          }}
                          style={Platform.OS === "ios" ? styles.iosPicker : undefined}
                        />
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addClassBtn} onPress={() => { tap(); addScheduleEntry(); }}>
                  <Feather name="plus-circle" size={16} color={colors.accent} />
                  <Text style={styles.addClassText}>Add another class time</Text>
                </TouchableOpacity>

                <View style={{ height: 32 }} />
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
