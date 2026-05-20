// ============================================================
// src/screens/FocusModeScreen.js
// Full-screen Pomodoro. Tap the play button on any task card to enter.
// navigation.navigate("FocusMode", { task })
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Alert, ScrollView, Linking, Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";

const BREAK_S     =  5 * 60;
const DUR_OPTIONS = [15, 25, 45, 60]; // minutes

const MUSIC_APPS = [
  {
    key: "spotify",
    label: "Spotify",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6",
    appUrl: "spotify:playlist:37i9dQZF1DX8NTLI2TtZa6",
    logo: require("../assets/spotify-logo.png"),
  },
  {
    key: "apple",
    label: "Apple Music",
    url: "https://music.apple.com/us/playlist/pl.f4d106fed2bd41149fffb86d56414c07",
    appUrl: "music://",
    logo: require("../assets/apple-music-logo.jpg"),
  },
];
const openMusicApp = (app) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  Linking.canOpenURL(app.appUrl)
    .then((can) => Linking.openURL(can ? app.appUrl : app.url))
    .catch(() => Linking.openURL(app.url).catch(() => {}));
};
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  const task = deserializeTask(route.params?.task ?? null);

  const [durMin, setDurMin] = useState(25);
  const [secs, setSecs]     = useState(25 * 60);
  const [on, setOn]         = useState(false);
  const [n, setN]           = useState(0);
  const [brk, setBrk]       = useState(false);
  const [done, setDone]     = useState(false);
  const [marked, setMarked] = useState(false);

  useKeepAwake();

  // Timer pulse
  const pulse     = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(null);
  const iv        = useRef(null);
  const mounted   = useRef(true);
  const brkRef    = useRef(brk);
  useEffect(() => { brkRef.current = brk; }, [brk]);
  const durMinRef = useRef(durMin);
  useEffect(() => { durMinRef.current = durMin; }, [durMin]);

  // Button scale springs
  const playScale  = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(1)).current;
  const resetScale = useRef(new Animated.Value(1)).current;

  // Completion overlay
  const overFade   = useRef(new Animated.Value(0)).current;
  const overSlide  = useRef(new Animated.Value(40)).current;
  const iconBounce = useRef(new Animated.Value(0.5)).current;

  // Pomodoro dot bounces
  const dotAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    return () => {
      mounted.current = false;
      clearInterval(iv.current);
      pulseAnim.current?.stop();
    };
  }, []);

  // Timer + pulse
  useEffect(() => {
    if (on) {
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.04, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0,  duration: 1500, useNativeDriver: true }),
        ])
      );
      pulseAnim.current.start();

      iv.current = setInterval(() => {
        if (!mounted.current) return;
        setSecs((v) => {
          if (v <= 1) {
            clearInterval(iv.current);
            if (!mounted.current) return 0;
            setOn(false);
            if (!brkRef.current) {
              setN((x) => x + 1);
              setDone(true);
            } else {
              setBrk(false);
              setSecs(durMinRef.current * 60);
            }
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } else {
      clearInterval(iv.current);
      pulseAnim.current?.stop();
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true }).start();
    }
    return () => clearInterval(iv.current);
  }, [on]);

  // Animate completion overlay in + haptic
  useEffect(() => {
    if (!done) return;
    overFade.setValue(0);
    overSlide.setValue(40);
    iconBounce.setValue(0.4);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.timing(overFade,  { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(overSlide, { toValue: 0, speed: 20, bounciness: 5, useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(iconBounce, { toValue: 1, speed: 12, bounciness: 14, useNativeDriver: true }).start();
    });
  }, [done]);

  // Dot bounce when a pomodoro completes
  useEffect(() => {
    const idx = n - 1;
    if (idx < 0 || idx > 3) return;
    dotAnims[idx].setValue(0.3);
    Animated.spring(dotAnims[idx], { toValue: 1, speed: 12, bounciness: 14, useNativeDriver: true }).start();
  }, [n]);

  // Button press handlers
  const onPlayIn  = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(playScale, { toValue: 0.92, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  };
  const onPlayOut = () => Animated.spring(playScale,  { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const onCheckIn  = () => Animated.spring(checkScale, { toValue: 0.90, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onCheckOut = () => Animated.spring(checkScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const onResetIn  = () => Animated.spring(resetScale, { toValue: 0.90, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onResetOut = () => Animated.spring(resetScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const markDone = async () => {
    if (marked) return;
    setMarked(true);
    try { if (task) await completeTask(task); } catch {}
    if (mounted.current) navigation.goBack();
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
    setSecs(brk ? BREAK_S : durMin * 60);
  };

  const startAnother = () => {
    setDone(false);
    setBrk(false);
    setSecs(durMin * 60);
  };

  const changeDur = (d) => {
    if (on || n > 0) return; // can't change while running or after first session
    Haptics.selectionAsync().catch(() => {});
    setDurMin(d);
    setSecs(d * 60);
  };

  const adjustTime = (deltaMin) => {
    Haptics.selectionAsync().catch(() => {});
    setSecs((v) => Math.max(60, v + deltaMin * 60));
  };

  const openMusic = () => {
    Linking.openURL("spotify:").catch(() =>
      Linking.openURL("music://").catch(() => {})
    );
  };

  const ac = brk ? colors.low : colors.accent;

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
    time:    { fontSize: 56, fontFamily: "Outfit-ExtraBold", letterSpacing: -2 },
    timeLbl: { fontSize: 11, fontFamily: "Outfit-SemiBold", letterSpacing: 1, marginTop: 2, color: colors.textMuted },
    meta:    { fontSize: 12, color: colors.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Outfit-SemiBold" },
    title:   { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, textAlign: "center", lineHeight: 30, marginBottom: spacing.xl },
    btnRow:  { flexDirection: "row", gap: spacing.md, alignItems: "center" },
    mainBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    mainOff: { backgroundColor: colors.bgCard, borderWidth: 2, borderColor: colors.accent },
    sideBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bgCard, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border },
    adjustRow: {
      flexDirection: "row", gap: 10, marginBottom: spacing.md,
    },
    adjustBtn: {
      paddingHorizontal: 18, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    adjustTxt: {
      fontSize: 13, fontFamily: "Outfit-Bold",
      color: colors.textSecondary,
    },
    dots:    { flexDirection: "row", gap: 8, marginTop: spacing.lg },
    dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotOn:   { backgroundColor: colors.accent },
    badge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: colors.accent },
    badgeTxt: { fontSize: 11, fontFamily: "Outfit-Bold", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.bgCard,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    spacer: { width: 36 },
    musicPill: {
      width: 32, height: 32, borderRadius: 9,
      backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    musicPillLogo: { width: 32, height: 32 },
    durRow: {
      flexDirection: "row", gap: 8,
      marginBottom: spacing.xl, marginTop: -spacing.md,
    },
    durChip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: colors.border,
    },
    durChipTxt: { fontSize: 13, fontFamily: "Outfit-SemiBold" },

    over: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
    },
    overInner: {
      flex: 1,
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
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.lowGlow ?? colors.accentGlow,
      borderWidth: 2, borderColor: colors.low,
      alignItems: "center", justifyContent: "center",
      marginBottom: spacing.lg,
    },
    overH:   { fontSize: 28, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, marginBottom: spacing.sm, textAlign: "center" },
    overSub: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl, lineHeight: 22 },
    bigBtn:  {
      width: "100%", backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: 14, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: 8, marginBottom: 12,
    },
    bigBtnT:  { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 16 },
    skipBtn:  { paddingVertical: 8 },
    skipT:    { fontSize: 13, color: colors.textMuted },
    overClose: {
      position: "absolute",
      top: insets.top + 12,
      left: spacing.lg,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.bgCard,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border,
      zIndex: 10,
    },
  });

  return (
    <SafeAreaView style={s.safe} edges={["left", "right", "bottom"]}>
      <View style={topBarStyle}>
        <TouchableOpacity onPress={leave} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={s.badge}>
          <Feather name="zap" size={11} color={colors.accent} />
          <Text style={s.badgeTxt}>{brk ? "Break Time" : "Focus Mode"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {MUSIC_APPS.map((app) => (
            <TouchableOpacity
              key={app.key}
              style={s.musicPill}
              onPress={() => openMusicApp(app)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              activeOpacity={0.75}
            >
              <Image source={app.logo} style={s.musicPillLogo} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
          <>
            <Text style={[s.meta, { marginBottom: spacing.sm }]}>Step away from the screen</Text>
            <TouchableOpacity
              onPress={() => { setBrk(false); setSecs(durMin * 60); setOn(false); }}
              style={s.skipBtn}
            >
              <Text style={s.skipT}>Skip break</Text>
            </TouchableOpacity>
          </>
        )}

        {!on && n === 0 && !brk && (
          <View style={s.durRow}>
            {DUR_OPTIONS.map((d) => {
              const active = durMin === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.durChip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  onPress={() => changeDur(d)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.durChipTxt, { color: active ? "#fff" : colors.textMuted }]}>
                    {d}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* +/- time adjust */}
        <View style={s.adjustRow}>
          <TouchableOpacity
            style={s.adjustBtn}
            onPress={() => adjustTime(-5)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.adjustTxt}>−5m</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.adjustBtn}
            onPress={() => adjustTime(5)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.adjustTxt}>+5m</Text>
          </TouchableOpacity>
        </View>

        <View style={s.btnRow}>
          <Animated.View style={{ transform: [{ scale: resetScale }] }}>
            <TouchableOpacity
              style={s.sideBtn}
              onPress={reset}
              onPressIn={onResetIn}
              onPressOut={onResetOut}
              activeOpacity={1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="rotate-ccw" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: playScale }] }}>
            <TouchableOpacity
              style={[s.mainBtn, !on && s.mainOff]}
              onPress={() => setOn((x) => !x)}
              onPressIn={onPlayIn}
              onPressOut={onPlayOut}
              activeOpacity={1}
            >
              <Feather name={on ? "pause" : "play"} size={28} color={on ? "#fff" : colors.accent} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
            <TouchableOpacity
              style={s.sideBtn}
              onPress={task && !brk ? markDone : leave}
              onPressIn={onCheckIn}
              onPressOut={onCheckOut}
              activeOpacity={1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={task && !brk ? "check" : "log-out"}
                size={20}
                color={task && !brk ? colors.low : colors.textMuted}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={s.dots}>
          {[0, 1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[s.dot, i < n && s.dotOn, { transform: [{ scale: dotAnims[i] }] }]}
            />
          ))}
        </View>
      </View>

      {/* Session complete overlay — animates in with fade + slide up */}
      {done && (
        <Animated.View style={[s.over, { opacity: overFade }]}>
          <TouchableOpacity style={s.overClose} onPress={leave}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <Animated.View style={[s.overInner, { transform: [{ translateY: overSlide }] }]}>
            <ScrollView contentContainerStyle={s.overScroll} showsVerticalScrollIndicator={false}>
              <Animated.View style={[s.overIcon, { transform: [{ scale: iconBounce }] }]}>
                <Feather name="check-circle" size={44} color={colors.low} />
              </Animated.View>
              <Text style={s.overH}>Session complete!</Text>
              <Text style={s.overSub}>
                {n} Pomodoro{n !== 1 ? "s" : ""} done.{"\n"}Time to take a break.
              </Text>

              {task ? (
                <TouchableOpacity style={s.bigBtn} onPress={markDone}>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.bigBtnT}>Mark Done & Finish</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.bigBtn} onPress={() => navigation.goBack()}>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.bigBtnT}>Finish Session</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={s.skipBtn} onPress={startAnother}>
                <Text style={s.skipT}>Keep going — start another session</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
