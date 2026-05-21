import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Linking, Animated, PanResponder, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { getOfferings, purchasePackage, restorePurchases } from "../services/purchases";
import { setProStatus } from "../services/firebase";
import { invalidateTodayFocusCache } from "../services/openai";
import { FEATURE_FLAGS } from "../config";
import * as Haptics from "expo-haptics";
import { getTrialInfo } from "../utils/trialHelpers";

const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

const FEATURES = [
  { icon: "cpu",            label: "AI Priority Coach",     desc: "Ranks your tasks by urgency so you always know what's next." },
  { icon: "message-circle", label: "Unlimited AI Chat",     desc: "Ask Ace anything about your workload, any time." },
  { icon: "bell",           label: "Smart Reminders",       desc: "Nudges that adapt to your deadlines and habits." },
  { icon: "edit-3",         label: "Weekly Study Plan",     desc: "AI builds your study schedule so you never cram again." },
  { icon: "trending-up",    label: "Behavioral Insights",   desc: "See when you're most productive and where you lose time." },
  { icon: "cloud",          label: "Cloud Sync",            desc: "Your data backed up and synced across devices." },
];

const TRUST_SIGNALS_TRIAL = [
  { icon: "shield",   label: "No charge today" },
  { icon: "x-circle", label: "Cancel anytime" },
  { icon: "lock",     label: "Secure via App Store" },
];
const TRUST_SIGNALS_NO_TRIAL = [
  { icon: "x-circle", label: "Cancel anytime" },
  { icon: "lock",     label: "Secure via App Store" },
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
  const scrollRef        = useRef(null);
  const dismissTriggered = useRef(false);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(28)).current;
  const ctaScale    = useRef(new Animated.Value(1)).current;
  const planScales  = useRef(PLANS.map(() => new Animated.Value(1))).current;
  const sheetY      = useRef(new Animated.Value(0)).current;
  const overlayFade = useRef(new Animated.Value(1)).current;

  const dismissSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.timing(sheetY,      { toValue: 600, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayFade, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  };

  const swipePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) sheetY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        dismissSheet();
      } else {
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
    },
  })).current;

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
    if (DEMO_MODE) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("You're in! 🎉", "Scholar is now unlocked.", [
        { text: "Let's go!", onPress: () => navigation.goBack() },
      ]);
      return;
    }
    const pkg = packages[selectedPlan];
    if (!pkg) {
      Alert.alert("Not available", "This plan isn't available right now. Please try again.");
      return;
    }
    setLoading(true);
    const succeed = () => {
      if (user?.uid) setProStatus(user.uid, true).catch(() => {});
      invalidateTodayFocusCache();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("You're in! 🎉", "Scholar is now unlocked. Build your first study plan.", [
        { text: "Let's go!", onPress: () => navigation.goBack() },
      ]);
    };
    try {
      await purchasePackage(pkg);
      succeed();
    } catch (err) {
      if (err.userCancelled) return;
      const raw = (err.message ?? "").toLowerCase();
      // StoreKit accepted the payment but RevenueCat's backend hasn't synced yet
      // (very common in sandbox). Treat as success — Firestore flag is source of truth.
      if (raw.includes("entitlement not activated")) {
        succeed();
        return;
      }
      const msg = (() => {
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

  const activePlan             = PLANS.find((p) => p.key === selectedPlan);
  const { hasTrial, trialDays } = getTrialInfo(packages[selectedPlan]);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
      <Animated.View style={[styles.root, { transform: [{ translateY: sheetY }] }]}>
        {/* Handle — attach swipe-down gesture here */}
        <View style={styles.handleWrap} {...swipePan.panHandlers}>
          <View style={styles.handle} />
        </View>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={dismissSheet}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={15} color={colors.textMuted} />
        </TouchableOpacity>

        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEventThrottle={16}
          onScrollEndDrag={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < -52 && !dismissTriggered.current) {
              dismissTriggered.current = true;
              dismissSheet();
            }
          }}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            {/* Layered decorative orbs */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={styles.heroOrb1} />
              <View style={styles.heroOrb2} />
              <View style={styles.heroOrb3} />
            </View>

            <View style={styles.heroIconWrap}>
              <Image source={require("../../icon.png")} style={{ width: 68, height: 68, borderRadius: 16 }} resizeMode="contain" />
            </View>
            <Text style={styles.heroLabel}>SCHOLAR PLAN</Text>
            <Text style={styles.heroTitle}>Your AI academic{"\n"}coach, unlocked.</Text>

            {/* Trust signals — honest, verifiable */}
            <View style={styles.trustRow}>
              {(hasTrial ? TRUST_SIGNALS_TRIAL : TRUST_SIGNALS_NO_TRIAL).map((t, i) => (
                <View key={t.label} style={styles.trustItem}>
                  <Feather name={t.icon} size={11} color={colors.accent} />
                  <Text style={styles.trustText}>{t.label}</Text>
                  {i < (hasTrial ? TRUST_SIGNALS_TRIAL : TRUST_SIGNALS_NO_TRIAL).length - 1 && (
                    <View style={styles.trustDivider} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── Plan cards ── */}
          <View style={[styles.plansWrap, { marginTop: 16 }]}>
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

          {/* ── Feature list ── */}
          <View style={styles.featureList}>
            {FEATURES.map((f, i) => (
              <View key={f.label} style={[styles.featureRow, i === FEATURES.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.featureIconWrap}>
                  <Feather name={f.icon} size={14} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
                <Feather name="check" size={14} color={colors.accent} />
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
                  <Text style={styles.ctaBtnText}>
                    {hasTrial ? `Start ${trialDays}-Day Free Trial` : "Get Scholar"}
                  </Text>
                  <Text style={styles.ctaBtnSub}>
                    {hasTrial
                      ? `${trialDays} days free · then ${activePlan?.price}${activePlan?.per} · cancel anytime`
                      : `${activePlan?.price}${activePlan?.per} · ${activePlan?.billing?.toLowerCase()} · cancel anytime`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn}>
            <Text style={styles.restoreBtnText}>Restore purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={dismissSheet} style={styles.freePlanBtn}>
            <Text style={styles.freePlanText}>Continue with free plan</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            {hasTrial ? `Free trial ends after ${trialDays} days. ` : ""}{activePlan?.billing?.toLowerCase()}.{" "}
            Subscription renews automatically unless cancelled at least 24 hours before the end of the period.{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms</Text>
            {" "}·{" "}
            <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy</Text>
          </Text>
        </Animated.ScrollView>
      </Animated.View>
    </Animated.View>
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
  handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
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
  hero: {
    alignItems: "center",
    paddingTop: 20, paddingBottom: 28,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.isDark ? colors.accent + "22" : colors.accent + "12",
    borderBottomWidth: 1,
    borderBottomColor: colors.accent + "20",
    overflow: "hidden",
  },
  heroOrb1: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.accent + "30", top: -100, right: -70,
  },
  heroOrb2: {
    position: "absolute", width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.accent + "20", bottom: -50, left: -50,
  },
  heroOrb3: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.accent + "18", top: 10, left: -20,
  },
  heroIconWrap: {
    width: 68, height: 68, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 10,
    overflow: "hidden",
  },
  heroLabel: {
    fontSize: 10, fontFamily: "Outfit-ExtraBold",
    color: colors.accent, letterSpacing: 2.8, marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28, fontFamily: "Outfit-ExtraBold",
    color: colors.textPrimary, textAlign: "center",
    letterSpacing: -0.5, lineHeight: 34, marginBottom: 20,
  },
  statsPillRow: {
    flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center",
  },
  trustRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 0, flexWrap: "wrap", marginTop: 14,
  },
  trustItem: {
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  trustText: {
    fontSize: 11, fontFamily: "Outfit-Medium",
    color: colors.isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
  },
  trustDivider: {
    width: 1, height: 10, marginHorizontal: 8,
    backgroundColor: colors.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
  },
  statsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.isDark ? colors.accent + "22" : "#fff",
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.accent + "35",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statsPillText: { fontSize: 11, fontFamily: "Outfit-SemiBold", color: colors.accent },
  // ── Plan cards ────────────────────────────────────────────────
  plansWrap: { gap: 8, marginBottom: 20 },
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

  // ── Feature list ─────────────────────────────────────────────
  featureList: {
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: 16, borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2",
    overflow: "hidden",
    marginBottom: 20,
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    }),
  },
  featureRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F2F2F8",
  },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary,
  },
  featureDesc: {
    fontSize: 11, fontFamily: "Outfit-Regular",
    color: colors.textMuted, marginTop: 1, lineHeight: 15,
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

  restoreBtn: { alignItems: "center", paddingVertical: 8, marginTop: 10 },
  restoreBtnText: { fontSize: 13, color: colors.textMuted, fontFamily: "Outfit-Regular" },
  freePlanBtn: { alignItems: "center", paddingVertical: 10 },
  freePlanText: {
    fontSize: 13, fontFamily: "Outfit-SemiBold",
    color: colors.isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)",
    textDecorationLine: "underline",
  },

  legal: {
    fontSize: 10, color: colors.textMuted,
    textAlign: "center", lineHeight: 14,
    marginTop: 4, paddingHorizontal: 8,
  },
  legalLink: { textDecorationLine: "underline" },
});
