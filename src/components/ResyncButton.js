// ============================================================
// src/components/ResyncButton.js
// Compact button that lives on the dashboard beneath the StatsBar.
// Only shows after the user has tasks (i.e. already imported once).
// Tapping it opens SyllabusParserScreen same as the Import button
// in the header — this is just more visible and contextual.
// ============================================================

import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const makeStyles = (colors) => StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderStyle: "dashed", borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.md,
    marginBottom: spacing.md, justifyContent: "center",
  },
  text:    { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  subtext: { fontSize: 11, color: colors.textMuted },
});

const ResyncButton = ({ onPress, lastImportCount }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.7}>
      <Feather name="refresh-cw" size={14} color={colors.textMuted} />
      <Text style={styles.text}>Re-import / Sync Semester</Text>
      {lastImportCount > 0 && (
        <Text style={styles.subtext}>({lastImportCount} tasks last time)</Text>
      )}
    </TouchableOpacity>
  );
};

export default ResyncButton;