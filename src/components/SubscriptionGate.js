// ============================================================
// src/components/SubscriptionGate.js
// Subtle dashed hint row — not a big locked billboard.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSubscription } from "../hooks/useSubscription";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const makeStyles = (colors) => StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    paddingVertical: 11, paddingHorizontal: 14, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  icon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit-Medium" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent },
  badgeText: { fontSize: 10, color: colors.accent, fontFamily: "Outfit-Bold", letterSpacing: 0.3, textTransform: "uppercase" },
});

const SubscriptionGate = ({ children, featureName = "This feature", onUpgrade }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { hasProAccess } = useSubscription();
  if (hasProAccess) return <>{children}</>;
  return (
    <TouchableOpacity style={styles.row} onPress={onUpgrade} activeOpacity={0.7}>
      <View style={styles.icon}><Feather name="zap" size={14} color={colors.accent} /></View>
      <Text style={styles.label} numberOfLines={1}>{featureName}</Text>
      <View style={styles.badge}><Feather name="lock" size={9} color={colors.accent} /><Text style={styles.badgeText}>Pro</Text></View>
    </TouchableOpacity>
  );
};

export default SubscriptionGate;