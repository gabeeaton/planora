// ============================================================
// src/screens/ProfileScreen.js
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, TextInput, Modal,
  FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth }         from "../hooks/useAuth";
import { useUserProfile }  from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { typography, spacing, radius, shadows, COLOR_THEMES } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { saveUserProfile } from "../services/firebase";

// ── Constants (mirrors OnboardingScreen) ─────────────────────
const generateSemesters = () => {
  const now = new Date();
  const year = now.getFullYear();
  const results = [];
  for (let y = year; y <= year + 2; y++) {
    [
      { name: `Spring ${y}`, startMonth: 0 },
      { name: `Summer ${y}`, startMonth: 4 },
      { name: `Fall ${y}`,   startMonth: 7 },
    ].forEach(({ name, startMonth }) => {
      const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() - startMonth);
      if (monthsAgo <= 3) results.push(name);
    });
  }
  return [...new Set(results)].slice(0, 8);
};

const SEMESTERS  = generateSemesters();
const WORK_TIMES = [
  "Morning (6am–12pm)",
  "Afternoon (12pm–5pm)",
  "Evening (5pm–9pm)",
  "Night (9pm+)",
];
const GRADES     = ["A", "B", "C", "D", "Not sure"];
const CREDIT_OPTS = ["1", "2", "3", "4", "5+"];

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  header:       { alignItems: "center", paddingVertical: spacing.lg, marginBottom: spacing.md },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText:    { fontSize: 28, fontWeight: "800" },
  nameRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  displayName:   { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
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
  planText: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },

  upgradeCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1,
  },
  upgradeLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  upgradeTitle:    { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  upgradeSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  sectionHeader: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.sm, paddingLeft: 4 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: "hidden",
  },

  themeRow:      { flexDirection: "row", gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  themeItem:     { alignItems: "center", gap: 4 },
  themeDot:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  themeDotActive:{ borderWidth: 3, borderColor: "#fff" },
  themeLabel:    { fontSize: 10, color: colors.textMuted, fontWeight: "500" },

  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: 14, gap: 12,
  },
  rowIcon:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowIconDanger: { backgroundColor: "rgba(255,92,92,0.12)" },
  rowLabel:      { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: "500" },
  rowRight:      { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue:      { fontSize: 13, color: colors.textSecondary },
  divider:       { height: 1, backgroundColor: colors.border, marginLeft: 56 },

  classRow:  { paddingHorizontal: spacing.md, paddingVertical: 12 },
  className: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  classMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  version: { textAlign: "center", fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },

  // ── Modal shared ──
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle:  { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  sheetDone: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.accent, borderRadius: radius.sm,
  },
  sheetDoneText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  optionBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  optionText:         { fontSize: 15, color: colors.textPrimary },
  optionTextSelected: { color: colors.accent, fontWeight: "700" },

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
  classChipText:     { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  classChipTextSelected: { color: colors.accent },
  classChipLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  removeClassBtn: { alignSelf: "flex-start", padding: 4 },
  addClassBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: spacing.lg, marginTop: 4, paddingVertical: 8,
  },
  addClassText: { fontSize: 14, color: colors.accent, fontWeight: "600" },
});

// ── ProfileScreen ─────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const { user, logout }                          = useAuth();
  const { colors, accentKey, setTheme } = useTheme();
  const styles = makeStyles(colors);
  const { profile }                               = useUserProfile();
  const { isPro, hasProAccess }                   = useSubscription();

  const [activeThemeKey, setActiveThemeKeyState] = useState(profile?.colorTheme ?? accentKey);
  const [editingName, setEditingName]             = useState(false);
  const [nameInput, setNameInput]                 = useState("");

  // Modal state
  const [modal, setModal] = useState(null); // "semester" | "worktime" | "classes"
  // Classes editor local state
  const [editClasses, setEditClasses] = useState([]);

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

  const handleSaveName = async () => {
    await saveUserProfile(user.uid, { name: nameInput.trim() || null });
    setEditingName(false);
  };

  const handleThemeChange = async (key) => {
    setTheme(key);
    setActiveThemeKeyState(key);
    await saveUserProfile(user.uid, { colorTheme: key });
  };

// ── Semester picker ──
  const openSemester = () => setModal("semester");
  const pickSemester = async (s) => {
    await saveUserProfile(user.uid, { semester: s });
    setModal(null);
  };

  // ── Work time picker ──
  const openWorkTime = () => setModal("worktime");
  const pickWorkTime = async (t) => {
    await saveUserProfile(user.uid, { preferredWorkTime: t });
    setModal(null);
  };

  // ── Classes editor ──
  const openClasses = () => {
    const existing = (profile?.classes ?? []).map((c) => ({ ...c }));
    if (existing.length === 0) {
      existing.push({ id: Date.now().toString(), name: "", creditHours: "3", grade: "B" });
    }
    setEditClasses(existing);
    setModal("classes");
  };

  const addClassRow = () => {
    setEditClasses((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", creditHours: "3", grade: "B" },
    ]);
  };

  const updateClass = (id, field, value) => {
    setEditClasses((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeClass = (id) => {
    setEditClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const saveClasses = async () => {
    const valid = editClasses.filter((c) => c.name.trim().length > 0);
    await saveUserProfile(user.uid, { classes: valid });
    setModal(null);
  };

  // ── Shared components ──
  const SectionHeader = ({ title }) =>
    title ? <Text style={styles.sectionHeader}>{title}</Text> : <View style={{ height: spacing.xs }} />;

  const Row = ({ icon, label, value, onPress, danger }) => (
    <TouchableOpacity
      style={styles.row} onPress={onPress}
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
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} style={[styles.nameSaveBtn, { backgroundColor: ac.accent }]}>
                <Feather name="check" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingName(false)} style={styles.nameCancelBtn}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
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
            style={[styles.upgradeCard, { borderColor: ac.accentGlow, ...ac.accentShadow }]}
            onPress={() => navigation.navigate("Paywall")}
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

        {/* Color theme */}
        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <View style={styles.themeRow}>
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
                  <Text style={[styles.themeLabel, isActive && { color: theme.accent, fontWeight: "700" }]}>
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
          <Row icon="book"   label="Semester"      value={profile?.semester ?? "Not set"}           onPress={openSemester} />
          <View style={styles.divider} />
          <Row icon="layers" label="Classes"        value={profile?.classes?.length ? `${profile.classes.length} classes` : "Not set"} onPress={openClasses} />
          <View style={styles.divider} />
          <Row icon="sun"    label="Best work time" value={profile?.preferredWorkTime ?? "Not set"}  onPress={openWorkTime} />
        </View>

        {/* Classes list */}
        {profile?.classes?.length > 0 && (
          <>
            <SectionHeader title="Your Classes" />
            <View style={styles.card}>
              {profile.classes.map((cls, i) => (
                <View key={cls.id ?? i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.classRow}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <Text style={styles.classMeta}>{cls.creditHours} credits · Grade: {cls.grade ?? "?"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <Row icon="mail" label="Email" value={user?.email} />
        </View>

        <SectionHeader title="" />
        <View style={styles.card}>
          <Row icon="log-out" label="Sign Out" onPress={handleLogout} danger />
        </View>

        <Text style={styles.version}>Planora v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Semester picker modal ── */}
      <Modal visible={modal === "semester"} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModal(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Semester</Text>
              <TouchableOpacity onPress={() => setModal(null)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {SEMESTERS.map((s) => (
              <TouchableOpacity key={s} style={styles.optionBtn} onPress={() => pickSemester(s)}>
                <Text style={[styles.optionText, profile?.semester === s && styles.optionTextSelected]}>{s}</Text>
                {profile?.semester === s && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Work time picker modal ── */}
      <Modal visible={modal === "worktime"} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModal(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Best Work Time</Text>
              <TouchableOpacity onPress={() => setModal(null)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {WORK_TIMES.map((t) => (
              <TouchableOpacity key={t} style={styles.optionBtn} onPress={() => pickWorkTime(t)}>
                <Text style={[styles.optionText, profile?.preferredWorkTime === t && styles.optionTextSelected]}>{t}</Text>
                {profile?.preferredWorkTime === t && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Classes editor modal ── */}
      <Modal visible={modal === "classes"} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setModal(null)}>
            <View style={[styles.sheet, { maxHeight: "85%" }]}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Edit Classes</Text>
                <TouchableOpacity style={styles.sheetDone} onPress={saveClasses}>
                  <Text style={styles.sheetDoneText}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" style={{ paddingTop: spacing.sm }}>
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
                      <TouchableOpacity onPress={() => removeClass(cls.id)} style={styles.removeClassBtn}>
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
                              onPress={() => updateClass(cls.id, "creditHours", c)}
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
                              onPress={() => updateClass(cls.id, "grade", g)}
                            >
                              <Text style={[styles.classChipText, cls.grade === g && styles.classChipTextSelected]}>{g}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addClassBtn} onPress={addClassRow}>
                  <Feather name="plus-circle" size={16} color={colors.accent} />
                  <Text style={styles.addClassText}>Add another class</Text>
                </TouchableOpacity>

                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default ProfileScreen;
