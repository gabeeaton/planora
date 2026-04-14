import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const StatsBar = ({ todayCount, pendingCount, completedCount }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, {
      backgroundColor: colors.bgCard,
      borderColor: colors.isDark ? colors.border : "transparent",
    }]}>
      {/* Today */}
      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.medium + "18" }]}>
          <Feather name="sun" size={16} color={colors.medium} />
        </View>
        <Text style={[styles.value, { color: todayCount > 0 ? colors.medium : colors.textPrimary }]}>{todayCount}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Today</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Pending */}
      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + "18" }]}>
          <Feather name="clock" size={16} color={colors.accent} />
        </View>
        <Text style={[styles.value, { color: pendingCount > 0 ? colors.accent : colors.textPrimary }]}>{pendingCount}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Pending</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Done */}
      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.low + "18" }]}>
          <Feather name="check-circle" size={16} color={colors.low} />
        </View>
        <Text style={[styles.value, { color: completedCount > 0 ? colors.low : colors.textPrimary }]}>{completedCount}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Done</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-around",
  },
  stat:     { alignItems: "center", flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  value:    { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  label:    { fontSize: 11, fontWeight: "500", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  divider:  { width: 1, height: 40 },
});

export default StatsBar;