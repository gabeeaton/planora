// ============================================================
// src/components/SkeletonLoader.js
// Animated shimmer skeleton for loading states
// ============================================================

import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useTheme } from "../utils/ThemeContext";
import { radius, spacing } from "../utils/theme";

const SkeletonBlock = ({ width, height, style }) => {
  const { colors } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  const base = colors.isDark ? colors.bgElevated : "#E8E8EE";

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: base,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ── Task card skeleton ────────────────────────────────────────
export const TaskCardSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
        borderLeftColor: colors.isDark ? colors.border : "#E8E8EE",
        ...(colors.isDark ? {} : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 3,
        }),
      }
    ]}>
      <View style={styles.row}>
        <SkeletonBlock width={26} height={26} style={{ borderRadius: 13, marginRight: spacing.sm, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="75%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="40%" height={10} style={{ marginBottom: 12 }} />
          <View style={styles.footer}>
            <SkeletonBlock width={80} height={10} />
            <SkeletonBlock width={60} height={10} />
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Stats bar skeleton ────────────────────────────────────────
export const StatsBarSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={[
      styles.statsBar,
      {
        backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
        ...(colors.isDark ? {} : {
          shadowColor: "#6B6B8A",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }),
      }
    ]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.statItem}>
          <SkeletonBlock width={36} height={36} style={{ borderRadius: 10, marginBottom: 6 }} />
          <SkeletonBlock width={28} height={20} style={{ marginBottom: 4 }} />
          <SkeletonBlock width={40} height={10} />
        </View>
      ))}
    </View>
  );
};

// ── Dashboard skeleton (full loading state) ───────────────────
export const DashboardSkeleton = () => (
  <View style={{ paddingHorizontal: spacing.lg }}>
    <View style={{ height: spacing.md }} />
    <StatsBarSkeleton />
    <View style={{ height: spacing.md }} />
    {[0, 1, 2, 3].map((i) => <TaskCardSkeleton key={i} />)}
  </View>
);

// ── Task list skeleton (tab switch) ───────────────────────────
export const TaskListSkeleton = () => (
  <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
    {[0, 1, 2, 3].map((i) => <TaskCardSkeleton key={i} />)}
  </View>
);

// ── Calendar skeleton (week view) ─────────────────────────────
export const CalendarSkeleton = () => {
  const { colors } = useTheme();
  const base = colors.isDark ? colors.bgElevated : "#E8E8EE";
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      {/* Nav row */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SkeletonBlock width={28} height={28} style={{ borderRadius: 8 }} />
        <SkeletonBlock width={100} height={14} />
        <SkeletonBlock width={28} height={28} style={{ borderRadius: 8 }} />
      </View>
      {/* Grid */}
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        {/* Day name row */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {[0,1,2,3,4,5,6].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
              <SkeletonBlock width={16} height={10} />
            </View>
          ))}
        </View>
        {/* Date row */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {[0,1,2,3,4,5,6].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
              <SkeletonBlock width={28} height={28} style={{ borderRadius: 14 }} />
            </View>
          ))}
        </View>
        {/* Pill rows */}
        <View style={{ flexDirection: "row", minHeight: 80, paddingVertical: 6 }}>
          {[0,1,2,3,4,5,6].map((i) => (
            <View key={i} style={{ flex: 1, paddingHorizontal: 3, gap: 3 }}>
              {i % 3 !== 2 && <SkeletonBlock width="100%" height={18} style={{ borderRadius: 4 }} />}
              {i % 2 === 0 && <SkeletonBlock width="100%" height={18} style={{ borderRadius: 4 }} />}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  footer: { flexDirection: "row", justifyContent: "space-between" },
  statsBar: {
    flexDirection: "row",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", flex: 1 },
});
