// ============================================================
// components/AIActionsCard.js
// Simplified from AISummaryCard:
//   - REMOVED: Summarize button (replaced by TodayFocusCard)
//   - KEPT: Suggest Priority (genuinely useful)
//   - Renamed to AIActionsCard to reflect new purpose
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { typography, spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { suggestPriorities } from "../services/openai";

const makeStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  left: { flex: 1 },
  label: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2,
  },
  desc: {
    fontSize: 12, color: colors.textSecondary, lineHeight: 16,
  },
  btn: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: radius.md, gap: 6,
    backgroundColor: colors.accent,
    ...shadows.accent,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: spacing.sm,
  },
  errorText: { color: colors.high, fontSize: 12, flex: 1 },
});

const AIActionsCard = ({ tasks, patterns, onPrioritiesUpdated }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSuggestPriority = async () => {
    setLoading(true);
    setError(null);
    try {
      const pending        = tasks.filter((t) => !t.completed);
      const annotatedTasks = await suggestPriorities(pending, patterns);
      onPrioritiesUpdated(annotatedTasks);
    } catch (err) {
      setError("Failed to suggest priorities. Check your OpenAI API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.label}>AI Priority</Text>
          <Text style={styles.desc}>
            Rank all your tasks by urgency, deadlines, and your patterns.
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSuggestPriority}
          style={[styles.btn, loading && styles.btnDisabled]}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size={14} color="#fff" />
            : <Feather name="zap" size={14} color="#fff" />
          }
          <Text style={styles.btnText}>{loading ? "Thinking..." : "Prioritize"}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-triangle" size={13} color={colors.high} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default AIActionsCard;