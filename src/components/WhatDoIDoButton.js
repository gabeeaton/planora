// ============================================================
// src/components/WhatDoIDoButton.js
// The single most important UI element in the app.
// One tap → one confident AI recommendation.
// Pro feature only.
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { getWhatDoIDo } from "../services/openai";


const makeStyles = (colors) => StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...shadows.accent,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,92,92,0.1)",
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.high,
    gap: 8,
  },
  errorText: {
    color: colors.high,
    fontSize: 13,
    flex: 1,
  },
  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accentGlow,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    ...shadows.accent,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  aiChipText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recommendation: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 23,
    marginBottom: spacing.sm,
  },
  reasoning: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  askAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
  },
  askAgainText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
  },
});

const WhatDoIDoButton = ({ tasks, userProfile, patterns, onTaskHighlight }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState(null);

  const handlePress = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const recommendation = await getWhatDoIDo(tasks, userProfile, patterns);
      setResult(recommendation);
      if (recommendation?.taskId && onTaskHighlight) {
        onTaskHighlight(recommendation.taskId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => { setResult(null); setError(null); };

  return (
    <View style={styles.wrapper}>
      {/* The main button */}
      {!result && (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonLoading]}
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <>
              <ActivityIndicator size={18} color="#fff" />
              <Text style={styles.buttonText}>Thinking...</Text>
            </>
          ) : (
            <>
              <Feather name="cpu" size={18} color="#fff" />
              <Text style={styles.buttonText}>What should I do right now?</Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorCard}>
          <Feather name="alert-triangle" size={14} color={colors.high} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleDismiss}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Result card */}
      {result && (
        <View style={styles.resultCard}>
          {/* Header */}
          <View style={styles.resultHeader}>
            <View style={styles.aiChip}>
              <Feather name="cpu" size={11} color={colors.accent} />
              <Text style={styles.aiChipText}>AI Coach</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Recommendation */}
          <Text style={styles.recommendation}>{result.recommendation}</Text>

          {/* Reasoning */}
          {result.reasoning && (
            <Text style={styles.reasoning}>{result.reasoning}</Text>
          )}

          {/* Ask again */}
          <TouchableOpacity style={styles.askAgainBtn} onPress={handlePress}>
            <Feather name="refresh-cw" size={12} color={colors.accent} />
            <Text style={styles.askAgainText}>Ask again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};


export default WhatDoIDoButton;