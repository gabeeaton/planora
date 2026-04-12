// ============================================================
// src/screens/WeeklyBriefingScreen.js
// Pro feature: AI-generated day-by-day plan for the next 7 days.
// Loads in background — user can navigate away and come back.
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Animated, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks }          from "../hooks/useTasks";
import { useUserProfile }    from "../hooks/useUserProfile";
import { useSubscription }   from "../hooks/useSubscription";
import { getWeeklyPlan }     from "../services/openai";


const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { ...typography.h2, color: colors.textPrimary, },
  refreshBtn:  { padding: 4 },
  shareBtn:    { padding: 4 },
  scroll:      { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  loadingContainer: { alignItems: "center", paddingTop: 80 },
  loadingText:      { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md },
  loadingSubtext:   { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: 6 },
  loadingHint: {
    ...typography.bodySmall, color: colors.textSecondary, textAlign: "center", marginTop: 12,
    color: colors.textMuted, fontStyle: "italic",
  },

  errorContainer: { alignItems: "center", paddingTop: 80 },
  errorTitle:     { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md, marginBottom: 6 },
  errorText:      { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  retryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  headlineCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.accentGlow, marginBottom: spacing.md, ...shadows.accent,
  },
  aiChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start",
    marginBottom: 8, borderWidth: 1, borderColor: colors.accent,
  },
  aiChipText:  { fontSize: 10, color: colors.accent, fontWeight: "700", textTransform: "uppercase" },
  headline:    { ...typography.h2, color: colors.textPrimary, lineHeight: 26, marginBottom: spacing.sm },
  insightRow:  { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  insightText: { ...typography.bodySmall, color: colors.accent, flex: 1, fontStyle: "italic" },

  warningsCard: {
    backgroundColor: "rgba(255,92,92,0.08)", borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.high, marginBottom: spacing.md,
  },
  warningsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  warningsTitle:  { fontSize: 14, fontWeight: "700", color: colors.high },
  warningItem:    { ...typography.bodySmall, color: colors.high, marginBottom: 4 },

  dayCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  dayHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  dayName:    { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  dayDate:    { ...typography.bodySmall, color: colors.textSecondary, },
  taskRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  taskDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, flexShrink: 0 },
  taskTitle:  { ...typography.body, color: colors.textPrimary, flex: 1 },
  restDay:    { ...typography.bodySmall, color: colors.textSecondary, fontStyle: "italic" },
  dayNote: {
    ...typography.bodySmall, color: colors.accent, marginTop: 4, fontStyle: "italic",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8,
  },
  regenerateRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, marginTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  regenerateText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },

  // Upsell state
  upsellContainer: { alignItems: "center", paddingTop: 60, paddingHorizontal: spacing.lg },
  upsellIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    ...shadows.accent,
  },
  upsellTitle:    { fontSize: 22, fontWeight: "800", color: colors.textPrimary, textAlign: "center", letterSpacing: -0.3, marginBottom: 8 },
  upsellSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.xl },
  upsellBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    ...shadows.accent,
  },
  upsellBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  upsellPreview: {
    width: "100%", marginTop: spacing.xl,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, opacity: 0.45,
  },
  upsellPreviewRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  upsellPreviewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  upsellPreviewLine: { height: 12, borderRadius: 6, backgroundColor: colors.border, flex: 1 },
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});

// Module-level cache so plan survives navigation away and back
let _cachedPlan      = null;
let _cacheLoadedAt   = null;
let _pendingPromise  = null;
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

const WeeklyBriefingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { tasks, patterns }  = useTasks();
  const { profile }          = useUserProfile();
  const { isPro }            = useSubscription();

  const [plan, setPlan]       = useState(_cachedPlan);
  const [loading, setLoading] = useState(!_cachedPlan);
  const [error, setError]     = useState(null);
  const mountedRef            = useRef(true);
  const isVisibleRef          = useRef(true);
  const toastAnim             = useRef(new Animated.Value(0)).current;

  const showToast = () => {
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    mountedRef.current = true;
    const unsubFocus = navigation.addListener('focus', () => { isVisibleRef.current = true; });
    const unsubBlur  = navigation.addListener('blur',  () => { isVisibleRef.current = false; });
    return () => {
      mountedRef.current = false;
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    // If we have a fresh cache, use it immediately
    if (_cachedPlan && _cacheLoadedAt && (Date.now() - _cacheLoadedAt) < CACHE_TTL_MS) {
      setPlan(_cachedPlan);
      setLoading(false);
      return;
    }
    fetchPlan();
  }, [isPro]);

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);

    // If there's already a pending request, just wait on it
    if (_pendingPromise) {
      try {
        const result = await _pendingPromise;
        if (mountedRef.current) {
        setPlan(result);
        setLoading(false);
        if (!isVisibleRef.current) showToast();
      }
      } catch (err) {
        if (mountedRef.current) { setError(err.message ?? "Failed to generate plan."); setLoading(false); }
      }
      return;
    }

    const safePatterns = patterns ?? {
      avoidanceScores: [], completionByClass: {},
      latenessProfile: { label: "unknown", avgDaysBefore: null },
      productiveTimeOfDay: { bestTime: "unknown", counts: {} },
      staleTasks: [], urgentUntouched: [],
      overallStats: { totalPending: 0, totalCompleted: 0, totalOverdue: 0, historyCount: 0 },
    };
    const safeProfile = profile ?? {};

    _pendingPromise = getWeeklyPlan(tasks, safeProfile, safePatterns);

    try {
      const result = await _pendingPromise;
      _cachedPlan    = result;
      _cacheLoadedAt = Date.now();
      if (mountedRef.current) {
        setPlan(result);
        setLoading(false);
        if (!isVisibleRef.current) showToast();
      }
    } catch (err) {
      if (mountedRef.current) { setError(err.message ?? "Failed to generate plan."); setLoading(false); }
    } finally {
      _pendingPromise = null;
    }
  };

  const handleRefresh = () => {
    _cachedPlan    = null;
    _cacheLoadedAt = null;
    fetchPlan();
  };

  const handleShare = async () => {
    if (!plan) return;
    const lines = [`📅 My Planora Weekly Plan\n`, plan.headline, ""];
    plan.days?.forEach((day) => {
      lines.push(`${day.day} (${day.date})`);
      if (day.tasks?.length > 0) {
        day.tasks.forEach((t) => lines.push(`  • ${t}`));
      } else {
        lines.push("  Rest day");
      }
      lines.push("");
    });
    await Share.share({ message: lines.join("\n") }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Briefing</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {plan && !loading && (
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Feather name="share" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} disabled={loading}>
            <Feather name="refresh-cw" size={18} color={loading ? colors.textMuted : colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!isPro ? (
          <View style={styles.upsellContainer}>
            <View style={styles.upsellIcon}>
              <Feather name="calendar" size={32} color={colors.accent} />
            </View>
            <Text style={styles.upsellTitle}>Your AI Weekly Plan</Text>
            <Text style={styles.upsellSubtitle}>
              Scholar builds a day-by-day study plan based on your tasks, deadlines, and work habits — and updates it every 24 hours.
            </Text>
            <TouchableOpacity
              style={styles.upsellBtn}
              onPress={() => navigation.navigate("Paywall")}
              activeOpacity={0.85}
            >
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.upsellBtnText}>Unlock with Scholar</Text>
            </TouchableOpacity>
            {/* Blurred preview skeleton */}
            <View style={styles.upsellPreview}>
              {[80, 60, 90, 50, 70].map((w, i) => (
                <View key={i} style={styles.upsellPreviewRow}>
                  <View style={styles.upsellPreviewDot} />
                  <View style={[styles.upsellPreviewLine, { maxWidth: `${w}%` }]} />
                </View>
              ))}
            </View>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Building your plan...</Text>
            <Text style={styles.loadingSubtext}>
              Analyzing your tasks, deadlines, and work patterns.
            </Text>
            <Text style={styles.loadingHint}>
              You can navigate away — we'll keep loading in the background.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-triangle" size={32} color={colors.high} />
            <Text style={styles.errorTitle}>Couldn't generate plan</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : plan ? (
          <>
            {/* Headline */}
            <View style={styles.headlineCard}>
              <View style={styles.aiChip}>
                <Feather name="cpu" size={11} color={colors.accent} />
                <Text style={styles.aiChipText}>AI Coach</Text>
              </View>
              <Text style={styles.headline}>{plan.headline}</Text>
              {plan.keyInsight && (
                <View style={styles.insightRow}>
                  <Feather name="trending-up" size={13} color={colors.accent} />
                  <Text style={styles.insightText}>{plan.keyInsight}</Text>
                </View>
              )}
            </View>

            {/* Warnings */}
            {plan.warnings?.length > 0 && (
              <View style={styles.warningsCard}>
                <View style={styles.warningsHeader}>
                  <Feather name="alert-triangle" size={14} color={colors.high} />
                  <Text style={styles.warningsTitle}>Heads Up</Text>
                </View>
                {plan.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningItem}>• {w}</Text>
                ))}
              </View>
            )}

            {/* Day-by-day */}
            {plan.days?.map((day, i) => (
              <View key={i} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.day}</Text>
                  <Text style={styles.dayDate}>{day.date}</Text>
                </View>
                {day.tasks?.length > 0 ? (
                  day.tasks.map((taskTitle, j) => (
                    <View key={j} style={styles.taskRow}>
                      <View style={styles.taskDot} />
                      <Text style={styles.taskTitle}>{taskTitle}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.restDay}>Rest day — nothing scheduled</Text>
                )}
                {day.note && <Text style={styles.dayNote}>{day.note}</Text>}
              </View>
            ))}

            <TouchableOpacity style={styles.regenerateRow} onPress={handleRefresh} disabled={loading}>
              <Feather name="refresh-cw" size={13} color={colors.textMuted} />
              <Text style={styles.regenerateText}>Regenerate plan</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </>
        ) : null}
      </ScrollView>
      {/* Toast — shown when plan loads while user is on another screen */}
      <Animated.View
        style={[styles.toast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }]}
        pointerEvents="none"
      >
        <Feather name="calendar" size={14} color="#fff" />
        <Text style={styles.toastText}>Your weekly plan is ready!</Text>
      </Animated.View>
    </SafeAreaView>
  );
};


export default WeeklyBriefingScreen;