// ============================================================
// src/screens/PaywallScreen.js
// Upgrade to Pro screen. Clean, minimal, high-converting.
// Wire RevenueCat here later. For now sets isPro flag manually.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, shadows, typography } from "../utils/theme";
import { setProStatus } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";

const PRO_FEATURES = [
  {
    icon: "cpu",
    title: "What should I do right now?",
    description: "One-tap AI recommendation based on your deadlines, habits, and class weights.",
  },
  {
    icon: "calendar",
    title: "Weekly AI Study Plan",
    description: "A personalized day-by-day plan that accounts for how you actually work.",
  },
  {
    icon: "trending-up",
    title: "Behavioral Insights",
    description: "The app learns your patterns — which classes you avoid, when you're most productive.",
  },
  {
    icon: "bell",
    title: "Smart Avoidance Alerts",
    description: "Get nudged when the AI detects you've been avoiding a task too long.",
  },
];

const PaywallScreen = ({ navigation }) => {
  const { user }      = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with RevenueCat purchase flow
      // For beta/development: manually sets isPro = true
      await setProStatus(user.uid, true);
      navigation.goBack();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Feather name="zap" size={32} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>TaskFlow Pro</Text>
          <Text style={styles.heroSubtitle}>
            The AI coach that knows your semester, your habits, and what you've been avoiding.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {PRO_FEATURES.map((f, i) => (
            <View key={i} style={[styles.featureRow, i < PRO_FEATURES.length - 1 && styles.featureRowBorder]}>
              <View style={styles.featureIconWrap}>
                <Feather name={f.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingBlock}>
          <Text style={styles.price}>$4.99<Text style={styles.pricePer}>/month</Text></Text>
          <Text style={styles.pricingNote}>Start with 14 days free. Cancel anytime.</Text>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.high} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
          onPress={handleUpgrade}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Start Free Trial</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          No charge for 14 days. $4.99/month after trial ends.{"\n"}
          Cancel any time from your device settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { paddingHorizontal: spacing.lg, paddingBottom: 48 },
  closeBtn: {
    alignSelf: "flex-end", marginTop: spacing.md,
    padding: 8, marginRight: -8,
  },
  hero: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xl },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    ...shadows.accent,
  },
  heroTitle: {
    fontSize: 30, fontWeight: "900", color: colors.textPrimary,
    letterSpacing: -1, marginBottom: 8,
  },
  heroSubtitle: {
    ...typography.body, textAlign: "center",
    paddingHorizontal: spacing.md, lineHeight: 22,
  },
  featuresCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg,
    overflow: "hidden",
  },
  featureRow:       { flexDirection: "row", padding: spacing.md, alignItems: "flex-start" },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  featureIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center",
    marginRight: spacing.sm, flexShrink: 0,
  },
  featureText:  { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 3 },
  featureDesc:  { ...typography.bodySmall, lineHeight: 18 },

  pricingBlock: { alignItems: "center", marginBottom: spacing.lg },
  price: {
    fontSize: 42, fontWeight: "900", color: colors.textPrimary, letterSpacing: -1,
  },
  pricePer:     { fontSize: 20, fontWeight: "500", color: colors.textSecondary },
  pricingNote:  { ...typography.body, marginTop: 4 },

  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,92,92,0.1)", padding: spacing.sm,
    borderRadius: radius.sm, marginBottom: spacing.md,
  },
  errorText: { color: colors.high, fontSize: 13, flex: 1 },

  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginBottom: spacing.md, ...shadows.accent,
  },
  ctaBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  legalNote: {
    ...typography.bodySmall, textAlign: "center", lineHeight: 18, color: colors.textMuted,
  },
});

export default PaywallScreen;
