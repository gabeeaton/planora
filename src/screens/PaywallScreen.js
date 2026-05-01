import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { getOfferings, purchasePackage, restorePurchases } from "../services/purchases";
import { setProStatus } from "../services/firebase";
import { invalidateTodayFocusCache } from "../services/openai";
import * as Haptics from "expo-haptics";

const FEATURES = [
  { icon: "cpu",            label: "AI Priority Coach" },
  { icon: "message-circle", label: "Unlimited AI Chat" },
  { icon: "bell",           label: "Smart Reminders" },
  { icon: "edit-3",         label: "Weekly Study Plan" },
];

const PLANS = [
  { key: "annual",   label: "Annual",   price: "$2.50", per: "/mo", billing: "Billed as $29.99/yr", badge: "Best Value" },
  { key: "semester", label: "6 Months", price: "$3.00", per: "/mo", billing: "Billed as $17.99",    badge: null },
  { key: "monthly",  label: "Monthly",  price: "$4.99", per: "/mo", billing: "Billed monthly",       badge: null },
];

export default function PaywallScreen({ navigation }) {
  const { colors }   = useTheme();
  const { user }     = useAuth();
  const insets       = useSafeAreaInsets();
  const styles       = makeStyles(colors, insets);

  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [loading, setLoading]           = useState(false);
  const [packages, setPackages]         = useState({});

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(28)).current;
  const ctaScale   = useRef(new Animated.Value(1)).current;
  const planScales = useRef(PLANS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    getOfferings().then(setPackages).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSelectPlan = (key) => {
    if (key === selectedPlan) return;
    const idx = PLANS.findIndex((p) => p.key === key);
    Haptics.selectionAsync().catch(() => {});
    Animated.sequence([
      Animated.spring(planScales[idx], { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(planScales[idx], { toValue: 1,    useNativeDriver: true, speed: 24, bounciness: 6 }),
    ]).start();
    setSelectedPlan(key);
  };

  const handleUpgrade = async () => {
    const pkg = packages[selectedPlan];
    if (!pkg) {
      Alert.alert("Not available", "This plan isn't available right now. Please try again.");
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      // Immediately write isPro to Firestore so entitlement is reflected in the app
      // even if RevenueCat's listener is delayed (especially in sandbox)
      if (user?.uid) setProStatus(user.uid, true).catch(() => {});
      invalidateTodayFocusCache();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("You're in! 🎉", "Scholar is now unlocked. Build your first study plan.", [
        { text: "Let's go!", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err.userCancelled) return;
      const msg = (() => {
        const raw = (err.message ?? "").toLowerCase();
        if (raw.includes("entitlement not activated"))
          return "Your payment went through but activation is still processing. Tap \"Restore purchases\" in a moment to unlock Scholar.";
        if (raw.includes("network") || raw.includes("internet") || raw.includes("connection"))
          return "No internet connection. Check your network and try again.";
        if (raw.includes("payment") || raw.includes("card") || raw.includes("billing"))
          return "Payment couldn't be processed. Check your payment method in Apple ID Settings.";
        if (raw.includes("not available") || raw.includes("unavailable"))
          return "This plan isn't available right now. Try again in a moment.";
        return "Something went wrong. Please try again.";
      })();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Purchase failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        if (user?.uid) setProStatus(user.uid, true).catch(() => {});
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

  const activePlan = PLANS.find((p) => p.key === selectedPlan);

  return (
    <View style={styles.overlay}>
      <View style={styles.root}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={15} color={colors.textMuted} />
        </TouchableOpacity>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>SCHOLAR</Text>
            <Text style={styles.heroTitle}>Your AI academic{"\n"}coach, unlocked.</Text>
            <View style={styles.trialBadge}>
              <Feather name="gift" size={12} color={colors.accent} />
              <Text style={styles.trialBadgeText}>7-day free trial · No charge today</Text>
            </View>
          </View>

          {/* ── Plan cards ── */}
          <View style={styles.plansWrap}>
            {PLANS.map((plan, idx) => {
              const selected = selectedPlan === plan.key;
              return (
                <Animated.View key={plan.key} style={{ transform: [{ scale: planScales[idx] }] }}>
                  <TouchableOpacity
                    style={[styles.planCard, selected && styles.planCardSelected]}
                    onPress={() => handleSelectPlan(plan.key)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>
                          {plan.label}
                        </Text>
                        {plan.badge && (
                          <View style={[styles.planBadge, selected && styles.planBadgeSelected]}>
                            <Text style={[styles.planBadgeText, selected && styles.planBadgeTextSelected]}>
                              {plan.badge}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.planBilling}>{plan.billing}</Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>
                        {plan.price}
                      </Text>
                      <Text style={styles.planPer}>{plan.per}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* ── Feature grid ── */}
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureCell}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon} size={13} color={colors.accent} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
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
                    7 days free · then {activePlan?.price}{activePlan?.per} · cancel anytime
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreBtnText}>Restore purchases</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            Free trial ends after 7 days. {activePlan?.billing?.toLowerCase()}.{" "}
            Subscription renews automatically unless cancelled at least 24 hours before the end of the period.{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms</Text>
            {" "}·{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy</Text>
          </Text>
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const makeStyles = (colors, insets) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  root: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    overflow: "hidden",
  },
  handleWrap: { alignItems: "center", paddingTop: 12 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.isDark ? colors.border : "#D1D1D8",
  },
  closeBtn: {
    position: "absolute", top: 14, right: 16,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.isDark ? colors.bgCard : "#F2F2F7",
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: Math.max(insets.bottom, 24) + 8,
  },

  // ── Hero ──────────────────────────────────────────────────────
  hero: { alignItems: "center", paddingTop: 18, paddingBottom: 20 },
  heroLabel: {
    fontSize: 11, fontFamily: "Outfit-ExtraBold",
    color: colors.accent, letterSpacing: 2.5, marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30, fontFamily: "Outfit-ExtraBold",
    color: colors.textPrimary, textAlign: "center",
    letterSpacing: -0.6, lineHeight: 36, marginBottom: 14,
  },
  trialBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.accent + "55",
    paddingHorizontal: 14, paddingVertical: 7,
  },
  trialBadgeText: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.accent },

  // ── Plan cards ────────────────────────────────────────────────
  plansWrap: { gap: 8, marginBottom: 16 },
  planCard: {
    flexDirection: "row", alignItems: "center",
    gap: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.isDark ? colors.bgCard : "#F7F7FC",
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.textMuted,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.accent,
  },
  planLabel: {
    fontSize: 15, fontFamily: "Outfit-Bold",
    color: colors.textSecondary,
  },
  planLabelSelected: { color: colors.textPrimary },
  planBilling: {
    fontSize: 11, fontFamily: "Outfit-Regular",
    color: colors.textMuted, marginTop: 2,
  },
  planBadge: {
    backgroundColor: colors.accentGlow,
    borderRadius: 6, borderWidth: 1, borderColor: colors.accent + "55",
    paddingHorizontal: 7, paddingVertical: 2,
  },
  planBadgeSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  planBadgeText: {
    fontSize: 10, fontFamily: "Outfit-ExtraBold",
    color: colors.accent, letterSpacing: 0.2,
  },
  planBadgeTextSelected: { color: "#fff" },
  planPrice: {
    fontSize: 20, fontFamily: "Outfit-ExtraBold",
    color: colors.textSecondary, letterSpacing: -0.5,
  },
  planPriceSelected: { color: colors.textPrimary },
  planPer: {
    fontSize: 11, fontFamily: "Outfit-Medium",
    color: colors.textMuted,
  },

  // ── Feature grid ─────────────────────────────────────────────
  featureGrid: {
    flexDirection: "row", flexWrap: "wrap",
    columnGap: 12, rowGap: 12,
    marginBottom: 20,
  },
  featureCell: {
    width: "47%",
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  featureIcon: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 13, fontFamily: "Outfit-SemiBold",
    color: colors.textSecondary, flex: 1,
  },

  // ── CTA ──────────────────────────────────────────────────────
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: 16, paddingVertical: 17,
    alignItems: "center", marginBottom: 10,
    ...shadows.accent,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { fontSize: 17, fontFamily: "Outfit-ExtraBold", color: "#fff" },
  ctaBtnSub: {
    fontSize: 12, color: "rgba(255,255,255,0.72)",
    marginTop: 3, fontFamily: "Outfit-Medium",
  },

  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreBtnText: { fontSize: 13, color: colors.textMuted, fontFamily: "Outfit-Regular" },

  legal: {
    fontSize: 10, color: colors.textMuted,
    textAlign: "center", lineHeight: 14,
    marginTop: 4, paddingHorizontal: 8,
  },
  legalLink: { textDecorationLine: "underline" },
});
