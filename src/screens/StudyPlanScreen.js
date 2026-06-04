import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Alert, DeviceEventEmitter, Modal, Pressable, Platform, Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Mascot from "../components/Mascot";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";
import { useTasks } from "../hooks/useTasks";
import { useSubscription } from "../hooks/useSubscription";
import { scheduleStudyPlanReminders, cancelStudyPlanReminders, scheduleMondaySummary } from "../services/notifications";
import { generateStudyPlan, adjustTaskSessions } from "../services/openai";
import Svg, { Circle } from "react-native-svg";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import * as Calendar from "expo-calendar";

const CAL_ICONS = {
  google:  require("../assets/google-calendar.png"),
  apple:   require("../assets/apple-calendar.png"),
};
import { FEATURE_FLAGS } from "../config";
import { loadPlanStreak, incrementPlanStreak, savePlanSessionDates } from "../utils/streakHelpers";
import { spacing, radius, getClassColor } from "../utils/theme";
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


const PLAN_CACHE_KEY = "@planora_study_plan_cache";

const TIME_PRESETS = [
  { label: "Off", value: 0 },
  { label: "1h",  value: 1 },
  { label: "2h",  value: 2 },
  { label: "3h",  value: 3 },
  { label: "4h",  value: 4 },
  { label: "5h",  value: 5 },
  { label: "6h",  value: 6 },
];

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTitle: { fontSize: 18, fontFamily: "Outfit-Bold", color: "#fff", flex: 1, textAlign: "center" },
  headerSide: { width: 72 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerAction: { padding: 6 },
  closeBtn: { padding: 6 },

  // Detail sheet
  detailBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end",
  },
  detailSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 36,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  detailHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  detailHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  detailClass: { fontSize: 12, fontFamily: "Outfit-Bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  detailTitle: { fontSize: 18, fontFamily: "Outfit-Bold", lineHeight: 24, marginBottom: 12 },
  detailMeta: { flexDirection: "row", gap: 8 },
  detailChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  detailChipText: { fontSize: 12, fontFamily: "Outfit-SemiBold" },
  detailActivity: {
    fontSize: 14, fontFamily: "Outfit-Regular", lineHeight: 22,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  detailDoneBtn: {
    marginHorizontal: 20, borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  detailDoneBtnText: { fontSize: 15, fontFamily: "Outfit-Bold" },

  // Availability sheet
  availSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  availSheetTitle: { fontSize: 17, fontFamily: "Outfit-Bold", paddingHorizontal: 20, paddingTop: 16, marginBottom: 4 },
  availSheetHint: { fontSize: 13, fontFamily: "Outfit-Regular", paddingHorizontal: 20, marginBottom: 12 },

  // Set all row
  setAllRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  setAllChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  setAllChipText: { fontSize: 13, fontFamily: "Outfit-SemiBold" },

  // Availability picker
  pickerHint: {
    fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textSecondary,
    paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 12, lineHeight: 20,
  },
  availList: { paddingHorizontal: spacing.lg, gap: 8 },
  availRow: {
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: radius.md,
    paddingTop: 12, paddingBottom: 10, paddingLeft: 14, paddingRight: 0,
    ...(colors.isDark
      ? { borderWidth: 1, borderColor: colors.border }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 }
    ),
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

  loadingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, alignItems: "center", justifyContent: "center", gap: 20,
  },
  loadingBigLabel: {
    fontSize: 18, fontFamily: "Outfit-SemiBold", textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  overcommitBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginHorizontal: spacing.lg, marginBottom: 12,
    borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  overcommitText: {
    flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", lineHeight: 18,
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
    borderRadius: radius.md,
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    flexDirection: "row", overflow: "hidden",
    ...(colors.isDark
      ? { borderWidth: 1, borderColor: colors.border }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2 }
    ),
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
  sessionBody: { flex: 1, paddingVertical: 11, paddingHorizontal: 11 },
  sessionClassTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  sessionClassText: { fontSize: 10, fontFamily: "Outfit-Bold" },
  sessionTitle: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, lineHeight: 20 },
  sessionSourceTask: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 3 },
  durationBadge: {
    paddingHorizontal: 10, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
    borderLeftWidth: 1, borderLeftColor: colors.isDark ? colors.border : "#EBEBEB",
    minWidth: 48,
  },
  durationText: { fontSize: 13, fontFamily: "Outfit-Bold", color: colors.textMuted },
  durationUnit: { fontSize: 10, fontFamily: "Outfit-Regular", color: colors.textMuted },

  tallyComment: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    marginHorizontal: spacing.lg, marginBottom: 14,
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: radius.md, padding: 12,
    ...(colors.isDark
      ? { borderWidth: 1, borderColor: colors.border }
      : { shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }
    ),
  },
  tallyCommentText: { flex: 1, fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textPrimary, lineHeight: 19 },
  ringWrap: { alignItems: "center", marginVertical: 16, gap: 6 },
  ringLabel: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
  momentumSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 99,
    backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
    alignItems: "center",
  },
  momentumTitle: { fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginTop: 12, textAlign: "center" },
  momentumSub: { fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  momentumStreak: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  momentumStreakText: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: "#FF6B2C" },
  tallyRescheduleBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: spacing.lg, marginBottom: 12,
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  tallyRescheduleTitle: { fontSize: 14, fontFamily: "Outfit-Bold" },
  tallyRescheduleSub: { fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 2, lineHeight: 16 },
  tallyRescheduleBtn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  tallyRescheduleBtnText: { fontSize: 13, fontFamily: "Outfit-Bold", color: "#fff" },

  planStreakRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", marginHorizontal: spacing.lg, marginBottom: 12,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: colors.isDark ? colors.bgInput : "#fff",
    borderWidth: colors.isDark ? 1 : 0,
    borderColor: colors.isDark ? colors.border : "transparent",
    ...(colors.isDark ? {} : {
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    }),
  },
  planStreakText: { fontSize: 12, fontFamily: "Outfit-SemiBold" },

  planActionsRow: { flexDirection: "row", gap: 10 },
  planActionBtn: {
    borderRadius: radius.md, paddingVertical: 13, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  planActionBtnText: { fontSize: 13, fontFamily: "Outfit-SemiBold" },

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
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    return {
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(date, "EEEE"),
      date: format(date, "yyyy-MM-dd"),
      dateLabel: format(date, "MMM d"),
      dateObj: date,
      hours: isWeekend ? 3 : 2,
    };
  });

  const [availability, setAvailability] = useState(weekDays);
  const [selectedSession, setSelectedSession] = useState(null);
  const detailSheetAnim = useRef(new Animated.Value(0)).current;
  const [showAvailSheet, setShowAvailSheet] = useState(false);
  const availSheetAnim = useRef(new Animated.Value(0)).current;
  const [plan, setPlan] = useState(DEMO_MODE ? makeDemoPlan() : null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [calExporting, setCalExporting] = useState(false);
  const [calPickerVisible, setCalPickerVisible] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState(null);
  const calPickerAnim = useRef(new Animated.Value(0)).current;

  // Session momentum sheet
  const [momentumData, setMomentumData] = useState(null);
  const momentumAnim = useRef(new Animated.Value(0)).current;
  const momentumTimer = useRef(null);

  // Tally comment shown after plan generation
  const [tallyComment, setTallyComment] = useState(null);

  // Surgical rebuild
  const [reschedulingTaskId, setReschedulingTaskId] = useState(null);
  const [planStreak, setPlanStreak] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    loadPlanStreak(user.uid).then(({ count }) => setPlanStreak(count));
  }, [user?.uid]);

  const LOADING_MESSAGES = [
    "Tally is planning your week...",
    "Spacing out your sessions...",
    "Checking your deadlines...",
    "Balancing your workload...",
    "Almost ready...",
  ];

  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); return; }
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const overcommitment = useMemo(() => {
    if (!plan) return null;
    const scheduledMins = plan.filter((s) => !s.missed).reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    const availableMins = availability.reduce((sum, d) => sum + d.hours * 60, 0);
    if (availableMins === 0 || scheduledMins <= availableMins) return null;
    const scheduledHrs = (scheduledMins / 60).toFixed(1);
    const availableHrs = (availableMins / 60).toFixed(1);
    return { scheduledHrs, availableHrs, overMins: scheduledMins - availableMins };
  }, [plan, availability]);

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
          if (isPro) scheduleStudyPlanReminders(filtered, user?.uid).catch(() => {});
        }
      } catch {}
    }).catch(() => {});
  }, [user?.uid]);
  const generateScale = useRef(new Animated.Value(1)).current;

  const setHours = (index, hours) =>
    setAvailability((prev) => prev.map((d, i) => i === index ? { ...d, hours } : d));

  const setAllHours = (hours) =>
    setAvailability((prev) => prev.map((d) => ({ ...d, hours })));

  const openDetail = useCallback((session) => {
    setSelectedSession(session);
    Animated.spring(detailSheetAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 65, friction: 11,
    }).start();
  }, [detailSheetAnim]);

  const closeDetail = useCallback(() => {
    Animated.timing(detailSheetAnim, {
      toValue: 0, duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedSession(null));
  }, [detailSheetAnim]);

  const openAvailSheet = useCallback(() => {
    setShowAvailSheet(true);
    Animated.spring(availSheetAnim, {
      toValue: 1, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [availSheetAnim]);

  const closeAvailSheet = useCallback(() => {
    Animated.timing(availSheetAnim, {
      toValue: 0, duration: 220, useNativeDriver: true,
    }).start(() => setShowAvailSheet(false));
  }, [availSheetAnim]);

  const toggleSessionDone = useCallback((key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPlan((prev) => {
      const updated = prev.map((s) =>
        s._key === key ? { ...s, completed: !s.completed, completedAt: !s.completed ? Date.now() : null } : s
      );
      const session = updated.find((s) => s._key === key);
      if (session?.completed) {
        const todayStr = format(startOfToday(), "yyyy-MM-dd");
        const todaySessions = updated.filter((x) => x.date === todayStr && !x.missed);
        const doneTodayCount = todaySessions.filter((x) => x.completed).length;
        // Show momentum immediately — don't wait for AsyncStorage
        setTimeout(() => showMomentum({ doneTodayCount, totalToday: todaySessions.length, planStreak }), 0);
        // Update streak in background, refresh number when done
        if (user?.uid) {
          incrementPlanStreak(user.uid).then((newCount) => {
            setPlanStreak(newCount);
            setMomentumData((d) => d ? { ...d, planStreak: newCount } : d);
          }).catch(() => {});
        }
      }
      AsyncStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ plan: updated }))
        .then(() => DeviceEventEmitter.emit("studyPlanUpdated"))
        .catch(() => {});
      return updated;
    });
  }, [user?.uid, showMomentum, planStreak]);

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
      if (user?.uid) savePlanSessionDates(user.uid, merged).catch(() => {});
      if (isPro) scheduleStudyPlanReminders(result, user?.uid).catch(() => {});
      if (user?.uid) scheduleMondaySummary(merged, user.uid).catch(() => {});

      // Build a Tally comment from the plan — no API call, client-side
      const todayStr2 = format(startOfToday(), "yyyy-MM-dd");
      const todaySessions = merged.filter((s) => s.date === todayStr2 && !s.missed && !s.completed);
      const soonest = [...merged].filter((s) => !s.missed && !s.completed)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (todaySessions.length > 0) {
        setTallyComment(`Locked in. You have ${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""} today — start with ${todaySessions[0].sessionTitle.toLowerCase()}.`);
      } else if (soonest) {
        setTallyComment(`Plan's ready. First up: ${soonest.sessionTitle} on ${format(new Date(soonest.date + "T12:00:00"), "EEEE")}.`);
      } else {
        setTallyComment("You're all set for the week.");
      }
    } catch (err) {
      Alert.alert("Couldn't generate plan", err.message ?? "Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [plan, tasks, profile, patterns, availability, user?.uid]);

  const openCalPicker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const todayStr = format(startOfToday(), "yyyy-MM-dd");
    const upcoming = (plan ?? []).filter((s) => !s.completed && !s.missed && s.date >= todayStr);
    if (upcoming.length === 0) {
      Alert.alert("Nothing to export", "No upcoming sessions in your plan.");
      return;
    }
    let { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Calendar.requestCalendarPermissionsAsync());
    }
    if (status !== "granted") {
      Alert.alert("Calendar access needed", "Enable calendar access in Settings to export your sessions.");
      return;
    }
    try {
      const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = all.filter((c) => c.allowsModifications && c.type !== "subscribed");
      if (writable.length === 0) { Alert.alert("No calendar found", "No writable calendar on this device."); return; }
      // Prefer Google, then primary, then first writable
      const preferred = writable.find((c) => c.source?.name?.toLowerCase().includes("google"))
                     || writable.find((c) => c.isPrimary)
                     || writable[0];
      setAvailableCalendars(writable);
      setSelectedCalendarId(preferred.id);
      setCalPickerVisible(true);
      Animated.spring(calPickerAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } catch {
      Alert.alert("Couldn't load calendars", "Try again.");
    }
  }, [plan, calPickerAnim]);

  const closeCalPicker = useCallback(() => {
    Animated.timing(calPickerAnim, { toValue: 0, duration: 220, useNativeDriver: true })
      .start(() => setCalPickerVisible(false));
  }, [calPickerAnim]);

  const confirmExport = useCallback(async () => {
    const cal = availableCalendars.find((c) => c.id === selectedCalendarId);
    if (!cal) return;
    closeCalPicker();
    const todayStr = format(startOfToday(), "yyyy-MM-dd");
    const upcoming = (plan ?? []).filter((s) => !s.completed && !s.missed && s.date >= todayStr);
    setCalExporting(true);
    try {
      for (const s of upcoming) {
        const start = new Date(`${s.date}T08:00:00`);
        const end   = new Date(start.getTime() + (s.durationMinutes ?? 60) * 60000);
        await Calendar.createEventAsync(cal.id, {
          title: s.className ? `${s.className} — ${s.sessionTitle}` : s.sessionTitle,
          startDate: start,
          endDate: end,
          notes: s.activity ?? s.tip ?? "",
          alarms: [{ relativeOffset: -30 }],
        });
      }
      Alert.alert("Exported!", `${upcoming.length} session${upcoming.length !== 1 ? "s" : ""} added to ${cal.title} at 8 AM each day.`);
    } catch {
      Alert.alert("Couldn't export", "Something went wrong — try again.");
    } finally {
      setCalExporting(false);
    }
  }, [availableCalendars, selectedCalendarId, plan, closeCalPicker]);

  const showMomentum = useCallback((data) => {
    setMomentumData(data);
    Animated.spring(momentumAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    if (momentumTimer.current) clearTimeout(momentumTimer.current);
    momentumTimer.current = setTimeout(() => {
      Animated.timing(momentumAnim, { toValue: 0, duration: 220, useNativeDriver: true })
        .start(() => setMomentumData(null));
    }, 2800);
  }, [momentumAnim]);

  const handleRescheduleMissed = useCallback(async () => {
    // Deduplicate by taskId — one API call per unique task
    const uniqueTaskIds = [...new Set(missedSessions.map((s) => s.taskId).filter(Boolean))];
    if (uniqueTaskIds.length === 0) return;
    setReschedulingTaskId(uniqueTaskIds[0]);
    try {
      let currentPlan = plan ?? [];
      for (const taskId of uniqueTaskIds) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) continue;
        const completedForTask = currentPlan.filter((s) => s.taskId === taskId && s.completed);
        const newSessions = await adjustTaskSessions(task, availability, completedForTask);
        const ts = Date.now();
        const without = currentPlan.filter((s) => s.taskId !== taskId || s.completed);
        const added = newSessions.map((s, i) => ({ ...s, _key: `adj_${ts}_${i}`, missed: false }));
        currentPlan = [...without, ...added].sort((a, b) => a.date.localeCompare(b.date));
      }
      setPlan(currentPlan);
      AsyncStorage.setItem(PLAN_CACHE_KEY, JSON.stringify({ plan: currentPlan }))
        .then(() => DeviceEventEmitter.emit("studyPlanUpdated"))
        .catch(() => {});
    } catch {
      Alert.alert("Couldn't reschedule", "Try again in a moment.");
    } finally {
      setReschedulingTaskId(null);
    }
  }, [tasks, plan, availability, missedSessions]);

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

  const detailTranslateY = detailSheetAnim.interpolate({
    inputRange: [0, 1], outputRange: [400, 0],
  });

  return (
    <View style={styles.safe}>
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.bg }]}>
          <Mascot variant="writing" size={130} blink={false} />
          <Text style={[styles.loadingBigLabel, { color: colors.textPrimary }]}>
            {LOADING_MESSAGES[loadingMsgIdx]}
          </Text>
        </View>
      )}

      {/* Session detail sheet */}
      {selectedSession && (
        <Modal transparent animationType="none" onRequestClose={closeDetail}>
          <Pressable style={styles.detailBackdrop} onPress={closeDetail}>
            <Animated.View
              style={[styles.detailSheet, { backgroundColor: colors.bgCard, transform: [{ translateY: detailTranslateY }] }]}
            >
              <Pressable onPress={() => {}}>
                <View style={styles.detailHandle} />
                <View style={styles.detailHeader}>
                  {selectedSession.className && (
                    <Text style={[styles.detailClass, { color: getClassColor(selectedSession.className, colors.isDark) }]}>
                      {selectedSession.className}
                    </Text>
                  )}
                  <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedSession.sessionTitle}</Text>
                  <View style={styles.detailMeta}>
                    <View style={[styles.detailChip, { backgroundColor: colors.bgInput }]}>
                      <Feather name="clock" size={11} color={colors.textMuted} />
                      <Text style={[styles.detailChipText, { color: colors.textMuted }]}>{selectedSession.durationMinutes} min</Text>
                    </View>
                    {selectedSession.taskDueDate && (
                      <View style={[styles.detailChip, { backgroundColor: colors.bgInput }]}>
                        <Feather name="flag" size={11} color={colors.textMuted} />
                        <Text style={[styles.detailChipText, { color: colors.textMuted }]}>Due {selectedSession.taskDueDate}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {selectedSession.activity && (
                  <Text style={[styles.detailActivity, { color: colors.textSecondary }]}>{selectedSession.activity}</Text>
                )}
                <TouchableOpacity
                  style={[styles.detailDoneBtn, { backgroundColor: selectedSession.completed ? colors.bgInput : colors.accent }]}
                  onPress={() => { toggleSessionDone(selectedSession._key); closeDetail(); }}
                  activeOpacity={0.8}
                >
                  <Feather name={selectedSession.completed ? "x" : "check"} size={16} color={selectedSession.completed ? colors.textMuted : "#fff"} />
                  <Text style={[styles.detailDoneBtnText, { color: selectedSession.completed ? colors.textMuted : "#fff" }]}>
                    {selectedSession.completed ? "Mark Incomplete" : "Mark Done"}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Availability sheet — shown over existing plan, non-destructive */}
      {showAvailSheet && (
        <Modal transparent animationType="none" onRequestClose={closeAvailSheet}>
          <Pressable style={styles.detailBackdrop} onPress={closeAvailSheet}>
            <Animated.View style={[
              styles.availSheet,
              { backgroundColor: colors.bgCard },
              { transform: [{ translateY: availSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] },
            ]}>
              <Pressable onPress={() => {}}>
                <View style={styles.detailHandle} />
                <Text style={[styles.availSheetTitle, { color: colors.textPrimary }]}>Adjust availability</Text>
                <Text style={[styles.availSheetHint, { color: colors.textSecondary }]}>
                  Update your free hours, then rebuild.
                </Text>
                <View style={[styles.setAllRow, { paddingHorizontal: 20, marginBottom: 8 }]}>
                  {[1, 2, 3, 4].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.setAllChip, { borderColor: colors.border, backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7" }]}
                      onPress={() => { tap(); setAllHours(h); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.setAllChipText, { color: colors.textSecondary }]}>All {h}h</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingBottom: 8 }}>
                  {availability.map((day, i) => {
                    const dayInfo = scheduleByDay[i];
                    return (
                      <View key={day.date} style={[styles.availRow, { paddingRight: 0 }]}>
                        <View style={styles.availRowTop}>
                          <View style={styles.availDayInfo}>
                            <Text style={styles.availDayName}>{day.label}</Text>
                            <Text style={styles.availDayDate}>{day.dateLabel}</Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.availChipScroll} contentContainerStyle={styles.availChipRow}>
                            {TIME_PRESETS.map(({ label, value }) => {
                              const selected = day.hours === value;
                              return (
                                <TouchableOpacity
                                  key={value}
                                  style={[styles.availChip, selected && styles.availChipSelected]}
                                  onPress={() => { tap(); setHours(i, value); }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.availChipText, selected && styles.availChipTextSelected]}>{label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                        {dayInfo?.events?.length > 0 && (
                          <View style={styles.availScheduleRow}>
                            {dayInfo.events.map((evt) => (
                              <View key={evt.id} style={[styles.availSchedulePill, evt.isClass && styles.availSchedulePillClass]}>
                                <Feather name={evt.isClass ? "book" : "calendar"} size={9} color={evt.isClass ? colors.accent : colors.textMuted} />
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
                </ScrollView>
                <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: colors.accent, marginHorizontal: 0, marginTop: 0 }]}
                    onPress={() => { closeAvailSheet(); setTimeout(handleGenerate, 250); }}
                    activeOpacity={0.85}
                  >
                    <Feather name="edit-3" size={16} color="#fff" />
                    <Text style={styles.generateBtnText}>Rebuild Plan</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerSide}>
          {navigation.canGoBack() && (
            <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>My Plan</Text>
        <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
          {plan && !loading && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={openAvailSheet}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="refresh-cw" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
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
              <Text style={styles.upgradeBtnText}>Upgrade to Scholar</Text>
            </TouchableOpacity>
          </View>
        ) : !plan ? (
          <>
            <Text style={styles.pickerHint}>
              How much free time do you have each day? Tally will build your sessions around it.
            </Text>

            <View style={[styles.setAllRow, { paddingHorizontal: spacing.lg }]}>
              {[1, 2, 3, 4].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.setAllChip, { borderColor: colors.border, backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7" }]}
                  onPress={() => { tap(); setAllHours(h); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.setAllChipText, { color: colors.textSecondary }]}>All {h}h</Text>
                </TouchableOpacity>
              ))}
            </View>

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

            {!loading && (
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
            {/* Completion ring */}
            {(() => {
              const total = plan.filter((s) => !s.missed).length;
              const done  = plan.filter((s) => s.completed).length;
              if (total === 0) return null;
              const pct  = done / total;
              const r    = 36;
              const circ = 2 * Math.PI * r;
              const dash = circ * pct;
              return (
                <View style={styles.ringWrap}>
                  <Svg width={90} height={90}>
                    <Circle cx={45} cy={45} r={r} stroke={colors.border} strokeWidth={7} fill="none" />
                    <Circle cx={45} cy={45} r={r} stroke={colors.accent} strokeWidth={7} fill="none"
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={circ / 4}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <Text style={styles.ringLabel}>{done} of {total} sessions done</Text>
                </View>
              );
            })()}

            {/* Tally comment after generation */}
            {tallyComment && (
              <View style={styles.tallyComment}>
                <Mascot variant="alive" size={36} blink={false} />
                <Text style={styles.tallyCommentText}>{tallyComment}</Text>
                <TouchableOpacity onPress={() => setTallyComment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.planHint}>
              Prep sessions leading up to your deadlines. Times are up to you.
            </Text>

            {planStreak > 0 && (
              <View style={styles.planStreakRow}>
                <MaterialCommunityIcons name="fire" size={14} color="#FF6B2C" />
                <Text style={[styles.planStreakText, { color: "#FF6B2C" }]}>
                  {planStreak}-day plan streak
                </Text>
              </View>
            )}

            {overcommitment && (
              <View style={[styles.overcommitBanner, { backgroundColor: colors.isDark ? "#2D1A1A" : "#FFF0EE", borderColor: "#FF6B6B" }]}>
                <Feather name="alert-triangle" size={14} color="#FF6B6B" />
                <Text style={[styles.overcommitText, { color: colors.isDark ? "#FF8888" : "#CC3333" }]}>
                  {overcommitment.scheduledHrs}h of work, {overcommitment.availableHrs}h available — you're overcommitted. Something will slip unless you free up time.
                </Text>
              </View>
            )}

            {missedSessions.length > 0 && (
              <View style={styles.daySection}>
                <View style={styles.daySectionHeader}>
                  <Text style={styles.daySectionTitle}>Yesterday · Missed</Text>
                </View>

                {/* Tally reschedule banner */}
                <TouchableOpacity
                  style={[styles.tallyRescheduleBanner, { borderColor: colors.accent + "40", backgroundColor: colors.isDark ? colors.accent + "14" : colors.accent + "0A" }]}
                  onPress={handleRescheduleMissed}
                  disabled={!!reschedulingTaskId}
                  activeOpacity={0.75}
                >
                  <Mascot variant="alive" size={38} blink={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tallyRescheduleTitle, { color: colors.textPrimary }]}>
                      {reschedulingTaskId ? "Rescheduling…" : "Tally can fix this"}
                    </Text>
                    <Text style={[styles.tallyRescheduleSub, { color: colors.textSecondary }]}>
                      {reschedulingTaskId
                        ? "Finding new slots for your missed sessions"
                        : `Reschedule ${missedSessions.length} missed session${missedSessions.length !== 1 ? "s" : ""} around your week`}
                    </Text>
                  </View>
                  {!reschedulingTaskId && (
                    <View style={[styles.tallyRescheduleBtn, { backgroundColor: colors.accent }]}>
                      <Text style={styles.tallyRescheduleBtnText}>Reschedule</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ opacity: 0.5 }}>
                {missedSessions.map((s, idx) => {
                  return (
                    <View key={idx} style={styles.sessionCard}>
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
                    const accentColor = getClassColor(t.className, colors.isDark);
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
                    const accentColor = getClassColor(s.className, colors.isDark);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.sessionCard, s.completed && { opacity: 0.4 }]}
                        onPress={() => openDetail(s)}
                        activeOpacity={0.75}
                      >
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
                            <View style={[styles.sessionClassTag, { backgroundColor: accentColor + "22", alignSelf: "flex-start", marginBottom: 4 }]}>
                              <Text style={[styles.sessionClassText, { color: accentColor }]}>{s.className}</Text>
                            </View>
                          )}
                          <Text style={[styles.sessionTitle, s.completed && { textDecorationLine: "line-through", color: colors.textMuted }]}>
                            {s.sessionTitle}
                          </Text>
                          {!s.completed && s.taskDueDate && (
                            <Text style={styles.sessionSourceTask}>due {s.taskDueDate}</Text>
                          )}
                        </View>
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{s.durationMinutes}</Text>
                          <Text style={styles.durationUnit}>min</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            <View style={[styles.planActionsRow, { marginHorizontal: spacing.lg, marginBottom: 32 }]}>
              <TouchableOpacity
                style={[styles.planActionBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={openAvailSheet}
                activeOpacity={0.7}
              >
                <Feather name="sliders" size={14} color={colors.textMuted} />
                <Text style={[styles.planActionBtnText, { color: colors.textMuted }]}>Availability</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planActionBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={openCalPicker}
                disabled={calExporting}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={14} color={calExporting ? colors.textMuted : colors.textSecondary} />
                <Text style={[styles.planActionBtnText, { color: calExporting ? colors.textMuted : colors.textSecondary }]}>
                  {calExporting ? "Exporting…" : "Export to Calendar"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Calendar picker confirmation sheet */}
      {calPickerVisible && (() => {
        const todayStr = format(startOfToday(), "yyyy-MM-dd");
        const upcomingCount = (plan ?? []).filter((s) => !s.completed && !s.missed && s.date >= todayStr).length;

        // Group individual calendars into one row per provider
        const providerMap = {};
        for (const cal of availableCalendars) {
          const src = (cal.source?.name ?? "").toLowerCase();
          let key, label, color;
          if (src.includes("google") || src.includes("gmail")) {
            key = "google"; label = "Google Calendar"; color = "#4285F4";
          } else if (src.includes("exchange") || src.includes("outlook")) {
            key = "outlook"; label = "Outlook"; color = "#0072C6";
          } else if (Platform.OS === "android") {
            key = "google"; label = "Google Calendar"; color = "#4285F4";
          } else {
            key = "apple"; label = "Apple Calendar"; color = "#888";
          }
          if (!providerMap[key]) providerMap[key] = { key, label, color, cal };
          // Prefer the primary calendar within each provider
          else if (cal.isPrimary) providerMap[key].cal = cal;
        }
        const providers = Object.values(providerMap);
        const selectedProvider = providers.find((p) => p.cal.id === selectedCalendarId) ?? providers[0];

        return (
          <Modal transparent animationType="none" onRequestClose={closeCalPicker}>
            <Pressable style={styles.detailBackdrop} onPress={closeCalPicker}>
              <Animated.View
                style={[styles.detailSheet, { backgroundColor: colors.bg },
                  { transform: [{ translateY: calPickerAnim.interpolate({ inputRange: [0,1], outputRange: [400, 0] }) }] }
                ]}
              >
                <Pressable onPress={() => {}}>
                  <View style={styles.detailHandle} />
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
                    <Text style={{ fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 6 }}>
                      Export to Calendar
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.textSecondary, fontFamily: "Outfit-Regular", lineHeight: 21 }}>
                      {upcomingCount} session{upcomingCount !== 1 ? "s" : ""} will be added at 8 AM each day with a 30-min reminder.
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit-Bold", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
                      Add to
                    </Text>
                    {providers.map((p) => {
                      const selected = selectedProvider?.key === p.key;
                      return (
                        <TouchableOpacity
                          key={p.key}
                          style={{
                            flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 14,
                            borderRadius: 12, paddingHorizontal: 12, marginBottom: 4,
                            backgroundColor: selected ? colors.accentGlow : "transparent",
                          }}
                          onPress={() => setSelectedCalendarId(p.cal.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{
                            width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                            borderColor: selected ? colors.accent : colors.border,
                            alignItems: "center", justifyContent: "center",
                          }}>
                            {selected && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accent }} />}
                          </View>
                          <View style={{ width: 34, height: 34, borderRadius: 8, overflow: "hidden", backgroundColor: CAL_ICONS[p.key] ? "transparent" : p.color + "18", alignItems: "center", justifyContent: "center" }}>
                            {CAL_ICONS[p.key] ? (
                              <Image source={CAL_ICONS[p.key]} style={{ width: 34, height: 34 }} resizeMode="contain" />
                            ) : (
                              <Text style={{ fontSize: 14, fontFamily: "Outfit-Bold", color: p.color }}>{p.label[0]}</Text>
                            )}
                          </View>
                          <Text style={{ fontSize: 16, fontFamily: "Outfit-SemiBold", color: selected ? colors.accent : colors.textPrimary, flex: 1 }}>
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingBottom: 36 }}>
                    <TouchableOpacity
                      style={{ flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgInput }}
                      onPress={closeCalPicker}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16, fontFamily: "Outfit-SemiBold", color: colors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 2, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent }}
                      onPress={confirmExport}
                      activeOpacity={0.85}
                    >
                      <Feather name="calendar" size={17} color="#fff" />
                      <Text style={{ fontSize: 16, fontFamily: "Outfit-Bold", color: "#fff" }}>Export {upcomingCount} sessions</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Animated.View>
            </Pressable>
          </Modal>
        );
      })()}

      {/* Session momentum sheet */}
      {momentumData && (
        <Animated.View style={[styles.momentumSheet, {
          transform: [{ translateY: momentumAnim.interpolate({ inputRange: [0,1], outputRange: [300, 0] }) }],
        }]}>
          <Mascot variant="bounce" size={80} blink={false} />
          <Text style={styles.momentumTitle}>
            {momentumData.doneTodayCount === momentumData.totalToday && momentumData.totalToday > 0
              ? "All done today!"
              : `${momentumData.doneTodayCount} of ${momentumData.totalToday} done today`}
          </Text>
          <Text style={styles.momentumSub}>
            {momentumData.doneTodayCount === momentumData.totalToday && momentumData.totalToday > 0
              ? "You cleared your sessions. That's a locked-in day."
              : "Keep it going — you're building momentum."}
          </Text>
          {momentumData.planStreak > 1 && (
            <View style={styles.momentumStreak}>
              <MaterialCommunityIcons name="fire" size={14} color="#FF6B2C" />
              <Text style={styles.momentumStreakText}>{momentumData.planStreak}-day plan streak</Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
};

export default StudyPlanScreen;
