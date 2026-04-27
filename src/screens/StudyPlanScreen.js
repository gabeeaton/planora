import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { useTasks } from "../hooks/useTasks";
import { useSubscription } from "../hooks/useSubscription";
import { generateStudyPlan } from "../services/openai";
import { spacing, radius } from "../utils/theme";
import { addDays, format, startOfToday, isSameDay } from "date-fns";
import * as Haptics from "expo-haptics";

const tap = () => Haptics.selectionAsync().catch(() => {});

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

const MAX_HOURS = 6;
const PLAN_CACHE_KEY = "@planora_study_plan_cache";

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
    paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 16, lineHeight: 20,
  },
  dayGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: spacing.lg, gap: 10,
  },
  dayCard: {
    width: "47.5%",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    paddingTop: 14, paddingBottom: 10, paddingHorizontal: 14,
    alignItems: "center",
  },
  dayCardOff: {
    backgroundColor: colors.isDark ? colors.bg : "#FAFAFA",
    borderColor: colors.isDark ? colors.border : "#E8E8EE",
  },
  dayCardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", width: "100%", marginBottom: 10 },
  dayCardName: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  dayCardDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },
  dayCardHours: { fontSize: 38, fontFamily: "Outfit-Bold", color: colors.accent, lineHeight: 44, marginBottom: 10 },
  dayCardOff_: { color: colors.textMuted, fontSize: 26 },
  dayCardBtns: { flexDirection: "row", gap: 8, width: "100%" },
  dayCardBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
  },
  dayCardBtnDisabled: { opacity: 0.3 },

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
  const { profile } = useUserProfile();
  const { tasks, patterns } = useTasks();
  const { isPro } = useSubscription();

  const today = startOfToday();
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
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load cached plan on mount — show yesterday's sessions as missed for 24h, drop older ones
  useEffect(() => {
    AsyncStorage.getItem(PLAN_CACHE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const { plan: cached } = JSON.parse(raw);
        const todayStr    = format(startOfToday(), "yyyy-MM-dd");
        const yesterdayStr = format(addDays(startOfToday(), -1), "yyyy-MM-dd");
        const filtered = cached
          .filter((s) => s.date >= yesterdayStr)
          .map((s) => (s.date < todayStr ? { ...s, missed: true } : s));
        if (filtered.length > 0) setPlan(filtered);
      } catch {}
    }).catch(() => {});
  }, []);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

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

  const handleGenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    setPlan(null);
    try {
      const result = await generateStudyPlan(tasks, profile, patterns, availability);
      setPlan(result);
      AsyncStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ plan: result })).catch(() => {});
    } catch (err) {
      Alert.alert("Couldn't generate plan", err.message ?? "Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [tasks, profile, patterns, availability]);

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

            <View style={styles.dayGrid}>
              {availability.map((day, i) => {
                const isOff = day.hours === 0;
                return (
                  <View key={day.date} style={[styles.dayCard, isOff && styles.dayCardOff]}>
                    <View style={styles.dayCardTopRow}>
                      <View>
                        <Text style={styles.dayCardName}>{day.label}</Text>
                        <Text style={styles.dayCardDate}>{day.dateLabel}</Text>
                      </View>
                    </View>
                    <Text style={[styles.dayCardHours, isOff && styles.dayCardOff_]}>
                      {isOff ? "Off" : `${day.hours}h`}
                    </Text>
                    <View style={styles.dayCardBtns}>
                      <TouchableOpacity
                        style={[styles.dayCardBtn, isOff && styles.dayCardBtnDisabled]}
                        onPress={() => { tap(); setHours(i, Math.max(0, day.hours - 1)); }}
                        disabled={isOff}
                      >
                        <Feather name="minus" size={14} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dayCardBtn, day.hours === MAX_HOURS && styles.dayCardBtnDisabled]}
                        onPress={() => { tap(); setHours(i, Math.min(MAX_HOURS, day.hours + 1)); }}
                        disabled={day.hours === MAX_HOURS}
                      >
                        <Feather name="plus" size={14} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
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
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: colors.accent }]}
                onPress={handleGenerate}
              >
                <Feather name="edit-3" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>Build My Plan</Text>
              </TouchableOpacity>
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
                        {s.taskTitle && s.taskTitle !== s.sessionTitle && (
                          <Text style={styles.sessionSourceTask}>For: {s.taskTitle}</Text>
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
                    const accentColor = colorForClass(s.className);
                    return (
                      <View key={idx} style={styles.sessionCard}>
                        <View style={[styles.sessionAccent, { backgroundColor: accentColor }]} />
                        <View style={styles.sessionBody}>
                          {s.className && (
                            <View style={[styles.sessionClassTag, { backgroundColor: accentColor + "22", alignSelf: "flex-start", marginBottom: 5 }]}>
                              <Text style={[styles.sessionClassText, { color: accentColor }]}>{s.className}</Text>
                            </View>
                          )}
                          <Text style={styles.sessionTitle}>{s.sessionTitle}</Text>
                          {s.taskTitle && s.taskTitle !== s.sessionTitle && (
                            <Text style={styles.sessionSourceTask}>For: {s.taskTitle}</Text>
                          )}
                          <Text style={styles.sessionActivity}>{s.activity}</Text>
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
              onPress={() => { tap(); setPlan(null); AsyncStorage.removeItem(PLAN_CACHE_KEY).catch(() => {}); }}
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
