// ============================================================
// components/AISummaryCard.js
// Shows the GPT-generated daily task summary on the dashboard.
// Also contains the "Suggest Priority" button.
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, typography, spacing, radius, shadows } from "../utils/theme";
import { summarizeTasks, suggestPriorities } from "../services/openai";

const AISummaryCard = ({ tasks, onPrioritiesUpdated }) => {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSummarize = async () => {
    setSummaryLoading(true);
    setError(null);
    try {
      const result = await summarizeTasks(tasks);
      setSummary(result);
    } catch (err) {
      setError("Failed to get summary. Check your OpenAI API key.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSuggestPriority = async () => {
    setPriorityLoading(true);
    setError(null);
    try {
      // Get AI-annotated tasks back
      const annotatedTasks = await suggestPriorities(
        tasks.filter((t) => !t.completed)
      );
      // Bubble back up to parent so task cards can show AI badges
      onPrioritiesUpdated(annotatedTasks);
    } catch (err) {
      setError("Failed to suggest priorities. Check your OpenAI API key.");
    } finally {
      setPriorityLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiTag}>
          <Feather name="cpu" size={12} color={colors.accent} />
          <Text style={styles.aiTagText}>AI Assistant</Text>
        </View>
        <Text style={styles.title}>Smart Insights</Text>
      </View>

      {/* Summary text */}
      {summary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      ) : (
        <Text style={styles.placeholder}>
          Let AI analyze your tasks and give you a daily briefing.
        </Text>
      )}

      {/* Error message */}
      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-triangle" size={13} color={colors.high} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.btnRow}>
        {/* Summarize button */}
        <TouchableOpacity
          onPress={handleSummarize}
          style={[styles.btn, styles.btnOutline]}
          disabled={summaryLoading || priorityLoading}
        >
          {summaryLoading ? (
            <ActivityIndicator size={14} color={colors.accent} />
          ) : (
            <Feather name="message-square" size={14} color={colors.accent} />
          )}
          <Text style={styles.btnOutlineText}>
            {summaryLoading ? "Analyzing..." : "Summarize"}
          </Text>
        </TouchableOpacity>

        {/* Suggest Priority button */}
        <TouchableOpacity
          onPress={handleSuggestPriority}
          style={[styles.btn, styles.btnFilled]}
          disabled={summaryLoading || priorityLoading}
        >
          {priorityLoading ? (
            <ActivityIndicator size={14} color={colors.white} />
          ) : (
            <Feather name="zap" size={14} color={colors.white} />
          )}
          <Text style={styles.btnFilledText}>
            {priorityLoading ? "Thinking..." : "Suggest Priority"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accentGlow,
    ...shadows.accent,
  },
  header: {
    marginBottom: spacing.sm,
  },
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  aiTagText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  title: {
    ...typography.h2,
  },
  placeholder: {
    ...typography.body,
    marginBottom: spacing.md,
    fontStyle: "italic",
  },
  summaryBox: {
    backgroundColor: "rgba(108,99,255,0.08)",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  summaryText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.high,
    fontSize: 12,
    flex: 1,
  },
  btnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: 6,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  btnOutlineText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  btnFilled: {
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  btnFilledText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default AISummaryCard;
