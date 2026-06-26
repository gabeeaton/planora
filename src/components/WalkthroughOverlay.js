import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Animated, ScrollView, useWindowDimensions, DeviceEventEmitter,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import Mascot from "./Mascot";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { useWalkthroughTargets } from "../utils/WalkthroughContext";

const DARK = "rgba(0,0,0,0.76)";
const PAD  = 4;

// Step 0 is the Tally intro — no spotlight, full-screen welcome
const STEPS = [
  { key: "intro", isIntro: true },
  {
    key:   "insightStrip",
    icon:  "message-circle",
    title: "Tally's read on your week",
    desc:  "Every time you open the app, Tally scans your deadlines, grades, and patterns — then gives you a coaching note. No fluff, just what you need to hear.",
    tooltipSide: "below",
    pad: 4,
    optional: true,
  },
  {
    key:   "planCard",
    icon:  "book-open",
    title: "Today's plan",
    desc:  "Your study sessions for today — Tally scheduled these around your deadlines and free time. Tap to see the full week.",
    tooltipSide: "below",
    pad: 4,
    optional: true,
  },
  {
    key:   "todayFocus",
    icon:  "zap",
    title: "What to work on next",
    desc:  "Tally ranks your highest-priority tasks and puts them front and center so you always know where to start.",
    tooltipSide: "below",
    pad: 4,
    optional: true,
  },
  {
    key:      "priorityBadge",
    icon:     "zap",
    title:    "Priority labels",
    desc:     "Tap any badge to see why Tally ranked it High, Medium, or Low. Priority updates automatically as deadlines approach.",
    tooltipSide: "above",
    optional: true,
  },
  {
    key:   "focusTab",
    icon:  "edit-3",
    title: "Your study plan",
    desc:  "Tally maps your whole week — sessions scheduled around your deadlines and free time. Free users get 3 days, Scholar unlocks the full week.",
    tooltipSide: "above",
    pad: 6,
  },
  {
    key:   "tasksTab",
    icon:  "check-square",
    title: "All your tasks",
    desc:  "Every assignment, exam, and project in one place. Tap Add in the header to log a new one.",
    tooltipSide: "above",
    pad: 6,
  },
  {
    key:   "chatTab",
    icon:  "message-circle",
    title: "Chat with Tally",
    desc:  "Ask what to work on next, get study tips, or talk through your whole workload. Tally can even create tasks for you from the chat.",
    tooltipSide: "above",
    pad: 6,
  },
];

const CARD_MARGIN = 16;
const CARD_H      = 190;
const ARROW_H     = 11;

// ── Intro screen ──────────────────────────────────────────────────
function IntroScreen({ colors, onNext, onDismiss }) {
  const logoScale    = useRef(new Animated.Value(0.15)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide   = useRef(new Animated.Value(18)).current;
  const subOpacity   = useRef(new Animated.Value(0)).current;
  const subSlide     = useRef(new Animated.Value(14)).current;
  const pillsOpacity = useRef(new Animated.Value(0)).current;
  const pillsSlide   = useRef(new Animated.Value(10)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    // Logo bounces in
    Animated.spring(logoScale, { toValue: 1, speed: 9, bounciness: 16, useNativeDriver: true }).start();

    // Pulsing glow behind logo
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    // Staggered content reveals
    const reveal = Animated.sequence([
      Animated.delay(340),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(titleSlide,   { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
      Animated.delay(70),
      Animated.parallel([
        Animated.timing(subOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(subSlide,   { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(pillsOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(pillsSlide,   { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
      Animated.delay(60),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(btnScale,   { toValue: 1, speed: 18, bounciness: 6, useNativeDriver: true }),
      ]),
    ]);

    reveal.start();
    return () => { reveal.stop(); glowLoop.stop(); };
  }, []);

  const pressBtnIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const pressBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const handleSkip = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      "Skip tour?",
      "You can always find help in your profile settings.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Skip", style: "destructive", onPress: onDismiss },
      ]
    );
  };

  const PILLS = [
    { icon: "zap",            label: "Smart Priority" },
    { icon: "edit-3",         label: "Study Plans" },
    { icon: "message-circle", label: "Ask Tally" },
  ];

  return (
    <View style={intro.container}>
      <ScrollView
        style={intro.scroll}
        contentContainerStyle={intro.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="fast"
      >
        {/* Mascot + pulsing glow rings */}
        <Animated.View style={[intro.logoArea, { transform: [{ scale: logoScale }] }]}>
          {/* Outer soft ring */}
          <Animated.View style={[
            intro.logoGlowOuter,
            {
              backgroundColor: colors.accent + "12",
              opacity: glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.1, 0.4] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.22] }) }],
            },
          ]} />
          {/* Inner glow */}
          <Animated.View style={[
            intro.logoGlow,
            {
              backgroundColor: colors.accent + "28",
              opacity: glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.25, 0.7] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.14] }) }],
            },
          ]} />
          <Mascot variant="wave" size={130} />
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[intro.title, { color: colors.isDark ? "#fff" : colors.textPrimary, opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
          Hi, I'm Tally.
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[intro.sub, { color: colors.isDark ? "rgba(255,255,255,0.6)" : colors.textSecondary, opacity: subOpacity, transform: [{ translateY: subSlide }] }]}>
          I track your deadlines, figure out what actually matters, and coach you through the semester — so nothing sneaks up on you.
        </Animated.Text>

        {/* Feature pills */}
        <Animated.View style={[intro.pillRow, { opacity: pillsOpacity, transform: [{ translateY: pillsSlide }] }]}>
          {PILLS.map((p) => (
            <View key={p.label} style={[intro.pill, { borderColor: colors.accent + "50", backgroundColor: colors.accent + "18" }]}>
              <Feather name={p.icon} size={12} color={colors.accent} />
              <Text style={[intro.pillText, { color: colors.accent }]}>{p.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[intro.btnWrap, { opacity: btnOpacity, transform: [{ scale: btnScale }] }]}>
          <TouchableOpacity
            style={[intro.btn, { backgroundColor: colors.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onNext();
            }}
            onPressIn={pressBtnIn}
            onPressOut={pressBtnOut}
            activeOpacity={1}
          >
            <Text style={intro.btnText}>Show me around</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Skip */}
        <Animated.View style={{ opacity: btnOpacity, marginTop: 14 }}>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={[intro.skip, { color: colors.isDark ? "rgba(255,255,255,0.3)" : colors.textMuted }]}>Skip tour</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Main overlay ─────────────────────────────────────────────────

export default function WalkthroughOverlay({ onDone, fabBottom = 0, navigateToTab }) {
  const { colors }                = useTheme();
  const { width: SW, height: SH } = useWindowDimensions();
  const targets = useWalkthroughTargets();
  const [step, setStep]           = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const current = STEPS[step];
  const t = targets[current.key];
  const tOnScreen = !!(t && t.w > 0 && t.h > 0 && t.cy >= 0 && t.cy <= SH);

  const DOT_STEPS = STEPS.filter(s => !s.isIntro);
  const dotIndex  = Math.max(0, step - 1);

  const targetsRef   = useRef(targets);
  const animatedStep = useRef(-1);
  useEffect(() => { targetsRef.current = targets; }, [targets]);

  // Emit step key + reset slide
  useEffect(() => {
    if (!current.isIntro) {
      DeviceEventEmitter.emit("walkthroughStep", current.key);
    }
    slideAnim.setValue(14);
  }, [step]);

  // Skip optional steps if target not found after grace period
  useEffect(() => {
    if (!current.optional || tOnScreen) return;
    const delay = current.key === "priorityBadge" ? 300 : current.key === "todayFocus" ? 600 : current.key === "insightStrip" ? 800 : 120;
    const timer = setTimeout(() => {
      const tgt = targetsRef.current[current.key];
      const valid = tgt && tgt.w > 0 && tgt.h > 0 && tgt.cy >= 0 && tgt.cy <= SH;
      if (!valid) setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, delay);
    return () => clearTimeout(timer);
  }, [step]);

  // Animate NON-OPTIONAL steps on step change
  useEffect(() => {
    if (current.isIntro || current.optional) return;
    if (animatedStep.current === step) return;
    animatedStep.current = step;
    const delay = ["focusBtn", "statsBar", "todaySchedule"].includes(current.key) ? 500 : 0;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 5, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [step]);

  // Animate OPTIONAL steps when their target appears
  useEffect(() => {
    if (!current.optional || !tOnScreen) return;
    if (animatedStep.current === step) return;
    animatedStep.current = step;
    const delay = current.key === "priorityBadge" ? 200 : 0;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 5, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [step, tOnScreen]);

  const advance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animatedStep.current = -1;
    if (step < STEPS.length - 1) {
      if (!current.isIntro) {
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
          setStep((s) => s + 1);
        });
      } else {
        setStep((s) => s + 1);
      }
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (navigateToTab) navigateToTab("Dashboard");
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
  };

  const CARD_BG = colors.isDark ? colors.bgCard : "#fff";

  // ── Intro step ──────────────────────────────────────────────
  if (current.isIntro) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? "rgba(0,0,0,0.96)" : "#fff", zIndex: 999 }]} pointerEvents="auto">
        <IntroScreen colors={colors} onNext={advance} onDismiss={dismiss} />
      </View>
    );
  }

  // ── Shared card renderer ────────────────────────────────────
  const renderCard = (style, side, arrowLeft) => (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: CARD_BG, left: CARD_MARGIN, right: CARD_MARGIN },
        !colors.isDark && { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
        style,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="auto"
    >
      {side === "below" && (
        <View style={[styles.arrowUp, { left: arrowLeft, borderBottomColor: CARD_BG }]} />
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
          {DOT_STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, {
              backgroundColor: i === dotIndex ? colors.accent : colors.isDark ? colors.border : "#D0D0D8",
              width: i === dotIndex ? 14 : 6,
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
      {side === "above" && (
        <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: CARD_BG }]} />
      )}
    </Animated.View>
  );

  // ── No on-screen target ─────────────────────────────────────
  if (!tOnScreen) {
    if (current.optional) {
      return (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: DARK }]} pointerEvents="auto">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={advance} activeOpacity={1} />
        </Animated.View>
      );
    }
    // Non-optional, no visible target: card at bottom, no spotlight
    return (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: DARK }]} pointerEvents="none" />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={advance} activeOpacity={1} />
        {renderCard({ bottom: Math.max(110, fabBottom) }, "above", Math.max(20, SW / 2 - CARD_MARGIN - 10))}
      </Animated.View>
    );
  }

  // ── Spotlight render ────────────────────────────────────────
  const pad = current.pad ?? PAD;
  const sx = t.cx - t.w / 2 - pad;
  const sy = t.cy - t.h / 2 - pad;
  const sw = t.w + pad * 2;
  const sh = t.h + pad * 2;

  const br = Math.min((t.r ?? 12) + pad, sw / 2, sh / 2);

  const side = current.tooltipSide ?? (sy + sh / 2 < SH / 2 ? "below" : "above");
  let tooltipStyle;
  if (side === "below") {
    tooltipStyle = { top: Math.min(sy + sh + ARROW_H + 8, SH - CARD_H - CARD_MARGIN) };
  } else {
    const rawBottom = Math.min(SH - sy + ARROW_H + 8, SH - CARD_H - CARD_MARGIN);
    tooltipStyle = { bottom: Math.max(rawBottom, fabBottom) };
  }

  const arrowLeft = Math.max(20, Math.min(t.cx - CARD_MARGIN - 10, SW - CARD_MARGIN * 2 - 40));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">

      {/* Dark overlay with clean rounded cutout — single SVG path, no seam artifacts */}
      <Svg
        width={SW} height={SH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path
          fillRule="evenodd"
          fill={DARK}
          d={[
            `M 0 0 L ${SW} 0 L ${SW} ${SH} L 0 ${SH} Z`,
            `M ${sx + br} ${sy}`,
            `L ${sx + sw - br} ${sy}`,
            `Q ${sx + sw} ${sy} ${sx + sw} ${sy + br}`,
            `L ${sx + sw} ${sy + sh - br}`,
            `Q ${sx + sw} ${sy + sh} ${sx + sw - br} ${sy + sh}`,
            `L ${sx + br} ${sy + sh}`,
            `Q ${sx} ${sy + sh} ${sx} ${sy + sh - br}`,
            `L ${sx} ${sy + br}`,
            `Q ${sx} ${sy} ${sx + br} ${sy} Z`,
          ].join(" ")}
        />
      </Svg>

      {/* Accent ring — sits on top of SVG overlay */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: sx, top: sy, width: sw, height: sh,
          borderRadius: br,
          borderWidth: 2,
          borderColor: colors.accent,
        }}
      />

      {renderCard(tooltipStyle, side, arrowLeft)}
    </Animated.View>
  );
}

// ── Intro styles ─────────────────────────────────────────────────
const intro = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 48,
  },
  logoArea: {
    width: 200, height: 200,
    alignItems: "center", justifyContent: "center",
    marginBottom: 32,
  },
  logoGlowOuter: {
    position: "absolute",
    width: 260, height: 260, borderRadius: 999,
  },
  logoGlow: {
    position: "absolute",
    width: 200, height: 200, borderRadius: 999,
  },
  title: {
    fontFamily: "Outfit-ExtraBold", fontSize: 38,
    color: "#fff", textAlign: "center",
    letterSpacing: -1, marginBottom: 14, lineHeight: 44,
  },
  sub: {
    fontFamily: "Outfit-Regular", fontSize: 15,
    color: "rgba(255,255,255,0.6)", textAlign: "center",
    lineHeight: 23, marginBottom: 28, paddingHorizontal: 4,
  },
  pillRow: {
    flexDirection: "row", gap: 8, marginBottom: 40, flexWrap: "wrap", justifyContent: "center",
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  pillText: { fontFamily: "Outfit-SemiBold", fontSize: 13 },
  btnWrap: { width: "100%" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 17,
    borderRadius: 18, width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  btnText: { fontFamily: "Outfit-Bold", fontSize: 17, color: "#fff" },
  skip: {
    fontFamily: "Outfit-Medium", fontSize: 13,
    color: "rgba(255,255,255,0.3)", textAlign: "center",
  },
});

// ── Spotlight card styles ─────────────────────────────────────────
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
