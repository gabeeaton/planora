import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert, DeviceEventEmitter,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { useTasks } from "../hooks/useTasks";
import { useSubscription } from "../hooks/useSubscription";
import { scheduleStudyPlanReminders, cancelStudyPlanReminders } from "../services/notifications";
import { generateStudyPlan } from "../services/openai";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { FEATURE_FLAGS } from "../config";
import { spacing, radius } from "../utils/theme";
import { addDays, format, startOfToday, isSameDay } from "date-fns";
import * as Haptics from "expo-haptics";

const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

const tap = () => Haptics.selectionAsync().catch(() => {});

// Canned study plan — used when DEMO_MODE = true
const makeDemoPlan = () => {
  const d = (offset) => format(addDays(startOfToday(), offset), "yyyy-MM-dd");
  return [
    { _key: "dm0", date: d(0), className: "CHEM 201",  sessionTitle: "Review oxidation reactions",       durationMinutes: 60, tip: "Focus on reaction mechanisms — they're the most common exam questions.", completed: true,  completedAt: Date.now() - 3600000, missed: false },
    { _key: "dm1", date: d(1), className: "PSYC 101",  sessionTitle: "Read chapters 8–9",                durationMinutes: 45, tip: "Skim headings first, then read actively. Write one sentence per section.", completed: false, missed: false },
    { _key: "dm2", date: d(1), className: "MATH 240",  sessionTitle: "Practice problem sets 5–6",        durationMinutes: 90, tip: "Try problems without notes first, then check your work.", completed: false, missed: false },
    { _key: "dm3", date: d(2), className: "HIST 110",  sessionTitle: "Outline essay argument",           durationMinutes: 30, tip: "Write your thesis and three main points before drafting anything.", completed: false, missed: false },
    { _key: "dm4", date: d(2), className: "CHEM 201",  sessionTitle: "Past exam questions — timed",      durationMinutes: 75, tip: "⚠️ Tight deadline — this is the most important session this week.", completed: false, missed: false },
    { _key: "dm5", date: d(3), className: "MATH 240",  sessionTitle: "Review integration techniques",    durationMinutes: 60, tip: "Work through your notes one more time, then quiz yourself.", completed: false, missed: false },
    { _key: "dm6", date: d(4), className: "HIST 110",  sessionTitle: "Write and polish essay draft",     durationMinutes: 90, tip: "Start from your outline — the structure is already there.", completed: false, missed: false },
  ];
};

const CLASS_COLORS = [
  "#6C63FF", "#FF6B6B", "#4ECDC4", "#FFB347", "#5CFF8F",
  "#FF8CC8", "#63B3FF", "#CE93D8", "#80DEEA", "#FFAB76",
];

const colorForClass = (name) => {
  if (!name) return "#888";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
};

const PLAN_CACHE_KEY = "@planora_study_plan_cache";

const TIME_PRESETS = [
  { label: "Off", value: 0 },
  { label: "30m", value: 0.5 },
  { label: "1h",  value: 1 },
  { label: "2h",  value: 2 },
  { label: "3h",  value: 3 },
  { label: "4h",  value: 4 },
  { label: "5h",  value: 5 },
  { label: "6h",  value: 6 },
  { label: "7h",  value: 7 },
  { label: "8h",  value: 8 },
];

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  closeBtn: { padding: 4 },

  // Availability picker
  pickerHint: {
    fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textSecondary,
    paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 12, lineHeight: 20,
  },
  availList: { paddingHorizontal: spacing.lg, gap: 8 },
  availRow: {
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingTop: 12, paddingBottom: 10, paddingLeft: 14, paddingRight: 0,
    ...(colors.isDark ? {} : {
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    }),
  },
  availRowTop: { flexDirection: "row", alignItems: "center" },
  availDayInfo: { width: 72 },
  availDayName: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  availDayDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },
  availChipScroll: { flex: 1 },
  availChipRow: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingRight: 14 },
  availChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
  },
  availChipSelected: {
    borderColor: colors.accent, backgroundColor: colors.accentGlow,
  },
  availChipText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textSecondary },
  availChipTextSelected: { color: colors.accent },

  // Schedule pills shown under each day
  availScheduleRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 5,
    paddingHorizontal: 14, paddingRight: 14, marginTop: 8,
  },
  availSchedulePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.isDark ? colors.bgInput : "#F2F2F8",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  availSchedulePillClass: {
    backgroundColor: colors.accentGlow,
  },
  availScheduleText: {
    fontSize: 10, fontFamily: "Outfit-SemiBold", color: colors.textMuted,
  },
  availScheduleTextClass: { color: colors.accent },

  loadingWrap: {
    paddingHorizontal: spacing.lg, paddingTop: 48, paddingBottom: 16, alignItems: "center",
  },
  loadingLabel: {
    fontSize: 15, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, marginBottom: 20,
  },
  loadingSubLabel: {
    fontSize: 13, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 12,
  },
  progressTrack: {
    width: "100%", height: 6, borderRadius: 3,
    backgroundColor: colors.isDark ? colors.bgInput : "#E8E8EE", overflow: "hidden",
  },
  progressFill: {
    height: 6, borderRadius: 3,
  },

  generateBtn: {
    marginHorizontal: spacing.lg, marginTop: 20, marginBottom: 8,
    borderRadius: radius.md, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  generateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Outfit-Bold" },

  // Plan display
  planHint: {
    fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textSecondary,
    paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 6, lineHeight: 20,
  },
  daySection: { marginTop: 16 },
  daySectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, marginBottom: 8,
  },
  daySectionTitle: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  daySectionMins: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
  deadlineRow: {
    marginHorizontal: spacing.lg, marginBottom: 6,
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  deadlineTitle: { fontSize: 13, fontFamily: "Outfit-SemiBold", lineHeight: 18 },
  deadlineClass: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#888", marginTop: 1 },
  deadlineDue: { fontSize: 11, fontFamily: "Outfit-Bold" },

  sessionCard: {
    marginHorizontal: spacing.lg, marginBottom: 8,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    flexDirection: "row", overflow: "hidden",
  },
  sessionCheck: {
    width: 44, alignItems: "center", justifyContent: "center",
  },
  sessionCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  sessionAccent: { width: 4 },
  sessionBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  sessionClassTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  sessionClassText: { fontSize: 10, fontFamily: "Outfit-Bold" },
  sessionTitle: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, marginBottom: 4, lineHeight: 20 },
  sessionSourceTask: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginBottom: 4 },
  sessionActivity: { fontSize: 12, fontFamily: "Outfit-Regular", color: colors.textSecondary, lineHeight: 17 },
  durationBadge: {
    paddingHorizontal: 10, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
    borderLeftWidth: 1, borderLeftColor: colors.border,
    minWidth: 48,
  },
  durationText: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textMuted },
  durationUnit: { fontSize: 10, fontFamily: "Outfit-Regular", color: colors.textMuted },

  regenerateBtn: {
    marginHorizontal: spacing.lg, marginBottom: 32,
    borderRadius: radius.md, paddingVertical: 13, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  regenerateBtnText: { fontSize: 14, fontFamily: "Outfit-SemiBold" },

  // Pro gate
  lockedWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  lockedIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  lockedTitle: { fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, textAlign: "center", marginBottom: 8 },
  lockedBody: { fontSize: 15, fontFamily: "Outfit-Regular", color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  upgradeBtn: {
    borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 36,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  upgradeBtnText: { color: "#fff", fontSize: 16, fontFamily: "Outfit-Bold" },
});

const StudyPlanScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { tasks, patterns } = useTasks();
  const { isPro: realIsPro } = useSubscription();
  const isPro = DEMO_MODE ? true : realIsPro;

  const { events: calEvents } = useCalendarEvents(!DEMO_MODE);

  const today = startOfToday();

  // Per-day schedule: classes + calendar events for each of the 7 upcoming days
  const DAY_MAP = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

  const parseTimeStr = (str) => {
    if (!str) return null;
    const m = str.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return { h, min };
  };

  const fmtTime = (str) => {
    const t = parseTimeStr(str);
    if (!t) return str;
    const suffix = t.h >= 12 ? "PM" : "AM";
    const h12 = t.h % 12 || 12;
    const mm = String(t.min).padStart(2, "0");
    return mm === "00" ? `${h12} ${suffix}` : `${h12}:${mm} ${suffix}`;
  };

  const scheduleByDay = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i);
      const dayKey = DAY_MAP[date.getDay()];
      const dateStr = format(date, "yyyy-MM-dd");

      // Class schedule entries for this weekday
      const classes = (profile?.classSchedule ?? [])
        .filter((e) => e.days?.includes(dayKey) && e.className)
        .map((e) => ({
          id: `cls-${e.id}`,
          title: e.className,
          time: e.startTime ? fmtTime(e.startTime) : null,
          endTime: e.endTime ? fmtTime(e.endTime) : null,
          isClass: true,
          durationMins: (() => {
            const s = parseTimeStr(e.startTime);
            const end = parseTimeStr(e.endTime);
            if (!s || !end) return 0;
            return (end.h * 60 + end.min) - (s.h * 60 + s.min);
          })(),
        }));

      // Calendar events for this date (non-all-day)
      const calForDay = (calEvents ?? [])
        .filter((e) => {
          const d = new Date(e.startDate);
          return format(d, "yyyy-MM-dd") === dateStr && !e.allDay;
        })
        .map((e) => ({
          id: `cal-${e.id}`,
          title: e.title,
          time: format(new Date(e.startDate), "h:mm a").replace(":00", ""),
          isClass: false,
          durationMins: Math.round((new Date(e.endDate) - new Date(e.startDate)) / 60000),
        }));

      const totalClassMins = classes.reduce((sum, c) => sum + c.durationMins, 0);

      return {
        dateStr,
        events: [...classes, ...calForDay].slice(0, 5), // cap display at 5
        totalClassMins,
      };
    });
  }, [profile?.classSchedule, calEvents]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return {
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(date, "EEEE"),
      date: format(date, "yyyy-MM-dd"),
      dateLabel: format(date, "MMM d"),
      dateObj: date,
      hours: 2,
    };
  });

  const [availability, setAvailability] = useState(weekDays);
  const [plan, setPlan] = useState(DEMO_MODE ? makeDemoPlan() : null);
  const [loading, setLoading] = useState(false);

  // Load cached plan on mount — show yesterday's sessions as missed for 24h, drop older ones
  useEffect(() => {
    if (DEMO_MODE) return;
    AsyncStorage.getItem(PLAN_CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const { plan: cached } = JSON.parse(raw);
        const todayStr     = format(startOfToday(), "yyyy-MM-dd");
        const yesterdayStr = format(addDays(startOfToday(), -1), "yyyy-MM-dd");
        const filtered = cached
          .filter((s) => s.date >= yesterdayStr)
          .map((s, i) => ({
            ...s,
            _key: s._key ?? `loaded_${i}`,
            missed: s.date < todayStr && !s.completed,
          }));
        if (filtered.length > 0) {
          setPlan(filtered);
          // Reschedule notifications for any remaining future sessions
          scheduleStudyPlanReminders(filtered, user?.uid).catch(() => {});
        }
      } catch {}
    }).catch(() => {});
  }, [user?.uid]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const generateScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loading) {
      progressAnim.setValue(0);
      progressAnimation.current = Animated.timing(progressAnim, {
        toValue: 0.88,
        duration: 14000,
        useNativeDriver: false,
      });
      progressAnimation.current.start();
    } else {
      progressAnimation.current?.stop();
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start(() => progressAnim.setValue(0));
    }
  }, [loading]);

  const setHours = (index, hours) =>
    setAvailability((prev) => prev.map((d, i) => i === index ? { ...d, hours } : d));

  const formatHoursDisplay = (h) => {
    if (h === 0) return "Off";
    if (h === 0.5) return "30m";
    if (h % 1 === 0) return `${h}h`;
    return `${Math.floor(h)}h 30m`;
  };

  const toggleSessionDone = useCallback((key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPlan((prev) => {
      const updated = prev.map((s) => {
        if (s._key !== key) return s;
        const nowDone = !s.completed;
        return { ...s, completed: nowDone, completedAt: nowDone ? Date.now() : null };
      });
      AsyncStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ plan: updated }))
        .then(() => DeviceEventEmitter.emit("studyPlanUpdated"))
        .catch(() => {});
      return updated;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const completedSessions = (plan ?? []).filter((s) => s.completed);
    setLoading(true);
    setPlan(null);
    if (DEMO_MODE) {
      setTimeout(() => { setLoading(false); setPlan(makeDemoPlan()); }, 1200);
      return;
    }
    try {
      const result = await generateStudyPlan(tasks, profile, patterns, availability, completedSessions, {
        classSchedule: profile?.classSchedule ?? [],
        calEvents: calEvents ?? [],
      });
      const ts = Date.now();
      const newSessions = result.map((s, i) => ({ ...s, _key: `gen_${ts}_${i}` }));
      const merged = [...completedSessions, ...newSessions].sort((a, b) => a.date.localeCompare(b.date));
      setPlan(merged);
      AsyncStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ plan: merged }))
        .then(() => DeviceEventEmitter.emit("studyPlanUpdated"))
        .catch(() => {});
      scheduleStudyPlanReminders(result, user?.uid).catch(() => {});
    } catch (err) {
      Alert.alert("Couldn't generate plan", err.message ?? "Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [plan, tasks, profile, patterns, availability, user?.uid]);

  const pendingTasks = tasks.filter((t) => !t.completed && t.dueDate);

  const missedSessions = plan ? plan.filter((s) => s.missed) : [];

  const sessionsByDay = plan
    ? availability.map((d) => ({
        ...d,
        sessions: plan.filter((s) => s.date === d.date && !s.missed),
        deadlines: pendingTasks.filter((t) => {
          let raw;
          if (t.dueDate?.toDate) raw = t.dueDate.toDate();
          else if (t.dueDate?.seconds) raw = new Date(t.dueDate.seconds * 1000);
          else raw = new Date(t.dueDate);
          if (!raw || isNaN(raw.getTime())) return false;
          return isSameDay(raw, d.dateObj);
        }),
      })).filter((d) => d.sessions.length > 0 || d.deadlines.length > 0)
    : [];

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Build My Plan</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
        {!isPro ? (
          <View style={styles.lockedWrap}>
            <View style={[styles.lockedIcon, { backgroundColor: colors.accent + "22" }]}>
              <Feather name="lock" size={28} color={colors.accent} />
            </View>
            <Text style={styles.lockedTitle}>AI Study Planner</Text>
            <Text style={styles.lockedBody}>
              Build a personalized weekly study schedule based on your tasks, deadlines, and availability — powered by GPT-4o.
            </Text>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); navigation.navigate("Paywall"); }}
            >
              <Feather name="zap" size={18} color="#fff" />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        ) : !plan ? (
          <>
            <Text style={styles.pickerHint}>
              How many free hours do you have each day? I'll build a schedule around your tasks and deadlines.
            </Text>

            <View style={styles.availList}>
              {availability.map((day, i) => {
                const dayInfo = scheduleByDay[i];
                return (
                  <View key={day.date} style={styles.availRow}>
                    {/* Top row: day label + hour chips */}
                    <View style={styles.availRowTop}>
                      <View style={styles.availDayInfo}>
                        <Text style={styles.availDayName}>{day.label}</Text>
                        <Text style={styles.availDayDate}>{day.dateLabel}</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.availChipScroll}
                        contentContainerStyle={styles.availChipRow}
                      >
                        {TIME_PRESETS.map(({ label, value }) => {
                          const selected = day.hours === value;
                          return (
                            <TouchableOpacity
                              key={value}
                              style={[styles.availChip, selected && styles.availChipSelected]}
                              onPress={() => { tap(); setHours(i, value); }}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.availChipText, selected && styles.availChipTextSelected]}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Schedule pills: classes + calendar events */}
                    {dayInfo?.events?.length > 0 && (
                      <View style={styles.availScheduleRow}>
                        {dayInfo.events.map((evt) => (
                          <View
                            key={evt.id}
                            style={[styles.availSchedulePill, evt.isClass && styles.availSchedulePillClass]}
                          >
                            <Feather
                              name={evt.isClass ? "book" : "calendar"}
                              size={9}
                              color={evt.isClass ? colors.accent : colors.textMuted}
                            />
                            <Text style={[styles.availScheduleText, evt.isClass && styles.availScheduleTextClass]}>
                              {evt.title}{evt.time ? ` · ${evt.time}` : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingLabel}>Building your plan...</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[styles.progressFill, {
                      backgroundColor: colors.accent,
                      width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    }]}
                  />
                </View>
                <Text style={styles.loadingSubLabel}>Analyzing your tasks and deadlines</Text>
              </View>
            ) : (
              <Animated.View style={{ transform: [{ scale: generateScale }] }}>
                <TouchableOpacity
                  style={[styles.generateBtn, { backgroundColor: colors.accent }]}
                  onPress={handleGenerate}
                  onPressIn={() => Animated.spring(generateScale, { toValue: 0.96, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
                  onPressOut={() => Animated.spring(generateScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
                  activeOpacity={1}
                >
                  <Feather name="edit-3" size={18} color="#fff" />
                  <Text style={styles.generateBtnText}>Build My Plan</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.planHint}>
              Prep sessions leading up to your deadlines. Times are up to you.
            </Text>

            {missedSessions.length > 0 && (
              <View style={[styles.daySection, { opacity: 0.5 }]}>
                <View style={styles.daySectionHeader}>
                  <Text style={styles.daySectionTitle}>Yesterday · Missed</Text>
                </View>
                {missedSessions.map((s, idx) => {
                  return (
                    <View key={idx} style={[styles.sessionCard, { borderColor: colors.border }]}>
                      <View style={[styles.sessionAccent, { backgroundColor: colors.textMuted }]} />
                      <View style={styles.sessionBody}>
                        {s.className && (
                          <View style={[styles.sessionClassTag, { backgroundColor: colors.bgInput, alignSelf: "flex-start", marginBottom: 5 }]}>
                            <Text style={[styles.sessionClassText, { color: colors.textMuted }]}>{s.className}</Text>
                          </View>
                        )}
                        <Text style={[styles.sessionTitle, { color: colors.textMuted }]}>{s.sessionTitle}</Text>
                        {(s.taskDueDate || (s.taskTitle && s.taskTitle !== s.sessionTitle)) && (
                          <Text style={styles.sessionSourceTask}>
                            {s.taskTitle && s.taskTitle !== s.sessionTitle ? s.taskTitle : ""}
                            {s.taskTitle && s.taskTitle !== s.sessionTitle && s.taskDueDate ? " · " : ""}
                            {s.taskDueDate ? `due ${s.taskDueDate}` : ""}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.durationBadge, { justifyContent: "center" }]}>
                        <Feather name="x-circle" size={14} color={colors.textMuted} />
                        <Text style={[styles.durationUnit, { marginTop: 2 }]}>missed</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {sessionsByDay.map((day) => {
              const totalMins = day.sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
              return (
                <View key={day.date} style={styles.daySection}>
                  <View style={styles.daySectionHeader}>
                    <Text style={styles.daySectionTitle}>{day.label} · {day.dateLabel}</Text>
                    {totalMins > 0 && <Text style={styles.daySectionMins}>{totalMins} min</Text>}
                  </View>

                  {day.deadlines.map((t) => {
                    const accentColor = colorForClass(t.className);
                    return (
                      <View key={t.id} style={[styles.deadlineRow, { borderColor: accentColor + "55", backgroundColor: accentColor + "11" }]}>
                        <Feather name="flag" size={12} color={accentColor} style={{ marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.deadlineTitle, { color: accentColor }]}>{t.title}</Text>
                          {t.className && <Text style={styles.deadlineClass}>{t.className}</Text>}
                        </View>
                        <Text style={[styles.deadlineDue, { color: accentColor }]}>Due</Text>
                      </View>
                    );
                  })}

                  {day.sessions.map((s, idx) => {
                    const key = s._key ?? `${s.date}_${idx}`;
                    const accentColor = colorForClass(s.className);
                    return (
                      <View key={key} style={[styles.sessionCard, s.completed && { opacity: 0.45 }]}>
                        {/* Circle checkbox */}
                        <TouchableOpacity
                          style={styles.sessionCheck}
                          onPress={() => toggleSessionDone(key)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                        >
                          <View style={[
                            styles.sessionCircle,
                            s.completed && { backgroundColor: colors.low, borderColor: colors.low },
                          ]}>
                            {s.completed && <Feather name="check" size={11} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <View style={[styles.sessionAccent, { backgroundColor: accentColor }]} />
                        <View style={styles.sessionBody}>
                          {s.className && (
                            <View style={[styles.sessionClassTag, { backgroundColor: accentColor + "22", alignSelf: "flex-start", marginBottom: 5 }]}>
                              <Text style={[styles.sessionClassText, { color: accentColor }]}>{s.className}</Text>
                            </View>
                          )}
                          <Text style={[styles.sessionTitle, s.completed && { textDecorationLine: "line-through", color: colors.textMuted }]}>
                            {s.sessionTitle}
                          </Text>
                          {!s.completed && (s.taskDueDate || (s.taskTitle && s.taskTitle !== s.sessionTitle)) && (
                            <Text style={styles.sessionSourceTask}>
                              {s.taskTitle && s.taskTitle !== s.sessionTitle ? s.taskTitle : ""}
                              {s.taskTitle && s.taskTitle !== s.sessionTitle && s.taskDueDate ? " · " : ""}
                              {s.taskDueDate ? `due ${s.taskDueDate}` : ""}
                            </Text>
                          )}
                          {!s.completed && <Text style={styles.sessionActivity}>{s.activity}</Text>}
                        </View>
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{s.durationMinutes}</Text>
                          <Text style={styles.durationUnit}>min</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.regenerateBtn, { borderColor: colors.border }]}
              onPress={() => {
                tap();
                setPlan(null);
                AsyncStorage.removeItem(PLAN_CACHE_KEY).catch(() => {});
                cancelStudyPlanReminders(user?.uid).catch(() => {});
              }}
            >
              <Feather name="chevron-left" size={14} color={colors.textMuted} />
              <Text style={[styles.regenerateBtnText, { color: colors.textMuted }]}>Adjust availability</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default StudyPlanScreen;
