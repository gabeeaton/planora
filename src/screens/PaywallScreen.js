// ============================================================
// src/screens/PaywallScreen.js
// Freemium model — monthly + annual options.
// Wire RevenueCat here for real payments.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { setProStatus } from "../services/firebase";

const FEATURES = [
  { icon: "cpu",           title: "Find My Focus",                 desc: "One-tap AI recommendation based on your patterns and deadlines." },
  { icon: "calendar",      title: "AI Weekly Study Plan",          desc: "7-day plan that adapts to your habits and upcoming due dates." },
  { icon: "trending-up",   title: "Behavioral Insights",          desc: "AI learns how you work and coaches you to improve over time." },
  { icon: "zap",           title: "Smart Priority Suggestions",   desc: "AI ranks tasks by urgency, grade impact, and your history." },
  { icon: "alert-triangle",title: "Avoidance Alerts",             desc: "Get nudged when you've been dodging a task too long." },
  { icon: "file-text",     title: "Unlimited Syllabus Imports",   desc: "Set up any class in seconds with AI syllabus parsing." },
];

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn:    { padding: 4, marginRight: spacing.sm },
  headerTitle: { ...typography.h2, color: colors.textPrimary },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 48 },

  heroSection: { alignItems: "center", marginBottom: spacing.xl },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    ...shadows.accent,
  },
  heroTitle:    { fontSize: 26, fontWeight: "800", color: colors.textPrimary, textAlign: "center", letterSpacing: -0.5, marginBottom: 8 },
  heroSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },

  featuresCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg, overflow: "hidden",
  },
  featureRow:     { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingHorizontal: spacing.md, paddingVertical: 14 },
  featureDivider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  featureIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent, flexShrink: 0,
  },
  featureTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  featureDesc:  { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  plansRow:     { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  planCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    padding: spacing.md, alignItems: "center",
  },
  planCardActive: { borderColor: colors.accent, ...shadows.accent },
  planBadge: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm,
  },
  planBadgeText:   { fontSize: 9, color: "#fff", fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  planLabel:       { fontSize: 12, color: colors.textMuted, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  planPrice:       { fontSize: 28, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  planPer:         { fontSize: 12, color: colors.textSecondary },
  planSavings:     { fontSize: 11, color: colors.accent, fontWeight: "700", marginTop: 4 },
  planCheck: {
    position: "absolute", top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
  },

  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10, marginBottom: spacing.sm,
    ...shadows.accent,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText:     { color: "#fff", fontSize: 17, fontWeight: "800" },

  restoreBtn:     { alignItems: "center", paddingVertical: 8 },
  restoreBtnText: { fontSize: 13, color: colors.textMuted },
  legal:          { fontSize: 11, color: colors.textMuted, textAlign: "center", lineHeight: 16, marginTop: spacing.sm },
});

const PaywallScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // TODO: Replace with RevenueCat
      // const pkg = selectedPlan === "annual" ? offerings.annual : offerings.monthly;
      // await Purchases.purchasePackage(pkg);
      await setProStatus(user.uid, true);
      // Also save planType so we know which they picked
      const { saveUserProfile } = require("../services/firebase");
      await saveUserProfile(user.uid, { planType: selectedPlan });
      Alert.alert(
        "Welcome to Pro! 🎉",
        "All AI features are now unlocked.",
        [{ text: "Let's go!", onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    Alert.alert("Restore Purchases", "No previous purchases found.\n\nContact support if you believe this is an error.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade to Pro</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrap}>
            <Feather name="zap" size={32} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Your AI Academic Coach</Text>
          <Text style={styles.heroSubtitle}>
            Planora is free to use forever. Pro unlocks AI features that learn how you work and tell you exactly what to do.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={f.title}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon} size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
              {i < FEATURES.length - 1 && <View style={styles.featureDivider} />}
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={styles.plansRow}>
          {/* Monthly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === "monthly" && styles.planCardActive]}
            onPress={() => setSelectedPlan("monthly")}
            activeOpacity={0.8}
          >
            {selectedPlan === "monthly" && (
              <View style={styles.planCheck}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            )}
            <Text style={styles.planLabel}>Monthly</Text>
            <Text style={styles.planPrice}>$4.99</Text>
            <Text style={styles.planPer}>per month</Text>
          </TouchableOpacity>

          {/* Annual */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === "annual" && styles.planCardActive]}
            onPress={() => setSelectedPlan("annual")}
            activeOpacity={0.8}
          >
            {selectedPlan === "annual" && (
              <View style={styles.planCheck}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            )}
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>Best Value</Text>
            </View>
            <Text style={styles.planLabel}>Annual</Text>
            <Text style={styles.planPrice}>$29.99</Text>
            <Text style={styles.planPer}>per year</Text>
            <Text style={styles.planSavings}>Save 50% · $2.50/mo</Text>
          </TouchableOpacity>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
          onPress={handleUpgrade}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>
                {selectedPlan === "annual" ? "Get Pro — $29.99/year" : "Get Pro — $4.99/month"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {selectedPlan === "annual"
            ? "Billed as $29.99/year. Cancel anytime."
            : "Billed monthly at $4.99. Cancel anytime."
          }{" "}
          By continuing you agree to our Terms of Service.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

export default PaywallScreen;