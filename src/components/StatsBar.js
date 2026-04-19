import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const StatNumber = ({ value, color }) => {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(new Animated.Value(0));
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (value > 0 && !hasAnimated.current) {
      hasAnimated.current = true;
      const anim = animRef.current;
      anim.removeAllListeners();
      anim.setValue(0);
      anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
      Animated.timing(anim, {
        toValue: value,
        duration: 550,
        useNativeDriver: false,
      }).start(() => anim.removeAllListeners());
    } else if (!hasAnimated.current) {
      setDisplay(value);
    }
  }, [value]);

  return (
    <Text style={{ fontFamily: "Outfit-ExtraBold", fontSize: 22, letterSpacing: -0.5, color }}>
      {display}
    </Text>
  );
};

const StatsBar = ({ todayCount, pendingCount, completedCount }) => {
  const { colors } = useTheme();

  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountTranslY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(mountTranslY, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
          borderColor: colors.isDark ? colors.border : "transparent",
          opacity: mountOpacity,
          transform: [{ translateY: mountTranslY }],
          ...(colors.isDark
            ? {}
            : {
                shadowColor: "#6B6B8A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 5,
              }),
        },
      ]}
    >
      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.medium + "18" }]}>
          <Feather name="sun" size={16} color={colors.medium} />
        </View>
        <StatNumber value={todayCount} color={todayCount > 0 ? colors.medium : colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Today</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + "18" }]}>
          <Feather name="clock" size={16} color={colors.accent} />
        </View>
        <StatNumber value={pendingCount} color={pendingCount > 0 ? colors.accent : colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Pending</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.stat}>
        <View style={[styles.iconWrap, { backgroundColor: colors.low + "18" }]}>
          <Feather name="check-circle" size={16} color={colors.low} />
        </View>
        <StatNumber value={completedCount} color={completedCount > 0 ? colors.low : colors.textPrimary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Done</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-around",
  },
  stat:     { alignItems: "center", flex: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  label:    { fontFamily: "Outfit-Medium", fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  divider:  { width: 1, height: 40 },
});

export default StatsBar;
