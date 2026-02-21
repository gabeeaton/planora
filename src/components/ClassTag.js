import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const CLASS_COLORS = [
  "#6C63FF", "#FF6B6B", "#FFB347", "#5CFF8F",
  "#5BC8FF", "#FF8EE8", "#FFE45C", "#A8FF78",
];

const getClassColor = (className) => {
  if (!className || typeof className !== "string") return "#44445A";
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
};

const makeStyles = () => StyleSheet.create({
  tag:    { borderWidth: 1, borderRadius: radius.full, alignSelf: "flex-start" },
  tagSm:  { paddingHorizontal: 6, paddingVertical: 2 },
  tagMd:  { paddingHorizontal: 10, paddingVertical: 4 },
  text:   { fontWeight: "600" },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
});

const styles = makeStyles();

const ClassTag = ({ className, size = "sm" }) => {
  // Guard: if className is an object or not a string, extract .name or bail
  const safeClassName = typeof className === "string"
    ? className
    : (className?.name ?? null);

  if (!safeClassName) return null;

  const color = getClassColor(safeClassName);
  const small = size === "sm";
  return (
    <View style={[styles.tag, { borderColor: color, backgroundColor: color + "18" }, small ? styles.tagSm : styles.tagMd]}>
      <Text style={[styles.text, { color }, small ? styles.textSm : styles.textMd]}>
        {safeClassName}
      </Text>
    </View>
  );
};

export default ClassTag;