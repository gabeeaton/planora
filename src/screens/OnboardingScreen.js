// ============================================================
// src/screens/OnboardingScreen.js
// Shown on first login AND accessible from Profile for editing.
// Collects: name, current semester, classes, preferred work time.
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth }        from "../hooks/useAuth";
import { colors, spacing, radius, shadows, typography } from "../utils/theme";
import { saveUserProfile } from "../services/firebase";

// ── Dynamic semester generation ───────────────────────────────
// Only shows current and future semesters (never past ones)
const generateSemesters = () => {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = now.getMonth(); // 0-indexed

  const results = [];

  // Generate for current year + next 2 years
  for (let y = year; y <= year + 2; y++) {
    // Spring: Jan–May (month 0–4)
    // Summer: May–Aug (month 4–7)
    // Fall:   Aug–Dec (month 7–11)
    const seasons = [
      { name: `Spring ${y}`, startMonth: 0 },
      { name: `Summer ${y}`, startMonth: 4 },
      { name: `Fall ${y}`,   startMonth: 7 },
    ];
    seasons.forEach(({ name, startMonth }) => {
      // Skip if this semester started more than 3 months ago
      const semesterStartApprox = new Date(y, startMonth, 1);
      const monthsAgo = (now.getFullYear() - y) * 12 + (now.getMonth() - startMonth);
      if (monthsAgo <= 3) results.push(name);
    });
  }

  // Deduplicate and limit
  return [...new Set(results)].slice(0, 8);
};

const SEMESTERS   = generateSemesters();
const WORK_TIMES  = ["Morning (6am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–9pm)", "Night (9pm+)"];
const GRADES      = ["A", "B", "C", "D", "Not sure"];
const CREDIT_OPTS = ["1", "2", "3", "4", "5+"];
const STEP_COUNT  = 3;

const generateId = () => Math.random().toString(36).substr(2, 9);

const OnboardingScreen = ({ navigation }) => {
  const { user }          = useAuth();
  const { profile, updateProfile } = useUserProfile();

  const isEditing = !!profile?.onboardingComplete;

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — identity
  const [name, setName]           = useState("");
  const [semester, setSemester]   = useState(null);

  // Step 1 — classes
  const [classes, setClasses] = useState([{ id: generateId(), name: "", creditHours: "3", grade: "B" }]);

  // Step 2 — preferences
  const [workTime, setWorkTime]         = useState(null);
  const [hardestClass, setHardestClass] = useState(null);

  // Pre-fill when editing
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSemester(profile.semester ?? null);
      setClasses(profile.classes?.length
        ? profile.classes.map((c) => ({ ...c, creditHours: String(c.creditHours ?? 3) }))
        : [{ id: generateId(), name: "", creditHours: "3", grade: "B" }]
      );
      setWorkTime(profile.preferredWorkTime ?? null);
      setHardestClass(profile.hardestClass ?? null);
    }
  }, []);

  // ── Class helpers ─────────────────────────────────────────
  const addClass    = () => setClasses((p) => [...p, { id: generateId(), name: "", creditHours: "3", grade: "B" }]);
  const removeClass = (id) => setClasses((p) => p.filter((c) => c.id !== id));
  const updateClass = (id, field, value) =>
    setClasses((p) => p.map((c) => c.id === id ? { ...c, [field]: value } : c));

  // ── Navigation ────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 0) return !!semester;
    if (step === 1) return classes.length > 0 && classes.every((c) => c.name.trim().length > 0);
    if (step === 2) return !!workTime;
    return false;
  };

  const handleNext = () => {
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const data = {
        name:              name.trim() || null,
        semester,
        classes: classes.map((c) => ({
          id:          c.id,
          name:        c.name.trim(),
          creditHours: parseInt(c.creditHours) || 3,
          grade:       c.grade,
        })),
        preferredWorkTime:  workTime,
        hardestClass:       hardestClass ?? null,
        onboardingComplete: true,
      };
      if (!isEditing) {
        data.trialStart = new Date().toISOString();
        data.isPro      = false;
        data.createdAt  = new Date().toISOString();
      }
      await saveUserProfile(user.uid, data);
      if (isEditing && navigation.canGoBack()) navigation.goBack();
    } catch (err) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
      setSaving(false);
    }
  };

  // ── Steps ─────────────────────────────────────────────────

  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Let's get you set up</Text>
      <Text style={styles.stepSubtitle}>This helps the AI personalize everything for you.</Text>

      {/* Optional name */}
      <Text style={styles.fieldLabel}>YOUR NAME (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>CURRENT SEMESTER</Text>
      {SEMESTERS.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.optionBtn, semester === s && styles.optionBtnSelected]}
          onPress={() => setSemester(s)}
        >
          <Text style={[styles.optionText, semester === s && styles.optionTextSelected]}>{s}</Text>
          {semester === s && <Feather name="check" size={16} color={colors.accent} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Add your classes</Text>
      <Text style={styles.stepSubtitle}>The AI weights recommendations by class difficulty and credit hours.</Text>

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
                style={[styles.chipSm, cls.creditHours === c && styles.chipSmSelected]}
                onPress={() => updateClass(cls.id, "creditHours", c)}
              >
                <Text style={[styles.chipSmText, cls.creditHours === c && styles.chipSmTextSelected]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.subLabel}>Current Grade</Text>
          <View style={styles.chipRow}>
            {GRADES.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chipSm, cls.grade === g && styles.chipSmSelected]}
                onPress={() => updateClass(cls.id, "grade", g)}
              >
                <Text style={[styles.chipSmText, cls.grade === g && styles.chipSmTextSelected]}>{g}</Text>
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
      <Text style={styles.stepSubtitle}>We'll schedule your hardest tasks during your peak hours.</Text>

      {WORK_TIMES.map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.optionBtn, workTime === t && styles.optionBtnSelected]}
          onPress={() => setWorkTime(t)}
        >
          <Text style={[styles.optionText, workTime === t && styles.optionTextSelected]}>{t}</Text>
          {workTime === t && <Feather name="check" size={16} color={colors.accent} />}
        </TouchableOpacity>
      ))}

      {classes.filter((c) => c.name.trim()).length > 0 && (
        <>
          <Text style={[styles.stepSubtitle, { marginTop: spacing.lg }]}>
            Which class do you struggle with most? (optional)
          </Text>
          <View style={styles.chipRow}>
            {classes.filter((c) => c.name.trim()).map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chipSm, hardestClass === cls.id && styles.chipSmSelected]}
                onPress={() => setHardestClass(hardestClass === cls.id ? null : cls.id)}
              >
                <Text style={[styles.chipSmText, hardestClass === cls.id && styles.chipSmTextSelected]}>
                  {cls.name.trim()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const steps = [renderStep0, renderStep1, renderStep2];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* Progress */}
        <View style={styles.progressBar}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View key={i} style={[styles.progressSegment, i <= step && styles.progressSegmentActive]} />
          ))}
        </View>

        {/* Brand row */}
        <View style={styles.brandRow}>
          <Feather name="check-square" size={20} color={colors.accent} />
          <Text style={styles.brandName}>TaskFlow</Text>
          {isEditing ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>14-day free trial</Text>
            </View>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {steps[step]?.()}
        </ScrollView>

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Feather name="arrow-left" size={18} color={colors.textSecondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !canAdvance() && styles.nextBtnDisabled,
              step === 0 && { marginLeft: "auto" },
            ]}
            onPress={handleNext}
            disabled={!canAdvance() || saving}
          >
            <Text style={styles.nextBtnText}>
              {saving ? "Saving..." : isEditing && step === STEP_COUNT - 1 ? "Save Changes" : step === STEP_COUNT - 1 ? "Start 14-Day Trial" : "Next"}
            </Text>
            {!saving && (
              <Feather name={step === STEP_COUNT - 1 ? "check" : "arrow-right"} size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bg },
  progressBar:     { flexDirection: "row", gap: 4, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressSegmentActive: { backgroundColor: colors.accent },
  brandRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  brandName:      { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  trialBadge: {
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent, marginLeft: "auto",
  },
  trialBadgeText: { fontSize: 11, color: colors.accent, fontWeight: "700" },
  scroll:         { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  stepContainer:  { paddingTop: spacing.md },
  stepTitle: {
    fontSize: 26, fontWeight: "800", color: colors.textPrimary,
    marginBottom: 8, letterSpacing: -0.5,
  },
  stepSubtitle:   { ...typography.body, marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: 14, marginBottom: 4,
  },
  optionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  optionBtnSelected:  { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  optionText:         { fontSize: 15, color: colors.textSecondary, fontWeight: "500" },
  optionTextSelected: { color: colors.accent, fontWeight: "700" },
  classCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  classCardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: spacing.sm,
  },
  classCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase" },
  subLabel:       { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  chipRow:        { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipSm: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgInput,
  },
  chipSmSelected:     { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  chipSmText:         { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  chipSmTextSelected: { color: colors.accent },
  addClassBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 12, justifyContent: "center",
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.accent, borderRadius: radius.md,
  },
  addClassText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  bottomNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  backBtn:         { flexDirection: "row", alignItems: "center", gap: 6, padding: 4 },
  backBtnText:     { color: colors.textSecondary, fontSize: 15 },
  nextBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 13, paddingHorizontal: spacing.lg, ...shadows.accent,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default OnboardingScreen;