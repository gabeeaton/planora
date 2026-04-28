import React, { useRef, useEffect } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/ThemeContext";

const ROW1 = ["A", "A-", "B+", "B", "B-"];
const ROW2 = ["C+", "C", "C-", "D", "F"];

const gradeColor = (g, colors) => {
  if (g.startsWith("A")) return { bg: colors.low + "18", border: colors.low, text: colors.low };
  if (g === "B+" || g === "B") return { bg: colors.accent + "15", border: colors.accent, text: colors.accent };
  if (g === "B-" || g === "C+") return { bg: colors.medium + "15", border: colors.medium, text: colors.medium };
  return { bg: colors.high + "12", border: colors.high, text: colors.high };
};

export default function GradePromptSheet({ task, onSelect, onSkip }) {
  const { colors } = useTheme();
  const slideAnim  = useRef(new Animated.Value(320)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (task) {
      slideAnim.setValue(320);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 3, useNativeDriver: true }),
      ]).start();
    }
  }, [task?.id]);

  const dismiss = (grade = null) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 320, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      if (grade) onSelect(grade);
      else onSkip();
    });
  };

  if (!task) return null;

  return (
    <Modal visible={!!task} transparent animationType="none" onRequestClose={() => dismiss()}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => dismiss()} />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF", transform: [{ translateY: slideAnim }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.textPrimary }]}>Did you get a grade?</Text>
          <Text style={[styles.taskName, { color: colors.textMuted }]} numberOfLines={2}>
            {task.title}
          </Text>

          <View style={styles.grid}>
            {[ROW1, ROW2].map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((g) => {
                  const gc = gradeColor(g, colors);
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, { backgroundColor: gc.bg, borderColor: gc.border }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        dismiss(g);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.chipText, { color: gc.text }]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.skipBtn, { backgroundColor: colors.isDark ? colors.bg : "#F4F4F9" }]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); dismiss(); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>No grade · Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 44, paddingTop: 12,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 22 },
  title:    { fontSize: 21, fontFamily: "Outfit-ExtraBold", textAlign: "center", marginBottom: 6 },
  taskName: { fontSize: 13, fontFamily: "Outfit-Regular", textAlign: "center", marginBottom: 28, paddingHorizontal: 8, lineHeight: 19 },
  grid:     { width: "100%", gap: 10, marginBottom: 20 },
  row:      { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1, paddingVertical: 15, borderRadius: 13,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  chipText: { fontSize: 15, fontFamily: "Outfit-ExtraBold" },
  skipBtn: {
    width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center",
  },
  skipText: { fontSize: 14, fontFamily: "Outfit-SemiBold" },
});
