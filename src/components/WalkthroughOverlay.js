import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { useWalkthroughTargets } from "../utils/WalkthroughContext";

const DARK = "rgba(0,0,0,0.74)";
const PAD  = 8; // spotlight padding around element

const STEPS = [
  {
    key:   "plus",
    icon:  "plus-circle",
    title: "Add your tasks",
    desc:  "Tap + to log any assignment, exam, reading, or project with a due date.",
    tooltipSide: "above",
  },
  {
    key:   "studyPlan",
    icon:  "edit-3",
    title: "AI Study Plan",
    desc:  "Tap the pencil to let AI build your week around your deadlines — day by day.",
    tooltipSide: "below",
  },
  {
    key:   "calendar",
    icon:  "calendar",
    title: "Calendar view",
    desc:  "Toggle a weekly calendar to see all your tasks laid out by due date.",
    tooltipSide: "below",
  },
  {
    key:   "syllabusImport",
    icon:  "upload-cloud",
    title: "Import from syllabus",
    desc:  "Upload a syllabus PDF and AI will pull out every deadline automatically.",
    tooltipSide: "below",
  },
  {
    key:   "chatTab",
    icon:  "message-circle",
    title: "Your AI coach",
    desc:  "Tap Coach to ask what to work on next, get study tips, or talk through your workload.",
    tooltipSide: "above",
  },
  {
    key:   "statsTab",
    icon:  "bar-chart-2",
    title: "Track your progress",
    desc:  "See your completion rate, streaks, and study patterns — all in one place.",
    tooltipSide: "above",
  },
  {
    key:   "profileTab",
    icon:  "user",
    title: "Profile & settings",
    desc:  "Set your classes, customize your theme, and manage your account here.",
    tooltipSide: "above",
  },
];

export default function WalkthroughOverlay({ onDone }) {
  const { colors }                = useTheme();
  const { width: SW, height: SH } = useWindowDimensions();
  const { targets }               = useWalkthroughTargets();
  const [step, setStep]           = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const current = STEPS[step];
  const t = targets[current.key];

  useEffect(() => {
    slideAnim.setValue(14);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 5, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
  };

  if (!t) {
    // Target not measured yet — render minimal overlay so it doesn't flash
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: DARK }]} pointerEvents="auto">
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={advance} activeOpacity={1} />
      </Animated.View>
    );
  }

  // Spotlight bounds
  const sx = t.cx - t.w / 2 - PAD;
  const sy = t.cy - t.h / 2 - PAD;
  const sw = t.w + PAD * 2;
  const sh = t.h + PAD * 2;

  // Tooltip position
  const CARD_MARGIN = 16;
  const ARROW_H = 11;
  const tooltipStyle = current.tooltipSide === "above"
    ? { bottom: SH - sy + ARROW_H + 8 }
    : { top: sy + sh + ARROW_H + 8 };

  // Arrow horizontal offset — clamp to card width so it doesn't overflow
  const arrowLeft = Math.max(20, Math.min(t.cx - CARD_MARGIN - 10, SW - CARD_MARGIN * 2 - 40));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">

      {/* ── 4-rect cutout overlay ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: sy, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, right: 0, top: sy + sh, bottom: 0, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, width: Math.max(0, sx), top: sy, height: sh, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: sx + sw, right: 0, top: sy, height: sh, backgroundColor: DARK }} />

        {/* Accent ring */}
        <View style={{
          position: "absolute",
          left: sx, top: sy, width: sw, height: sh,
          borderRadius: (t.r ?? 12) + PAD,
          borderWidth: 2.5,
          borderColor: colors.accent,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 10,
        }} />
      </View>

      {/* ── Tooltip card ── */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.bgCard, left: CARD_MARGIN, right: CARD_MARGIN },
          tooltipStyle,
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="auto"
      >
        {/* Arrow up — card is below target */}
        {current.tooltipSide === "below" && (
          <View style={[styles.arrowUp, { left: arrowLeft, borderBottomColor: colors.bgCard }]} />
        )}

        <View style={styles.cardInner}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accentGlow }]}>
            <Feather name={current.icon} size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
            <Text style={[styles.desc,  { color: colors.textSecondary }]}>{current.desc}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, {
                backgroundColor: i === step ? colors.accent : colors.border,
                width: i === step ? 14 : 6,
              }]} />
            ))}
          </View>
          <View style={styles.btns}>
            <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.accent }]} onPress={advance}>
              <Text style={styles.nextBtnText}>
                {step === STEPS.length - 1 ? "Got it!" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Arrow down — card is above target */}
        {current.tooltipSide === "above" && (
          <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: colors.bgCard }]} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 18,
  },
  cardInner: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 14, padding: 20, paddingBottom: 12,
  },
  iconBadge: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  title: { fontSize: 16, fontFamily: "Outfit-ExtraBold", marginBottom: 4 },
  desc:  { fontSize: 13, fontFamily: "Outfit-Regular", lineHeight: 19 },
  footer: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot:  { height: 6, borderRadius: 3 },
  btns: { flexDirection: "row", alignItems: "center", gap: 14 },
  skipText: { fontSize: 13, fontFamily: "Outfit-Medium" },
  nextBtn:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  nextBtnText: { fontSize: 14, fontFamily: "Outfit-Bold", color: "#fff" },
  arrowUp: {
    position: "absolute", top: -11,
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 11,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  arrowDown: {
    position: "absolute", bottom: -11,
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 11,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
});
