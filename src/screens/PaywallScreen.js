// ============================================================
// src/screens/PaywallScreen.js
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { getOfferings, purchasePackage, restorePurchases } from "../services/purchases";

const FEATURES = [
  { icon: "cpu",            title: "Find My Focus",        desc: "One tap to know exactly what to work on right now, based on your deadlines and patterns." },
  { icon: "message-circle", title: "Unlimited AI Chat",    desc: "Your coach knows your tasks, classes, and grades — and never hits a daily limit." },
  { icon: "bell",           title: "Avoidance Alerts",     desc: "Get nudged when you've been putting off a task too long. No more last-minute panic." },
  { icon: "zap",            title: "Smart Prioritization", desc: "AI ranks every task by urgency, grade impact, and how you actually work." },
  { icon: "save",           title: "Chat History Forever", desc: "Conversations saved to your account — never lost, even if you reinstall." },
];

const PLANS = [
  { key: "monthly",  label: "Monthly",  price: "$4.99",  per: "/month",       savings: null,           badge: null },
  { key: "semester", label: "6 Months", price: "$17.99", per: "/ 6 months",   savings: "Save 40% — $3.00/mo", badge: "Most Popular" },
  { key: "annual",   label: "Annual",   price: "$29.99", per: "/year",        savings: "Save 50% — $2.50/mo", badge: "Best Value" },
];

// ── Plan card with press scale ────────────────────────────────
const PlanCard = ({ plan, active, onPress, styles, colors }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[styles.planCard, active && styles.planCardActive, { transform: [{ scale }] }]}>
        {/* Radio */}
        {active
          ? <View style={styles.planCheck}><Feather name="check" size={12} color="#fff" /></View>
          : <View style={styles.planCheckEmpty} />
        }
        {/* Label */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.planLabel, active && styles.planLabelActive]}>{plan.label}</Text>
            {plan.badge && (
              <View style={[styles.planBadge, active && styles.planBadgeActive]}>
                <Text style={styles.planBadgeText}>{plan.badge}</Text>
              </View>
            )}
          </View>
          {plan.savings
            ? <Text style={[styles.planSavings, active && styles.planSavingsActive]}>{plan.savings}</Text>
            : <Text style={styles.planSub}>Billed monthly</Text>
          }
        </View>
        {/* Price */}
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.planPrice, active && styles.planPriceActive]}>{plan.price}</Text>
          <Text style={styles.planPer}>{plan.per}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  closeBtn: { padding: 4, marginRight: spacing.sm },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 48 },

  // Hero
  heroSection:  { alignItems: "center", marginBottom: spacing.xl, paddingTop: spacing.sm },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    ...shadows.accent,
  },
  heroTitle:    { fontSize: 28, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, textAlign: "center", letterSpacing: -0.5, marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.accent,
  },
  heroBadgeText: { fontSize: 12, color: colors.accent, fontFamily: "Outfit-Bold" },

  // Features
  sectionLabel: { fontSize: 11, fontFamily: "Outfit-ExtraBold", color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm, paddingLeft: 2, textTransform: "uppercase" },
  featuresCard: {
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.isDark ? colors.border : "#EBEBF5",
    marginBottom: spacing.xl, overflow: "hidden",
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    ...(colors.isDark ? {} : { shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }),
  },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.md, paddingVertical: 14 },
  featureDivider: { height: 1, backgroundColor: colors.isDark ? colors.border : "#F0F0F5", marginLeft: 52 },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: colors.accentGlow, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent, flexShrink: 0,
  },
  featureTitle: { fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 2 },
  featureDesc:  { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // Plans
  plansRow: { gap: 10, marginBottom: spacing.lg },
  planCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.isDark ? colors.border : "#DDDDE8",
    paddingVertical: 18, paddingHorizontal: 16,
  },
  planCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.isDark ? colors.bgCard : colors.accentGlow,
    ...shadows.accent,
  },
  planBadge: {
    backgroundColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  planBadgeActive:   { backgroundColor: colors.accent },
  planBadgeText:     { fontSize: 9, color: "#fff", fontFamily: "Outfit-ExtraBold", letterSpacing: 0.5, textTransform: "uppercase" },
  planLabel:         { fontSize: 15, color: colors.textSecondary, fontFamily: "Outfit-Bold" },
  planLabelActive:   { color: colors.textPrimary },
  planSub:           { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  planPrice:         { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: colors.textMuted, letterSpacing: -0.5 },
  planPriceActive:   { color: colors.textPrimary },
  planPer:           { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  planSavings:       { fontSize: 12, color: colors.textMuted, fontFamily: "Outfit-SemiBold", marginTop: 2 },
  planSavingsActive: { color: colors.accent },
  planCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginRight: spacing.sm,
  },
  planCheckEmpty: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.border, marginRight: spacing.sm,
  },

  // CTA
  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 17, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm, ...shadows.accent,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText:     { color: "#fff", fontSize: 17, fontFamily: "Outfit-ExtraBold" },
  ctaBtnSub:      { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3, fontFamily: "Outfit-Medium" },

  restoreBtn:     { alignItems: "center", paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: colors.textMuted },
  legal:          { fontSize: 11, color: colors.textMuted, textAlign: "center", lineHeight: 16, marginTop: spacing.xs },
});

const PaywallScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [selectedPlan, setSelectedPlan] = useState("semester");
  const [loading, setLoading]           = useState(false);
  const [packages, setPackages]         = useState({});

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const ctaScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getOfferings().then(setPackages).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
    ]).start();
  }, []);

  const activePlan = PLANS.find((p) => p.key === selectedPlan);

  const handleUpgrade = async () => {
    const pkg = packages[selectedPlan];
    if (!pkg) {
      Alert.alert("Not available", "This plan isn't available right now. Please try again.");
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      Alert.alert("Welcome to Scholar!", "All AI features are now unlocked.", [
        { text: "Let's go!", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
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
          { text: "Let's go!", onPress: () => navigation.goBack() },
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
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrap}>
            <Feather name="zap" size={28} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Your AI Academic Coach</Text>
          <Text style={styles.heroSubtitle}>
            Scholar learns how you work and tells you exactly what to tackle — every day, all semester.
          </Text>
          <View style={styles.heroBadge}>
            <Feather name="check" size={12} color={colors.accent} />
            <Text style={styles.heroBadgeText}>Free forever · Scholar unlocks AI</Text>
          </View>
        </View>

        {/* Features */}
        <Text style={styles.sectionLabel}>What's included</Text>
        <View style={styles.featuresCard}>
          {FEATURES.map((f, i) => (
            <View key={f.title}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon} size={15} color={colors.accent} />
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
        <Text style={styles.sectionLabel}>Choose your plan</Text>
        <View style={styles.plansRow}>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              active={selectedPlan === plan.key}
              onPress={() => setSelectedPlan(plan.key)}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
          onPress={handleUpgrade}
          onPressIn={() => Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
          onPressOut={() => Animated.spring(ctaScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
          disabled={loading}
          activeOpacity={1}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>Get Scholar</Text>
              <Text style={styles.ctaBtnSub}>
                {activePlan?.price}{activePlan?.per} · Cancel anytime
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {selectedPlan === "annual"
            ? "Billed as $29.99/year."
            : selectedPlan === "semester"
            ? "Billed as $17.99 for 6 months."
            : "Billed monthly at $4.99."
          }{" "}
          By continuing you agree to our{" "}
          <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms</Text>
          {" "}and{" "}
          <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy Policy</Text>.
        </Text>

      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export default PaywallScreen;
