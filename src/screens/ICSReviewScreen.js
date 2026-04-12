// ============================================================
// src/screens/ICSReviewScreen.js
// Shows parsed ICS tasks for user to confirm/edit before import.
// Accessed from SyllabusParserScreen after ICS parse.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { spacing, radius, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../hooks/useAuth";
import { saveUserProfile } from "../services/firebase";

const PRIORITY_META = {
  HIGH:   { color: "#FF5C5C", label: "High" },
  MEDIUM: { color: "#FFB347", label: "Med" },
  LOW:    { color: "#5CFF8F", label: "Low" },
};

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle:    { ...typography.h2, color: colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cancelBtn:      { padding: 4 },
  importBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 8, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText:     { color: "#fff", fontSize: 13, fontWeight: "700" },

  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 40 },

  hint: {
    ...typography.bodySmall, color: colors.textSecondary,
    marginBottom: spacing.md, lineHeight: 17,
  },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
    overflow: "hidden",
  },
  cardRemoved: { opacity: 0.4 },
  cardTop: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.md, paddingTop: 12, paddingBottom: 6, gap: 10,
  },
  priorityDot: {
    width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
  },
  titleInput: {
    flex: 1, fontSize: 14, fontWeight: "600",
    color: colors.textPrimary, padding: 0,
  },
  removeBtn:    { padding: 4 },
  cardMeta: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.bgInput, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  metaChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: "500" },
  classInput: {
    flex: 1, fontSize: 11, color: colors.textSecondary,
    backgroundColor: colors.bgInput, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  priorityRow: {
    flexDirection: "row", gap: 6, paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  priorityBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  priorityBtnText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },

  summaryRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  summaryText: { ...typography.body, color: colors.textPrimary, flex: 1 },

  // Grade prompt
  gradeOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  gradeSheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36, maxHeight: "85%",
  },
  gradeSheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  gradeSheetHeader: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  gradeSheetTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
  gradeSheetSub:   { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  gradeClassItem:  { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  gradeClassName:  { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 10 },
  gradeChipsRow:   { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  gradeChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  gradeChipText:         { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  gradeChipTextSelected: { color: colors.accent },
  gradeActions:    { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 10 },
  gradeSaveBtn:    { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  gradeSaveBtnText:{ color: "#fff", fontSize: 15, fontWeight: "700" },
  gradeSkipBtn:    { alignItems: "center", paddingVertical: 10 },
  gradeSkipText:   { fontSize: 13, color: colors.textMuted },
});

const ICSReviewScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { createManyTasks }    = useTasks();
  const { profile }            = useUserProfile();
  const { user }               = useAuth();

  const initial = (route.params?.tasks ?? []).map((t, i) => ({ ...t, _key: i, _removed: false }));
  const [items, setItems]   = useState(initial);
  const [loading, setLoading] = useState(false);


  const update = (key, field, value) =>
    setItems((prev) => prev.map((t) => t._key === key ? { ...t, [field]: value } : t));

  const toggle = (key) =>
    setItems((prev) => prev.map((t) => t._key === key ? { ...t, _removed: !t._removed } : t));

  const activeItems = items.filter((t) => !t._removed && t.title.trim());

  const handleImport = async () => {
    if (activeItems.length === 0) {
      Alert.alert("Nothing to import", "All tasks were removed."); return;
    }
    setLoading(true);
    try {
      const toImport = activeItems.map(({ title, dueDate, dueTime, priority, className, description, canvasId }) => ({
        title: title.trim(),
        description: description ?? null,
        dueDate:  dueDate  ?? null,
        dueTime:  dueTime  ?? null,
        priority: priority ?? "MEDIUM",
        className: className?.trim() || null,
        ...(canvasId ? { canvasId } : {}),
      }));

      const result = await createManyTasks(toImport);
      const created = result?.created ?? toImport.length;
      const skipped = result?.skipped ?? 0;

      // Silently add new classes to profile with "No grade yet"
      const existingNames = new Set((profile?.classes ?? []).map((c) => c.name));
      const newNames = [...new Set(toImport.map((t) => t.className).filter(Boolean))]
        .filter((n) => !existingNames.has(n));

      if (newNames.length > 0) {
        const newEntries = newNames.map((name, i) => ({
          id: `${Date.now()}${i}`,
          name,
          creditHours: "3",
          grade: "No grade yet",
        }));
        saveUserProfile(user.uid, { classes: [...(profile?.classes ?? []), ...newEntries] }).catch(() => {});
      }

      const msg = skipped > 0
        ? `${created} task${created !== 1 ? "s" : ""} added. ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped.`
        : `${created} task${created !== 1 ? "s" : ""} added to your list.`;

      navigation.popToTop();

      if (newNames.length > 0) {
        Alert.alert("Imported!", msg, [
          { text: "Add Grades", onPress: () => navigation.navigate("Profile") },
          { text: "Done", style: "cancel" },
        ]);
      } else {
        Alert.alert("Imported!", msg);
      }
    } catch (err) {
      Alert.alert("Import failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Review Tasks</Text>
          <Text style={styles.headerSubtitle}>{activeItems.length} of {items.length} selected</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Feather name="x" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBtn, (loading || activeItems.length === 0) && styles.importBtnDisabled]}
            onPress={handleImport}
            disabled={loading || activeItems.length === 0}
          >
            {loading
              ? <ActivityIndicator size={14} color="#fff" />
              : <Feather name="check" size={14} color="#fff" />
            }
            <Text style={styles.importBtnText}>Import {activeItems.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Edit titles, adjust priorities, and remove anything you don't need. Canvas course codes have been cleaned up automatically.
        </Text>

        {items.map((item) => {
          const meta = PRIORITY_META[item.priority] ?? PRIORITY_META.MEDIUM;
          return (
            <View key={item._key} style={[styles.card, item._removed && styles.cardRemoved]}>
              {/* Title row */}
              <View style={styles.cardTop}>
                <View style={[styles.priorityDot, { backgroundColor: meta.color }]} />
                <TextInput
                  style={styles.titleInput}
                  value={item.title}
                  onChangeText={(v) => update(item._key, "title", v)}
                  multiline
                  editable={!item._removed}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={() => toggle(item._key)} style={styles.removeBtn}>
                  <Feather
                    name={item._removed ? "plus-circle" : "x-circle"}
                    size={18}
                    color={item._removed ? colors.accent : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Meta: date + class name editable */}
              <View style={styles.cardMeta}>
                {item.dueDate && (
                  <View style={styles.metaChip}>
                    <Feather name="calendar" size={10} color={colors.textMuted} />
                    <Text style={styles.metaChipText}>{format(new Date(item.dueDate), "MMM d")}</Text>
                  </View>
                )}
                <TextInput
                  style={styles.classInput}
                  value={item.className ?? ""}
                  onChangeText={(v) => update(item._key, "className", v)}
                  placeholder="Class name"
                  placeholderTextColor={colors.textMuted}
                  editable={!item._removed}
                />
              </View>

              {/* Priority selector */}
              {!item._removed && (
                <View style={styles.priorityRow}>
                  {Object.entries(PRIORITY_META).map(([p, pm]) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityBtn,
                        item.priority === p && { backgroundColor: pm.color + "22", borderColor: pm.color },
                      ]}
                      onPress={() => update(item._key, "priority", p)}
                    >
                      <Text style={[styles.priorityBtnText, item.priority === p && { color: pm.color }]}>
                        {pm.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ICSReviewScreen;