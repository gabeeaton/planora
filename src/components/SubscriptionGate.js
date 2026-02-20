// ============================================================
// src/components/SubscriptionGate.js
// ============================================================

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSubscription } from "../hooks/useSubscription";
import { colors, spacing, radius, shadows } from "../utils/theme";

const SubscriptionGate = ({ children, featureName = "This feature", onUpgrade }) => {
  const { hasProAccess, trialDaysRemaining, isInTrial, isPro } = useSubscription();

  if (hasProAccess) {
    // Only show trial warning if NOT a paid Pro user and trial is about to expire
    const showTrialWarning = !isPro && isInTrial && trialDaysRemaining !== null && trialDaysRemaining <= 3;
    return (
      <>
        {showTrialWarning && (
          <View style={styles.trialBanner}>
            <Feather name="clock" size={12} color={colors.medium} />
            <Text style={styles.trialBannerText}>
              Trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""}
            </Text>
            <TouchableOpacity onPress={onUpgrade}>
              <Text style={styles.trialUpgradeLink}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}
        {children}
      </>
    );
  }

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockIconWrap}>
        <Feather name="lock" size={22} color={colors.accent} />
      </View>
      <Text style={styles.lockedTitle}>{featureName}</Text>
      <Text style={styles.lockedSubtitle}>
        Unlock personalized AI coaching, weekly plans, and behavioral insights with Pro.
      </Text>
      <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
        <Feather name="zap" size={15} color="#fff" />
        <Text style={styles.upgradeBtnText}>Try Pro Free — 14 Days</Text>
      </TouchableOpacity>
      <Text style={styles.price}>Then $4.99/month. Cancel anytime.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  lockedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accentGlow,
    marginBottom: spacing.md,
    ...shadows.accent,
  },
  lockIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.accent,
  },
  lockedTitle: {
    fontSize: 17, fontWeight: "700", color: colors.textPrimary,
    marginBottom: 6, textAlign: "center",
  },
  lockedSubtitle: {
    fontSize: 13, color: colors.textSecondary, textAlign: "center",
    lineHeight: 19, marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
  upgradeBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: 8, ...shadows.accent,
  },
  upgradeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  price:          { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  trialBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.mediumGlow, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    marginBottom: spacing.sm, gap: 6,
    borderWidth: 1, borderColor: colors.medium,
  },
  trialBannerText:  { fontSize: 12, color: colors.medium, flex: 1, fontWeight: "500" },
  trialUpgradeLink: { fontSize: 12, color: colors.medium, fontWeight: "700" },
});

export default SubscriptionGate;