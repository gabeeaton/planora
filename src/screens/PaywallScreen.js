import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { getOfferings, purchasePackage, restorePurchases } from "../services/purchases";
import { invalidateTodayFocusCache } from "../services/openai";
import * as Haptics from "expo-haptics";

const FEATURES = [
  { icon: "edit-3",         title: "AI Study Planner",       desc: "Builds your week around your deadlines and free time — day by day." },
  { icon: "cpu",            title: "Where Should I Start?",  desc: "One tap to know exactly what to tackle right now." },
  { icon: "message-circle", title: "Unlimited AI Coach",     desc: "Knows your tasks, classes, and grades. No daily limits." },
  { icon: "bell",           title: "Avoidance Alerts",       desc: "Get nudged before a task slips into last-minute panic." },
];

const PLANS = [
  { key: "monthly",  label: "Monthly",  displayPrice: "$4.99", per: "/mo", badge: null,       billed: "Billed monthly" },
  { key: "semester", label: "6 Months", displayPrice: "$3.00", per: "/mo", badge: "Save 40%", billed: "Billed as $17.99 for 6 months" },
  { key: "annual",   label: "Annual",   displayPrice: "$2.50", per: "/mo", badge: "Save 50%", billed: "Billed as $29.99/yr" },
];

const makeStyles = (colors, insets) => StyleSheet.create({
  root: {
    maxHeight: "92%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.isDark ? colors.border : "#D1D1D8",
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  closeRow: {
    flexDirection: "row", justifyContent: "flex-end",
    paddingHorizontal: spacing.lg, paddingTop: 6,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.isDark ? colors.bgCard : "#F2F2F7",
    alignItems: "center", justifyContent: "center",
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: Math.max(insets.bottom, 24) + 16,
  },

  // ── Hero ──────────────────────────────────────────────────────
  hero: { alignItems: "center", paddingTop: 8, paddingBottom: 28 },
  trialBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent,
    paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 20,
  },
  trialBadgeText: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.accent },
  heroTitle: {
    fontSize: 38, fontFamily: "Outfit-ExtraBold",
    color: colors.textPrimary, textAlign: "center",
    letterSpacing: -1, lineHeight: 44, marginBottom: 10,
  },
  heroAccent: { color: colors.accent },
  heroSub: {
    fontSize: 15, color: colors.textSecondary,
    textAlign: "center", lineHeight: 22,
  },

  // ── Features ─────────────────────────────────────────────────
  featuresWrap: { marginBottom: 24, gap: 2 },
  featureRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
  },
  featureRowLast: { borderBottomWidth: 0 },
  featureCheck: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accentGlow,
    borderWidth: 1.5, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  featureTitle: { fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 2 },
  featureDesc:  { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // ── Plan toggle ───────────────────────────────────────────────
  planToggleWrap: { marginBottom: 8 },
  planToggle: {
    flexDirection: "row",
    backgroundColor: colors.isDark ? colors.bgCard : "#F2F2F7",
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 14,
  },
  planSegment: {
    flex: 1, borderRadius: radius.md - 2,
    paddingVertical: 12, alignItems: "center", gap: 2,
  },
  planSegmentActive: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  planSegmentLabel: {
    fontSize: 14, fontFamily: "Outfit-Bold",
    color: colors.textMuted,
  },
  planSegmentLabelActive: { color: "#fff" },
  planSegmentBadge: {
    fontSize: 10, fontFamily: "Outfit-ExtraBold",
    color: colors.accent, letterSpacing: 0.3,
  },
  planSegmentBadgeActive: { color: "rgba(255,255,255,0.85)" },

  planPriceRow: {
    flexDirection: "row", alignItems: "baseline",
    justifyContent: "center", gap: 2, marginBottom: 4,
  },
  planPrice:  { fontSize: 32, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, letterSpacing: -1 },
  planPer:    { fontSize: 14, color: colors.textMuted, fontFamily: "Outfit-Medium" },
  planBilled: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginBottom: 20 },

  // ── CTA ──────────────────────────────────────────────────────
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
    ...shadows.accent,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText:     { fontSize: 17, fontFamily: "Outfit-ExtraBold", color: "#fff", letterSpacing: 0.1 },
  ctaBtnSub:      { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3, fontFamily: "Outfit-Medium" },

  restoreBtn:     { alignItems: "center", paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: colors.textMuted },

  legal: {
    fontSize: 10, color: colors.textMuted,
    textAlign: "center", lineHeight: 15,
    marginTop: 6, paddingHorizontal: 8,
  },
  legalLink: { textDecorationLine: "underline" },
});

export default function PaywallScreen({ navigation }) {
  const { colors }    = useTheme();
  const insets        = useSafeAreaInsets();
  const styles        = makeStyles(colors, insets);
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [loading, setLoading]           = useState(false);
  const [packages, setPackages]         = useState({});

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const ctaScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getOfferings().then(setPackages).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
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
      invalidateTodayFocusCache();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("You're in!", "Scholar is now unlocked. Build your first plan.", [
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
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
    <View style={styles.root}>
      <View style={styles.handle} />
      <View style={styles.closeRow}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.trialBadge}>
            <Feather name="gift" size={13} color={colors.accent} />
            <Text style={styles.trialBadgeText}>7-Day Free Trial</Text>
          </View>
          <Text style={styles.heroTitle}>
            {"Study smarter.\nStay ahead."}
          </Text>
          <Text style={styles.heroSub}>
            No credit card required to start.{"\n"}Cancel anytime.
          </Text>
        </View>

        {/* ── Features ── */}
        <View style={styles.featuresWrap}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.featureRow, i === FEATURES.length - 1 && styles.featureRowLast]}>
              <View style={styles.featureCheck}>
                <Feather name="check" size={13} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Plan toggle ── */}
        <View style={styles.planToggleWrap}>
          <View style={styles.planToggle}>
            {PLANS.map((plan) => {
              const active = selectedPlan === plan.key;
              return (
                <TouchableOpacity
                  key={plan.key}
                  style={[styles.planSegment, active && styles.planSegmentActive]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedPlan(plan.key); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.planSegmentLabel, active && styles.planSegmentLabelActive]}>
                    {plan.label}
                  </Text>
                  {plan.badge && (
                    <Text style={[styles.planSegmentBadge, active && styles.planSegmentBadgeActive]}>
                      {plan.badge}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>{activePlan?.displayPrice}</Text>
            <Text style={styles.planPer}>{activePlan?.per}</Text>
          </View>
          <Text style={styles.planBilled}>{activePlan?.billed}</Text>
        </View>

        {/* ── CTA ── */}
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
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
                <Text style={styles.ctaBtnText}>Start Free Trial</Text>
                <Text style={styles.ctaBtnSub}>
                  7 days free · then {activePlan?.displayPrice}{activePlan?.per}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          After your 7-day free trial, {activePlan?.billed?.toLowerCase()}.
          {" "}Subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage in your Apple ID settings.{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms</Text>
          {" "}·{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy</Text>
        </Text>
      </Animated.ScrollView>
    </View>
    </View>
  );
}
