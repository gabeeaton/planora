import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";

// Must match AppNavigator tabStyles
const TAB_PAD_H   = 16;
const TAB_PAD_TOP = 10;
const ICON_H      = 36;
const LABEL_H     = 16; // label + gap
const TAB_BODY_H  = TAB_PAD_TOP + ICON_H + LABEL_H; // ~62

const DARK = "rgba(0,0,0,0.74)";

export default function WalkthroughOverlay({ onDone }) {
  const { colors }                  = useTheme();
  const { width: SW, height: SH }   = useWindowDimensions();
  const insets                      = useSafeAreaInsets();
  const [step, setStep]             = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const TAB_BOT = Math.max(insets.bottom, 8);
  const TAB_H   = TAB_BODY_H + TAB_BOT;          // total tab bar height
  const TAB_TOP = SH - TAB_H;                     // y where tab bar starts
  const ITEM_W  = (SW - TAB_PAD_H * 2) / 5;      // width of each tab item

  // Center coords and size of each spotlight target
  const targets = {
    plus: {
      cx: SW / 2,
      cy: TAB_TOP + TAB_PAD_TOP + ICON_H / 2,
      w: 44, h: 40, r: 12,
    },
    studyPlan: {
      // edit-3 is leftmost of 3 header icon buttons (36×36, gap 8, paddingH 24)
      cx: SW - 24 - 18 - 44 - 44,   // ~SW-130 on most phones
      cy: insets.top + 16 + 18,
      w: 36, h: 36, r: 18,
    },
    chat: {
      // Chat = 4th item in 5-item tab bar (Dashboard|Stats|+|Chat|Profile)
      cx: TAB_PAD_H + 3.5 * ITEM_W,
      cy: TAB_TOP + TAB_PAD_TOP + ICON_H / 2,
      w: 44, h: 40, r: 12,
    },
  };

  const STEPS = [
    {
      key: "plus",
      icon: "plus-circle",
      title: "Start by adding tasks",
      desc: "Tap + to log any assignment, exam, or reading with a due date.",
      tooltipPos: "bottom",   // card floats above tab bar
      arrowX: SW / 2,         // arrow aligns with + button
    },
    {
      key: "studyPlan",
      icon: "edit-3",
      title: "Build your study plan",
      desc: "Tap the pencil icon (top right) — AI schedules your week around your deadlines.",
      tooltipPos: "top",      // card floats below header
      arrowX: null,           // target is too far right; rely on spotlight ring
    },
    {
      key: "chat",
      icon: "message-circle",
      title: "Meet your AI coach",
      desc: "Tap Coach anytime to get advice — what to prioritize, how to study smarter.",
      tooltipPos: "bottom",
      arrowX: TAB_PAD_H + 3.5 * ITEM_W,
    },
  ];

  const current = STEPS[step];
  const t = targets[current.key];

  // Spotlight bounds (with padding)
  const PAD = 7;
  const sx = t.cx - t.w / 2 - PAD;
  const sy = t.cy - t.h / 2 - PAD;
  const sw = t.w + PAD * 2;
  const sh = t.h + PAD * 2;

  useEffect(() => {
    slideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 5, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
  };

  const tooltipStyle = current.tooltipPos === "bottom"
    ? { bottom: TAB_H + 20 }
    : { top: insets.top + 80 };

  // Arrow horizontal offset relative to card left edge (x=20)
  const arrowLeft = current.arrowX != null
    ? Math.max(24, Math.min(current.arrowX - 20 - 10, SW - 64))
    : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">

      {/* ── 4-rect cutout overlay ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: sy,        backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, right: 0, top: sy + sh, bottom: 0,   backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, width: sx, top: sy, height: sh,       backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: sx + sw, right: 0, top: sy, height: sh,  backgroundColor: DARK }} />

        {/* Accent ring around spotlight */}
        <View style={{
          position: "absolute",
          left: sx, top: sy, width: sw, height: sh,
          borderRadius: t.r + PAD,
          borderWidth: 2.5,
          borderColor: colors.accent,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
        }} />
      </View>

      {/* ── Tooltip card ── */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.bgCard, ...tooltipStyle },
          { transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="auto"
      >
        {/* Arrow pointing up (card is below target) */}
        {current.tooltipPos === "top" && arrowLeft != null && (
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
              <View key={i} style={[styles.dot, { backgroundColor: i === step ? colors.accent : colors.border }]} />
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

        {/* Arrow pointing down (card is above target) */}
        {current.tooltipPos === "bottom" && arrowLeft != null && (
          <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: colors.bgCard }]} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 20, right: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 18,
  },
  cardInner: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 14, padding: 20, paddingBottom: 12,
  },
  iconBadge: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 16, fontFamily: "Outfit-ExtraBold", marginBottom: 4 },
  desc:  { fontSize: 13, fontFamily: "Outfit-Regular", lineHeight: 19 },
  footer: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot:  { width: 6, height: 6, borderRadius: 3 },
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
