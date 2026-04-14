import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { radius, getClassColor } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

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

  const { colors } = useTheme();
  const color = getClassColor(safeClassName, colors.isDark);
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