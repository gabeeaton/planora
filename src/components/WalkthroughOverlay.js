import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert,
  Animated, ScrollView, useWindowDimensions, DeviceEventEmitter,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { useWalkthroughTargets } from "../utils/WalkthroughContext";

const DARK = "rgba(0,0,0,0.76)";
const PAD  = 4;

// Step 0 is the Ace intro — no spotlight, full-screen welcome
const STEPS = [
  { key: "intro", isIntro: true },
  {
    key:   "insightStrip",
    icon:  "cpu",
    title: "Ace's read on your week",
    desc:  "Every time you open the app, Ace scans your deadlines, grades, and patterns — then gives you a coaching note. No fluff, just what you need to hear.",
    tooltipSide: "below",
    pad: 4,
  },
  {
    key:   "statsBar",
    icon:  "activity",
    title: "Your day at a glance",
    desc:  "See how many tasks are due today, how many are pending, and how many you've completed this semester.",
    tooltipSide: "below",
    pad: 4,
  },
  {
    key:   "todayFocus",
    icon:  "zap",
    title: "What to work on next",
    desc:  "Ace ranks your highest-priority task and puts it front and center. Tap Start to jump in, or swipe to move on.",
    tooltipSide: "below",
    pad: 4,
    optional: true,
  },
  {
    key:   "todaySchedule",
    icon:  "calendar",
    title: "Today's schedule",
    desc:  "Your classes and calendar events for today, shown in order. Add recurring class times in Profile → Class Schedule.",
    tooltipSide: "below",
    pad: 4,
    optional: true,
  },
  {
    key:      "aceBtn",
    icon:     "message-circle",
    title:    "Meet Ace",
    desc:     "Tap the Ace button anytime to ask what to work on, get study advice, or talk through your workload.",
    tooltipSide: "above",
    optional: true,
    pad: 6,
  },
  {
    key:      "priorityBadge",
    icon:     "zap",
    title:    "Priority labels",
    desc:     "Tap any badge to see why Ace ranked it High, Medium, or Low. Priority updates automatically as deadlines approach.",
    tooltipSide: "above",
    optional: true,
  },
  {
    key:      "focusBtn",
    icon:     "clock",
    title:    "Focus Mode",
    desc:     "Tap the clock on any task to start a full-screen Pomodoro timer — just you and the assignment.",
    tooltipSide: "above",
    optional: true,
  },
  {
    key:   "tasksTab",
    icon:  "check-square",
    title: "All your tasks",
    desc:  "Every assignment, exam, and project in one place. Tap Add in the header to log a new one.",
    tooltipSide: "above",
  },
  {
    key:   "chatTab",
    icon:  "message-circle",
    title: "Chat with Ace",
    desc:  "Have a full conversation — ask what to work on next, get study tips, or talk through your entire workload.",
    tooltipSide: "above",
  },
  {
    key:   "calendarTab",
    icon:  "calendar",
    title: "Your schedule",
    desc:  "See your calendar events alongside your deadlines. Tap Plan to let Ace build your study week.",
    tooltipSide: "above",
  },
  {
    key:   "focusTab",
    icon:  "clock",
    title: "Focus sessions",
    desc:  "Start a study session from here. Pick a task, set a timer, and work distraction-free until it's done.",
    tooltipSide: "above",
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
    { icon: "message-circle", label: "Ask Ace" },
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
        {/* Logo + pulsing glow */}
        <Animated.View style={[intro.logoArea, { transform: [{ scale: logoScale }] }]}>
          <Animated.View style={[
            intro.logoGlow,
            {
              backgroundColor: colors.accent + "30",
              opacity: glowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0.5] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.18] }) }],
            },
          ]} />
          <View style={[intro.logoWrap, {
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: colors.accent + "45",
          }]}>
            <Image source={require("../assets/logo.png")} style={intro.logo} resizeMode="contain" />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[intro.title, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
          Hi, I'm Ace.
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[intro.sub, { opacity: subOpacity, transform: [{ translateY: subSlide }] }]}>
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
            <Text style={intro.skip}>Skip tour</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Main overlay ─────────────────────────────────────────────────
export default function WalkthroughOverlay({ onDone }) {
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
    const delay = current.key === "priorityBadge" ? 300 : current.key === "todayFocus" ? 600 : 120;
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
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
  };

  // ── Intro step ──────────────────────────────────────────────
  if (current.isIntro) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.94)" }]} pointerEvents="auto">
        <IntroScreen colors={colors} onNext={advance} onDismiss={dismiss} />
      </View>
    );
  }

  // ── Shared card renderer ────────────────────────────────────
  const renderCard = (style, side, arrowLeft) => (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.bgCard, left: CARD_MARGIN, right: CARD_MARGIN },
        style,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="auto"
    >
      {side === "below" && (
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
          {DOT_STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, {
              backgroundColor: i === dotIndex ? colors.accent : colors.border,
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
        <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: colors.bgCard }]} />
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
        {renderCard({ bottom: 60 }, "above", Math.max(20, SW / 2 - CARD_MARGIN - 10))}
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
    tooltipStyle = { bottom: Math.min(SH - sy + ARROW_H + 8, SH - CARD_H - CARD_MARGIN) };
  }

  const arrowLeft = Math.max(20, Math.min(t.cx - CARD_MARGIN - 10, SW - CARD_MARGIN * 2 - 40));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">

      {/* Dark overlay — 4 strips create a clean rectangular cutout, no corner artifacts */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: sy, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, right: 0, top: sy + sh, bottom: 0, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: 0, width: Math.max(0, sx), top: sy, height: sh, backgroundColor: DARK }} />
        <View style={{ position: "absolute", left: sx + sw, right: 0, top: sy, height: sh, backgroundColor: DARK }} />

        {/* Accent ring around spotlight */}
        <View style={{
          position: "absolute",
          left: sx, top: sy, width: sw, height: sh,
          borderRadius: br,
          borderWidth: 2,
          borderColor: colors.accent,
        }} />
      </View>

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
    width: 150, height: 150,
    alignItems: "center", justifyContent: "center",
    marginBottom: 36,
  },
  logoGlow: {
    position: "absolute",
    width: 172, height: 172, borderRadius: 46,
    top: -11, left: -11,
  },
  logoWrap: {
    width: 148, height: 148, borderRadius: 38,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  logo: { width: 120, height: 120 },
  title: {
    fontFamily: "Outfit-ExtraBold", fontSize: 36,
    color: "#fff", textAlign: "center",
    letterSpacing: -0.8, marginBottom: 12, lineHeight: 42,
  },
  sub: {
    fontFamily: "Outfit-Regular", fontSize: 14,
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    lineHeight: 21, marginBottom: 22, paddingHorizontal: 4,
  },
  pillRow: {
    flexDirection: "row", gap: 8, marginBottom: 36, flexWrap: "wrap", justifyContent: "center",
  },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  pillText: { fontFamily: "Outfit-SemiBold", fontSize: 12 },
  btnWrap: { width: "100%" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 16, width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  btnText: { fontFamily: "Outfit-Bold", fontSize: 16, color: "#fff" },
  skip: {
    fontFamily: "Outfit-Medium", fontSize: 13,
    color: "rgba(255,255,255,0.35)", textAlign: "center",
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
