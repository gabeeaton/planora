// ============================================================
// components/StatsBar.js
// Displays 3 stat counters: Today / Pending / Completed
// ============================================================

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius } from "../utils/theme";

const Stat = ({ icon, value, label, color }) => (
  <View style={styles.stat}>
    <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
      <Feather name={icon} size={16} color={color} />
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
  </View>
);

const StatsBar = ({ todayCount, pendingCount, completedCount }) => {
  return (
    <View style={styles.container}>
      <Stat icon="sun" value={todayCount} label="Today" color={colors.medium} />
      <View style={styles.divider} />
      <Stat icon="clock" value={pendingCount} label="Pending" color={colors.accent} />
      <View style={styles.divider} />
      <Stat icon="check-circle" value={completedCount} label="Done" color={colors.low} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
});

export default StatsBar;
