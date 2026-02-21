// ============================================================
// src/components/SubscriptionGate.js
// Freemium model — shows locked state with upgrade CTA for non-Pro users.
// No trial logic — free forever, Pro unlocks AI features.
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSubscription } from "../hooks/useSubscription";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const makeStyles = (colors) => StyleSheet.create({
  lockedCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: "center",
    borderWidth: 1, borderColor: colors.accentGlow,
    marginBottom: spacing.md, ...shadows.accent,
  },
  lockIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accent,
  },
  lockedTitle:    { fontSize: 17, fontWeight: "700", color: colors.textPrimary, marginBottom: 6, textAlign: "center" },
  lockedSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  upgradeBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: 8, ...shadows.accent,
  },
  upgradeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  price:          { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
});

const SubscriptionGate = ({ children, featureName = "This feature", onUpgrade }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { hasProAccess } = useSubscription();

  if (hasProAccess) return <>{children}</>;

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockIconWrap}>
        <Feather name="lock" size={22} color={colors.accent} />
      </View>
      <Text style={styles.lockedTitle}>{featureName}</Text>
      <Text style={styles.lockedSubtitle}>
        Upgrade to Pro to unlock AI coaching, weekly plans, and behavioral insights.
      </Text>
      <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
        <Feather name="zap" size={15} color="#fff" />
        <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
      </TouchableOpacity>
      <Text style={styles.price}>$4.99/month or $29.99/year</Text>
    </View>
  );
};

export default SubscriptionGate;