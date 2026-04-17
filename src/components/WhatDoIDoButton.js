// ============================================================
// src/components/WhatDoIDoButton.js
//
// Free tier: unlimited uses, rate-limited server-side (10 AI calls/day).
// No lifetime cap — users get hooked before hitting any wall.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useSubscription } from "../hooks/useSubscription";
import { getWhatDoIDo, suggestPriorities } from "../services/openai";

const makeStyles = (colors) => StyleSheet.create({
  wrapper: { marginBottom: spacing.md },

  // Main CTA button
  button: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 16, paddingHorizontal: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 10, ...shadows.accent,
  },
  buttonText: { color: "#fff", fontSize: 15, fontFamily: "Outfit-Bold", flex: 1 },

  // Result card
  resultCard: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF", // Added #
    borderRadius: radius.lg, 
    padding: spacing.md,
    borderWidth: 1, 
    borderColor: colors.isDark ? colors.border : "transparent",
    
    // Use a separate styling for the accent line to avoid shadow clipping
    borderLeftWidth: 5, 
    borderLeftColor: colors.accent,

    // SHADOW FIX
    ...(colors.isDark
      ? {}
      : {
          shadowColor: "#6B6B8A",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
          elevation: 5,
          backgroundColor: "#FFFFFF",
        }),
},
  resultHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: spacing.sm,
  },
  aiChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.accentGlow, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent,
  },
  aiChipText: { fontSize: 10, color: colors.accent, fontFamily: "Outfit-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  recommendation: {
    fontSize: 17, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
    lineHeight: 24, marginBottom: spacing.sm,
  },
  reasoning: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md,
  },
  // Secondary actions row at bottom of result
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: radius.md,
  },
  actionBtnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated },
  actionBtnFilled:  { backgroundColor: colors.accent, ...shadows.accent },
  actionBtnText:    { fontSize: 12, color: colors.textSecondary, fontFamily: "Outfit-SemiBold" },
  actionBtnTextFilled: { fontSize: 12, color: "#fff", fontFamily: "Outfit-Bold" },

  // Priority done state
  priorityDoneBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", backgroundColor: "rgba(92,255,143,0.12)",
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "#5CFF8F",
  },
  priorityDoneText: { fontSize: 12, color: "#5CFF8F", fontFamily: "Outfit-SemiBold" },

  errorCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,92,92,0.1)", borderRadius: radius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: "#FF5C5C", gap: 8,
  },
  errorText: { color: "#FF5C5C", fontSize: 13, flex: 1 },
});

const WhatDoIDoButton = ({ tasks, userProfile, patterns, onTaskHighlight, onUpgrade, onPrioritiesUpdated }) => {
  const { colors }       = useTheme();
  const styles           = makeStyles(colors);
  const { hasProAccess } = useSubscription();

  const [loading, setLoading]                 = useState(false);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [result, setResult]                   = useState(null);
  const [priorityDone, setPriorityDone]       = useState(false);
  const [error, setError]                     = useState(null);

  // ── Hit the "Find my focus" API ──────────────────────────
  const handlePress = async () => {
    if (!hasProAccess) { onUpgrade?.(); return; }
    setLoading(true); setError(null); setResult(null); setPriorityDone(false);
    try {
      const rec = await getWhatDoIDo(tasks, userProfile, patterns);
      setResult(rec);
    } catch (err) {
      if (err?.limitReached) {
        onUpgrade?.();
      } else {
        setError(err.message ?? "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Secondary: suggest priorities for the whole list ────
  const handleSuggestPriority = async () => {
    if (!hasProAccess) { onUpgrade?.(); return; }
    setPriorityLoading(true);
    try {
      const pending   = tasks.filter((t) => !t.completed);
      const annotated = await suggestPriorities(pending, patterns);
      onPrioritiesUpdated?.(annotated);
      setPriorityDone(true);
    } catch {
      // Silently fail — priority suggestion is a nice-to-have
    } finally {
      setPriorityLoading(false);
    }
  };

  const handleDismiss = () => { setResult(null); setError(null); setPriorityDone(false); };

  return (
    <View style={styles.wrapper}>

      {/* Error */}
      {error && (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={14} color="#FF5C5C" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main button — shown when no result yet */}
      {!result && !error && (
        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.8 }]}
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <><ActivityIndicator size={18} color="#fff" /><Text style={styles.buttonText}>Thinking...</Text></>
            : (
              <>
                <Feather name="cpu" size={18} color="#fff" />
                <Text style={styles.buttonText}>Find my focus</Text>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
              </>
            )
          }
        </TouchableOpacity>
      )}

      {/* Result card */}
      {result && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.aiChip}>
              <Feather name="cpu" size={11} color={colors.accent} />
              <Text style={styles.aiChipText}>AI Coach</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.recommendation}>{result.recommendation}</Text>

          {result.reasoning && (
            <Text style={styles.reasoning}>{result.reasoning}</Text>
          )}

          <View style={styles.actionsRow}>
            {/* Ask again */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={handlePress}
              disabled={loading || priorityLoading}
            >
              {loading
                ? <ActivityIndicator size={12} color={colors.textMuted} />
                : <Feather name="refresh-cw" size={12} color={colors.textMuted} />
              }
              <Text style={styles.actionBtnText}>Ask again</Text>
            </TouchableOpacity>

            {/* Suggest priorities — Pro only */}
            {!priorityDone ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnFilled]}
                onPress={handleSuggestPriority}
                disabled={loading || priorityLoading}
              >
                {priorityLoading
                  ? <ActivityIndicator size={12} color="#fff" />
                  : <Feather name="zap" size={12} color="#fff" />
                }
                <Text style={styles.actionBtnTextFilled}>
                  {priorityLoading ? "Sorting..." : "Sort all by priority"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.priorityDoneBadge}>
                <Feather name="check" size={12} color="#5CFF8F" />
                <Text style={styles.priorityDoneText}>Priorities updated</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default WhatDoIDoButton;
