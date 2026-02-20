// ============================================================
// src/components/ClassTag.js
// Small pill showing which class a task belongs to.
// ============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../utils/theme";

// Deterministic color per class name so the same class always gets the same color
const CLASS_COLORS = [
  "#6C63FF", "#FF6B6B", "#FFB347", "#5CFF8F",
  "#5BC8FF", "#FF8EE8", "#FFE45C", "#A8FF78",
];

const getClassColor = (className) => {
  if (!className) return colors.textMuted;
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
};

const ClassTag = ({ className, size = "sm" }) => {
  if (!className) return null;
  const color = getClassColor(className);
  const small = size === "sm";

  return (
    <View style={[
      styles.tag,
      { borderColor: color, backgroundColor: color + "18" },
      small ? styles.tagSm : styles.tagMd,
    ]}>
      <Text style={[styles.text, { color }, small ? styles.textSm : styles.textMd]}>
        {className}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  tagSm: { paddingHorizontal: 6, paddingVertical: 2 },
  tagMd: { paddingHorizontal: 10, paddingVertical: 4 },
  text:   { fontWeight: "600" },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
});

export default ClassTag;