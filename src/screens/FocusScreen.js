import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Linking, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../utils/ThemeContext";
import { useTasks } from "../hooks/useTasks";
import { spacing, radius } from "../utils/theme";
import { priorityColors } from "../utils/theme";
import { FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

const _now = Date.now();
const DEMO_TASKS = [
  { id: "d0", title: "Review lecture notes — today's quiz", className: "BIOL 150", dueDate: new Date(_now), completed: false, priority: "HIGH", aiPriority: "HIGH" },
  { id: "d1", title: "Study for Organic Chemistry midterm", className: "CHEM 201", dueDate: new Date(_now + 86400000), completed: false, priority: "HIGH", aiPriority: "HIGH" },
  { id: "d2", title: "Write 5-page essay on the Civil War", className: "HIST 110", dueDate: new Date(_now + 2 * 86400000), completed: false, priority: "HIGH", aiPriority: "HIGH" },
  { id: "d3", title: "Problem Set 4 — Linear Algebra", className: "MATH 240", dueDate: new Date(_now + 3 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d4", title: "Read chapters 7–9 for lecture", className: "PSYC 101", dueDate: new Date(_now + 4 * 86400000), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d5", title: "Lab report — titration experiment", className: "CHEM 201", dueDate: new Date(_now + 5 * 86400000), completed: false, priority: "LOW", aiPriority: "LOW" },
];

const MUSIC_APPS = [
  {
    key: "spotify",
    label: "Spotify",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6",
    appUrl: "spotify:playlist:37i9dQZF1DX8NTLI2TtZa6",
    color: "#1DB954",
    logo: require("../assets/spotify-logo.png"),
  },
  {
    key: "apple",
    label: "Apple Music",
    url: "https://music.apple.com/us/playlist/pl.f4d106fed2bd41149fffb86d56414c07",
    appUrl: "music://",
    color: "#FC3C44",
    logo: require("../assets/apple-music-logo.jpg"),
  },
];

const openMusic = (app) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  // music:// is iOS-only; on Android canOpenURL returns false and we fall back to web
  Linking.canOpenURL(app.appUrl)
    .then((can) => Linking.openURL(can ? app.appUrl : app.url))
    .catch(() => Linking.openURL(app.url).catch(() => {}));
};

export default function FocusScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const real = useTasks();
  const pendingTasks = DEMO_MODE ? DEMO_TASKS : real.pendingTasks;
  const todaysTasks  = DEMO_MODE ? DEMO_TASKS.slice(0, 1) : real.todaysTasks;
  const focusTasks   = todaysTasks.length > 0 ? todaysTasks : pendingTasks.slice(0, 6);

  // Pulse animation for the start button when idle
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const mountAnim  = useRef(new Animated.Value(0)).current;
  const mountSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    // Mount entrance
    Animated.parallel([
      Animated.timing(mountAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(mountSlide, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
    ]).start();

    // Subtle idle pulse on the zap icon
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const startFocus = (task = null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate("FocusMode", task
      ? { task: JSON.parse(JSON.stringify({ ...task, createdAt: task.createdAt?.toString?.() ?? null, dueDate: task.dueDate?.toString?.() ?? null })) }
      : undefined);
  };

  const pColors = priorityColors(colors.isDark);

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Purple header */}
      <View style={s.header}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
          <View style={s.decoOrb} />
          <View style={[s.decoOrb, { width: 60, height: 60, right: 70, top: 8, opacity: 0.6 }]} />
        </View>
        <View style={s.headerTopRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={s.headerTitle}>Focus</Text>
            <Text style={s.headerSub}>
              {focusTasks.length > 0
                ? `${focusTasks.length} task${focusTasks.length > 1 ? "s" : ""} to work through`
                : "Nothing pending — you're clear"}
            </Text>
          </View>
          <View style={s.musicPills}>
            {MUSIC_APPS.map((app) => (
              <TouchableOpacity
                key={app.key}
                style={s.musicPill}
                onPress={() => openMusic(app)}
                activeOpacity={0.75}
              >
                <Image source={app.logo} style={s.musicPillLogo} resizeMode="cover" />
                <Text style={s.musicPillLabel}>{app.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Big start button */}
        <Animated.View style={{ opacity: mountAnim, transform: [{ translateY: mountSlide }] }}>
          <TouchableOpacity
            style={s.bigStart}
            onPress={() => startFocus(focusTasks[0])}
            activeOpacity={0.88}
          >
            {/* Decorative blobs */}
            <View style={s.blobBR} pointerEvents="none" />
            <View style={s.blobTL} pointerEvents="none" />

            <Animated.View style={[s.bigStartIcon, { transform: [{ scale: pulseAnim }] }]}>
              <Feather name="target" size={28} color={colors.accent} />
            </Animated.View>
            <Text style={s.bigStartTitle}>Start Focus Session</Text>
            <Text style={s.bigStartSub} numberOfLines={2}>
              {focusTasks[0]
                ? focusTasks[0].title
                : "Pick a task below and lock in"}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Task picker */}
        {focusTasks.length > 0 && (
          <Animated.View style={{ opacity: mountAnim }}>
            <Text style={s.sectionLabel}>
              {todaysTasks.length > 0 ? "DUE TODAY" : "PICK A TASK"}
            </Text>
            <View style={s.card}>
              {focusTasks.map((task, i) => (
                <FocusTaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  isLast={i === focusTasks.length - 1}
                  onPress={() => startFocus(task)}
                  colors={colors}
                  pColors={pColors}
                  s={s}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {focusTasks.length === 0 && (
          <Animated.View style={[s.empty, { opacity: mountAnim }]}>
            <View style={s.emptyIcon}>
              <Feather name="sun" size={26} color={colors.accent} />
            </View>
            <Text style={s.emptyTitle}>All clear</Text>
            <Text style={s.emptySub}>No pending tasks. Add something from the home screen to get started.</Text>
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const FocusTaskRow = ({ task, index, isLast, onPress, colors, pColors, s }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const mountAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const delay = Math.min(index, 5) * 40;
    Animated.sequence([
      Animated.delay(delay + 80),
      Animated.parallel([
        Animated.timing(mountAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 22, bounciness: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const pColor = task.priority ? pColors[task.priority] : colors.textMuted;

  return (
    <Animated.View style={{ opacity: mountAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[s.taskRow, !isLast && s.taskDivider]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={[s.priorityDot, { backgroundColor: pColor }]} />
        <View style={s.taskLeft}>
          <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
          {!!task.className && (
            <Text style={s.taskClass}>{task.className}</Text>
          )}
        </View>
        <Animated.View style={[s.focusChip, { transform: [{ scale: scaleAnim }] }]}>
          <Feather name="target" size={12} color={colors.accent} />
          <Text style={s.focusChipText}>Focus</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Purple header
  header: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Outfit-ExtraBold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
  },
  decoOrb: {
    position: "absolute",
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -30, top: -30,
  },
  planBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  planBtnLabel: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: "#fff" },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // Big start card
  bigStart: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: 22,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    overflow: "hidden",
    borderWidth: colors.isDark ? 1 : 0,
    borderColor: colors.isDark ? colors.border : "transparent",
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    }),
  },
  blobBR: {
    position: "absolute",
    right: -40, bottom: -40,
    width: 120, height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent + "12",
  },
  blobTL: {
    position: "absolute",
    left: -20, top: -20,
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + "08",
  },
  bigStartIcon: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accent + "30",
  },
  bigStartTitle: {
    fontSize: 19, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 4,
  },
  bigStartSub: {
    fontSize: 13, fontFamily: "Outfit-Regular", color: colors.textSecondary,
    textAlign: "center", lineHeight: 18,
  },

  sectionLabel: {
    fontSize: 11, fontFamily: "Outfit-ExtraBold",
    color: colors.textMuted, letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: 16, borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2",
    overflow: "hidden",
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 2,
    }),
  },
  taskRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, gap: 10,
  },
  taskDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F0F0F8",
  },
  priorityDot: {
    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
  },
  taskLeft: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  taskClass: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 2 },
  focusChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.accentGlow,
  },
  focusChipText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.accent },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  musicPills: { flexDirection: "column", gap: 8, alignItems: "flex-end" },
  musicPill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 22, paddingVertical: 7, paddingHorizontal: 11,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.30)",
  },
  musicPillLogo: { width: 20, height: 20, borderRadius: 6, flexShrink: 0 },
  musicPillLabel: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: "rgba(255,255,255,0.95)" },
});
