// ============================================================
// src/screens/WeeklyBriefingScreen.js
// Pro feature: AI-generated day-by-day plan for the next 7 days.
// Loads in background — user can navigate away and come back.
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radius, shadows, typography } from "../utils/theme";
import { useTasks }       from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { getWeeklyPlan }  from "../services/openai";

// Module-level cache so plan survives navigation away and back
let _cachedPlan      = null;
let _cacheLoadedAt   = null;
let _pendingPromise  = null;
const CACHE_TTL_MS   = 10 * 60 * 1000; // 10 minutes

const WeeklyBriefingScreen = ({ navigation }) => {
  const { tasks, patterns }  = useTasks();
  const { profile }          = useUserProfile();

  const [plan, setPlan]       = useState(_cachedPlan);
  const [loading, setLoading] = useState(!_cachedPlan);
  const [error, setError]     = useState(null);
  const mountedRef            = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // If we have a fresh cache, use it immediately
    if (_cachedPlan && _cacheLoadedAt && (Date.now() - _cacheLoadedAt) < CACHE_TTL_MS) {
      setPlan(_cachedPlan);
      setLoading(false);
      return;
    }
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    setLoading(true);
    setError(null);

    // If there's already a pending request, just wait on it
    if (_pendingPromise) {
      try {
        const result = await _pendingPromise;
        if (mountedRef.current) { setPlan(result); setLoading(false); }
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
      if (mountedRef.current) { setPlan(result); setLoading(false); }
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Briefing</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} disabled={loading}>
          <Feather name="refresh-cw" size={18} color={loading ? colors.textMuted : colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
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

            <View style={{ height: 40 }} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:     { padding: 4 },
  headerTitle: { ...typography.h2 },
  refreshBtn:  { padding: 4 },
  scroll:      { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  loadingContainer: { alignItems: "center", paddingTop: 80 },
  loadingText:      { ...typography.h3, marginTop: spacing.md },
  loadingSubtext:   { ...typography.body, textAlign: "center", marginTop: 6 },
  loadingHint: {
    ...typography.bodySmall, textAlign: "center", marginTop: 12,
    color: colors.textMuted, fontStyle: "italic",
  },

  errorContainer: { alignItems: "center", paddingTop: 80 },
  errorTitle:     { ...typography.h2, marginTop: spacing.md, marginBottom: 6 },
  errorText:      { ...typography.body, textAlign: "center", marginBottom: spacing.lg },
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
  headline:    { ...typography.h2, lineHeight: 26, marginBottom: spacing.sm },
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
  dayDate:    { ...typography.bodySmall },
  taskRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  taskDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, flexShrink: 0 },
  taskTitle:  { ...typography.body, color: colors.textPrimary, flex: 1 },
  restDay:    { ...typography.bodySmall, fontStyle: "italic" },
  dayNote: {
    ...typography.bodySmall, color: colors.accent, marginTop: 4, fontStyle: "italic",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8,
  },
});

export default WeeklyBriefingScreen;