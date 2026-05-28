import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/ThemeContext";
import { generateUpcomingTerms } from "../utils/termHelpers";
import { saveUserProfile, clearIncompleteTasksForSemester } from "../services/firebase";

export default function NewSemesterPrompt({ visible, oldSemester, userId, schoolSystem, onDone }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);

  const sheetY       = useRef(new Animated.Value(520)).current;
  const backdropFade = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTransY  = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      sheetY.setValue(520);
      backdropFade.setValue(0);
      Animated.parallel([
        Animated.timing(backdropFade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (selected) {
      Animated.parallel([
        Animated.spring(actionsOpacity, { toValue: 1, speed: 28, bounciness: 0, useNativeDriver: true }),
        Animated.spring(actionsTransY,  { toValue: 0, speed: 28, bounciness: 6, useNativeDriver: true }),
      ]).start();
    } else {
      actionsOpacity.setValue(0);
      actionsTransY.setValue(10);
    }
  }, [selected]);

  // Only show current + upcoming terms — no going back to old semesters
  const terms = generateUpcomingTerms(schoolSystem ?? "semester").filter((t) => t !== oldSemester);

  const sheetBg   = colors.isDark ? "#1E1E2A" : "#FFFFFF";
  const textMain  = colors.isDark ? "#F0F0F8" : "#18181B";
  const textSub   = colors.isDark ? "rgba(200,200,220,0.65)" : "rgba(60,60,80,0.55)";
  const rowBorder = colors.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const rowUnselBg = colors.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  const doSwitch = async (clearTasks) => {
    setLoading(true);
    try {
      await saveUserProfile(userId, { semester: selected });
      if (clearTasks) {
        const { invalidateTodayFocusCache } = await import("../services/openai");
        const { cancelStudyPlanReminders }  = await import("../services/notifications");
        await Promise.all([
          clearIncompleteTasksForSemester(userId),
          AsyncStorage.removeItem("@planora_study_plan_cache"),
          cancelStudyPlanReminders(userId),
          invalidateTodayFocusCache(),
        ]).catch(() => {});
      }
      await AsyncStorage.setItem(`@planora_semester_prompted_${oldSemester}`, "1");
    } catch (_) {}
    setLoading(false);
    onDone();
  };

  const handleSwitch = () => doSwitch(false);

  const handleSwitchAndClear = () => {
    // Double-confirm before destroying tasks
    Alert.alert(
      "Clear all pending tasks?",
      `This will permanently delete all incomplete tasks from ${oldSemester}. Completed tasks and stats are kept.\n\nThis can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, clear them",
          style: "destructive",
          onPress: () => doSwitch(true),
        },
      ]
    );
  };

  const handleLater = async () => {
    const snoozeUntil = Date.now() + 7 * 86400000; // 7 days
    await AsyncStorage.setItem(`@planora_semester_snooze_${oldSemester}`, String(snoozeUntil)).catch(() => {});
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleLater}>
      <Animated.View style={[styles.backdrop, { opacity: backdropFade }]}>
        <Animated.View style={[styles.sheet, { backgroundColor: sheetBg, paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: sheetY }] }]}>
          <View style={[styles.handle, { backgroundColor: colors.isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }]} />

          <Text style={styles.emoji}>🎓</Text>
          <Text style={[styles.title, { color: textMain }]}>Semester's over!</Text>
          <Text style={[styles.sub, { color: textSub }]}>
            {oldSemester} has ended. Pick your next term to keep things fresh.
          </Text>

          <ScrollView style={styles.termList} showsVerticalScrollIndicator={false}>
            {terms.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.termRow,
                  { borderColor: rowBorder, backgroundColor: rowUnselBg },
                  selected === t && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setSelected(t);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.termLabel, { color: selected === t ? "#fff" : textMain }]}>{t}</Text>
                {selected === t && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Animated.View
            pointerEvents={selected ? "auto" : "none"}
            style={[styles.actions, { opacity: actionsOpacity, transform: [{ translateY: actionsTransY }] }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.accent }]}
                  onPress={handleSwitch}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnLabel}>Switch to {selected || ""}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnOutline, { borderColor: rowBorder }]}
                  onPress={handleSwitchAndClear}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnOutlineLabel, { color: textSub }]}>Switch & Clear Old Tasks</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          <TouchableOpacity onPress={handleLater} style={styles.laterBtn} activeOpacity={0.6}>
            <Text style={[styles.laterLabel, { color: textSub }]}>Remind me later</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:        { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet:           { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24 },
  handle:          { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  emoji:           { fontSize: 36, textAlign: "center", marginBottom: 8 },
  title:           { fontSize: 22, fontFamily: "Outfit-Bold", textAlign: "center", marginBottom: 6 },
  sub:             { fontSize: 14, fontFamily: "Outfit-Regular", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  termList:        { maxHeight: 220 },
  termRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 8 },
  termLabel:       { fontSize: 15, fontFamily: "Outfit-SemiBold" },
  check:           { fontSize: 14, color: "#fff" },
  actions:         { marginTop: 12, gap: 10 },
  btn:             { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnLabel:        { fontSize: 15, fontFamily: "Outfit-Bold", color: "#fff" },
  btnOutline:      { borderRadius: 14, borderWidth: 1.5, paddingVertical: 13, alignItems: "center" },
  btnOutlineLabel: { fontSize: 14, fontFamily: "Outfit-Medium" },
  laterBtn:        { alignItems: "center", paddingVertical: 16 },
  laterLabel:      { fontSize: 13, fontFamily: "Outfit-Regular" },
});
