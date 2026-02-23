// ============================================================
// src/screens/FocusModeScreen.js  (Pro feature)
// Full-screen Pomodoro. Long-press any task card to enter.
// navigation.navigate("FocusMode", { task })
//
// FIXES:
//  - useSafeAreaInsets for topBar so X is below Dynamic Island
//  - task dates deserialized from ISO strings (navigation serialization)
//  - stale closure bug on brk in interval fixed with ref
//  - completion overlay has safe area padding + escape hatch
//  - keep-awake while timer is running
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Alert, ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";

const WORK    = 25 * 60;
const BREAK_S =  5 * 60;
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Rehydrate a task that came through navigation params (dates are ISO strings)
const deserializeTask = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    createdAt:     raw.createdAt     ? new Date(raw.createdAt)     : null,
    dueDate:       raw.dueDate       ? new Date(raw.dueDate)       : null,
    completedAt:   raw.completedAt   ? new Date(raw.completedAt)   : null,
    lastTouchedAt: raw.lastTouchedAt ? new Date(raw.lastTouchedAt) : null,
  };
};

export default function FocusModeScreen({ route, navigation }) {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const { completeTask } = useTasks();

  // Rehydrate dates — navigation params are JSON-serialized
  const task = deserializeTask(route.params?.task ?? null);

  const [secs, setSecs]     = useState(WORK);
  const [on, setOn]         = useState(false);
  const [n, setN]           = useState(0);
  const [brk, setBrk]       = useState(false);
  const [done, setDone]     = useState(false);
  const [marked, setMarked] = useState(false);

  const pulse  = useRef(new Animated.Value(1)).current;
  const iv     = useRef(null);
  // Use a ref for brk so the interval closure always sees current value
  const brkRef = useRef(brk);
  useEffect(() => { brkRef.current = brk; }, [brk]);

  // Timer + pulse animation
  useEffect(() => {
    if (on) {
      // Pulse ring while running
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0,  duration: 1500, useNativeDriver: true }),
        ])
      ).start();

      iv.current = setInterval(() => {
        setSecs((v) => {
          if (v <= 1) {
            clearInterval(iv.current);
            setOn(false);
            if (!brkRef.current) {
              setN((x) => x + 1);
              setDone(true);
            } else {
              setBrk(false);
              setSecs(WORK);
            }
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } else {
      clearInterval(iv.current);
      pulse.stopAnimation();
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => clearInterval(iv.current);
  }, [on]);

  const markDone = async () => {
    if (marked) return;
    setMarked(true);
    try { if (task) await completeTask(task); } catch {}
    navigation.goBack();
  };

  const leave = () => {
    if (on) {
      Alert.alert("Leave Focus Mode?", "Your timer will stop.", [
        { text: "Keep Going", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const reset = () => {
    setOn(false);
    setSecs(brk ? BREAK_S : WORK);
  };

  const startBreak = () => {
    setDone(false);
    setBrk(true);
    setSecs(BREAK_S);
    setOn(true);
  };

  const startAnother = () => {
    setDone(false);
    setBrk(false);
    setSecs(WORK);
  };

  const ac = brk ? "#5CFF8F" : colors.accent;

  // topBar sits below the Dynamic Island / status bar using insets
  const topBarStyle = {
    paddingTop: insets.top + 12,
    paddingBottom: 12,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const s = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.bg },
    center:  {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      // Push content below topBar height (inset + 12 + ~36 icon + 12)
      paddingTop: insets.top + 70,
      paddingBottom: insets.bottom + spacing.lg,
    },
    ring:    {
      width: 240, height: 240, borderRadius: 120,
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.xl, borderWidth: 3,
    },
    inner:   {
      width: 220, height: 220, borderRadius: 110,
      backgroundColor: colors.bgCard,
      alignItems: "center", justifyContent: "center",
    },
    time:    { fontSize: 56, fontWeight: "800", letterSpacing: -2 },
    timeLbl: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginTop: 2, color: colors.textMuted },
    meta:    { fontSize: 12, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
    title:   { fontSize: 22, fontWeight: "800", color: colors.textPrimary, textAlign: "center", lineHeight: 30, marginBottom: spacing.xl },
    btnRow:  { flexDirection: "row", gap: spacing.md, alignItems: "center" },
    mainBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    mainOff: { backgroundColor: colors.bgCard, borderWidth: 2, borderColor: colors.accent },
    sideBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bgCard, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border },
    dots:    { flexDirection: "row", gap: 8, marginTop: spacing.lg },
    dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotOn:   { backgroundColor: colors.accent },
    badge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.accent },
    badgeTxt: { fontSize: 11, fontWeight: "700", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.bgCard,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    spacer:  { width: 36 },

    // Completion overlay — scrollable so it works on small phones too
    over: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
    },
    overScroll: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: insets.top + 60,
      paddingBottom: insets.bottom + spacing.xl,
    },
    overIcon: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: "rgba(92,255,143,0.15)",
      borderWidth: 2, borderColor: "#5CFF8F",
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.lg,
    },
    overH:   { fontSize: 28, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm, textAlign: "center" },
    overSub: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl, lineHeight: 22 },
    bigBtn:  {
      width: "100%", backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8, marginBottom: 12,
    },
    bigBtnT:  { color: "#fff", fontWeight: "700", fontSize: 16 },
    skipBtn:  { paddingVertical: 8 },
    skipT:    { fontSize: 13, color: colors.textMuted },
    // Escape hatch in top-left of overlay
    overClose: {
      position: "absolute",
      top: insets.top + 12,
      left: spacing.lg,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.bgCard,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={["left", "right", "bottom"]}>
      {/* Top bar — manually positioned below Dynamic Island via insets */}
      <View style={topBarStyle}>
        <TouchableOpacity onPress={leave} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={s.badge}>
          <Feather name="zap" size={11} color={colors.accent} />
          <Text style={s.badgeTxt}>{brk ? "Break Time" : "Focus Mode"}</Text>
        </View>
        <View style={s.spacer} />
      </View>

      {/* Main timer area */}
      <View style={s.center}>
        <Animated.View style={[s.ring, { borderColor: ac + "55", transform: [{ scale: pulse }] }]}>
          <View style={s.inner}>
            <Text style={[s.time, { color: on ? colors.textPrimary : colors.textSecondary }]}>
              {fmt(secs)}
            </Text>
            <Text style={s.timeLbl}>
              {on ? (brk ? "BREAK" : "FOCUS") : "PAUSED"}
            </Text>
          </View>
        </Animated.View>

        {!brk && task && (
          <>
            <Text style={s.meta}>Working on</Text>
            <Text style={s.title} numberOfLines={3}>{task.title}</Text>
          </>
        )}
        {brk && (
          <Text style={[s.meta, { marginBottom: spacing.md }]}>Step away from the screen</Text>
        )}

        <View style={s.btnRow}>
          <TouchableOpacity
            style={s.sideBtn}
            onPress={reset}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="rotate-ccw" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.mainBtn, !on && s.mainOff]}
            onPress={() => setOn((x) => !x)}
          >
            <Feather name={on ? "pause" : "play"} size={28} color={on ? "#fff" : colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.sideBtn}
            onPress={task && !brk ? markDone : leave}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={task && !brk ? "check" : "log-out"}
              size={20}
              color={task && !brk ? "#5CFF8F" : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Pomodoro session dots */}
        <View style={s.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[s.dot, i < n && s.dotOn]} />
          ))}
        </View>
      </View>

      {/* Session complete overlay */}
      {done && (
        <View style={s.over}>
          {/* Always-accessible close button in overlay */}
          <TouchableOpacity style={s.overClose} onPress={leave}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={s.overScroll} showsVerticalScrollIndicator={false}>
            <View style={s.overIcon}>
              <Feather name="check-circle" size={40} color="#5CFF8F" />
            </View>
            <Text style={s.overH}>Session complete!</Text>
            <Text style={s.overSub}>
              {n} Pomodoro{n !== 1 ? "s" : ""} done.{"\n"}Time to recharge.
            </Text>

            {task && (
              <TouchableOpacity style={s.bigBtn} onPress={markDone}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={s.bigBtnT}>Mark Task Done & Leave</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.bigBtn} onPress={startBreak}>
              <Feather name="coffee" size={18} color="#fff" />
              <Text style={s.bigBtnT}>Take a 5-Minute Break</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.skipBtn} onPress={startAnother}>
              <Text style={s.skipT}>Skip break — start another session</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}