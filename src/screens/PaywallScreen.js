// ============================================================
// src/screens/PaywallScreen.js
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { getOfferings, purchasePackage, restorePurchases, PRODUCT_IDS } from "../services/purchases";

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

  plansRow:     { flexDirection: "column", gap: 10, marginBottom: spacing.md },
  planCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.border,
    paddingVertical: 20, paddingHorizontal: 18,
  },
  planCardActive: { borderColor: colors.accent, ...shadows.accent },
  planBadge: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: spacing.sm,
  },
  planBadgeText:   { fontSize: 9, color: "#fff", fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  planLabel:       { fontSize: 16, color: colors.textPrimary, fontWeight: "700" },
  planSub:         { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  planPrice:       { fontSize: 20, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  planPer:         { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  planSavings:     { fontSize: 12, color: colors.accent, fontWeight: "700", marginTop: 3 },
  planCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    marginRight: spacing.sm,
  },
  planCheckEmpty: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.border,
    marginRight: spacing.sm,
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
  const [selectedPlan, setSelectedPlan] = useState("semester");
  const [loading, setLoading]           = useState(false);
  const [packages, setPackages]         = useState({});

  useEffect(() => {
    getOfferings().then((pkgs) => {
      const map = {};
      pkgs.forEach((pkg) => {
        if (pkg.product.identifier === PRODUCT_IDS.monthly)  map.monthly  = pkg;
        if (pkg.product.identifier === PRODUCT_IDS.semester) map.semester = pkg;
        if (pkg.product.identifier === PRODUCT_IDS.annual)   map.annual   = pkg;
      });
      setPackages(map);
    }).catch(() => {});
  }, []);

  const handleUpgrade = async () => {
    const pkg = packages[selectedPlan];
    if (!pkg) {
      Alert.alert("Not available", "This plan isn't available right now. Please try again.");
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      Alert.alert(
        "Welcome to Scholar! 🎉",
        "All AI features are now unlocked.",
        [{ text: "Let's go!", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      // User cancelled — don't show error
      if (!err.userCancelled) {
        Alert.alert("Purchase failed", err.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert("Restored!", "Your Scholar subscription has been restored.", [
          { text: "Let's go!", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Nothing to restore", "No active subscription found.\n\nContact hello@planora.app if you need help.");
      }
    } catch {
      Alert.alert("Error", "Could not restore purchases. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade to Scholar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrap}>
            <Feather name="zap" size={32} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Your AI Academic Coach</Text>
          <Text style={styles.heroSubtitle}>
            Planora is free to use forever. Scholar unlocks AI features that learn how you work and tell you exactly what to do.
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
          {[
            { key: "monthly",  label: "Monthly",   sub: "per month",    price: "$4.99",  savings: null,                badge: null },
            { key: "semester", label: "6 Months",  sub: "6 months",     price: "$17.99", savings: "Save 40% · $3.00/mo", badge: "Most Popular" },
            { key: "annual",   label: "Annual",    sub: "per year",     price: "$29.99", savings: "Save 50% · $2.50/mo", badge: "Best Value" },
          ].map((plan) => {
            const active = selectedPlan === plan.key;
            return (
              <TouchableOpacity
                key={plan.key}
                style={[styles.planCard, active && styles.planCardActive]}
                onPress={() => setSelectedPlan(plan.key)}
                activeOpacity={0.8}
              >
                {/* Radio */}
                {active
                  ? <View style={styles.planCheck}><Feather name="check" size={12} color="#fff" /></View>
                  : <View style={styles.planCheckEmpty} />
                }
                {/* Label + savings */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    {plan.badge && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                  </View>
                  {plan.savings
                    ? <Text style={styles.planSavings}>{plan.savings}</Text>
                    : <Text style={styles.planSub}>{plan.sub}</Text>
                  }
                </View>
                {/* Price */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPer}>{plan.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
                {selectedPlan === "annual" ? "Get Scholar — $29.99/year" : selectedPlan === "semester" ? "Get Scholar — $17.99 / 6 months" : "Get Scholar — $4.99/month"}
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
            : selectedPlan === "semester"
            ? "Billed as $17.99 for 6 months. Cancel anytime."
            : "Billed monthly at $4.99. Cancel anytime."
          }{" "}
          By continuing you agree to our{" "}
          <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms of Service</Text>
          {" "}and{" "}
          <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy Policy</Text>.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
};

export default PaywallScreen;