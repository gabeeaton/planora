import React, { useRef, useEffect, useMemo, useState, useContext, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Linking, Platform, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  format, isToday, isSameDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isWithinInterval,
} from "date-fns";
import { useTheme } from "../utils/ThemeContext";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useTasks } from "../hooks/useTasks";
import { useSubscription } from "../hooks/useSubscription";
import { spacing } from "../utils/theme";
import * as Haptics from "expo-haptics";
import { AddTaskContext } from "../contexts/AddTaskContext";
import { FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

// ── Demo data — pinned to November 17, 2025 (Monday) ──────────
const _ev = (id, title, color, m, d, sh, sm, eh, em, loc) => {
  const s = new Date(2025, m, d, sh, sm, 0, 0);
  const e = new Date(2025, m, d, eh, em, 0, 0);
  return { id, title, color, startDate: s, endDate: e, allDay: false, location: loc };
};
//                             id        title                         color      mo  day  sh  sm  eh  em  location
const DEMO_EVENTS = [
  // Week of Nov 3
  _ev("e1a", "CHEM 201 – Organic Chemistry",  "#E85D04", 10,  3,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e1b", "HIST 110 – U.S. History",        "#2E7D32", 10,  4, 11,  0, 12, 15, "Liberal Arts 305"),
  _ev("e1c", "CHEM 201 – Organic Chemistry",  "#E85D04", 10,  5,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e1d", "MATH 240 – Linear Algebra",     "#5C6BC0", 10,  5, 14,  0, 15, 15, "Math Hall 101"),
  _ev("e1e", "PSYC 101 – Psychology",          "#8E24AA", 10,  6, 15, 30, 16, 45, "Psych Building 110"),
  _ev("e1f", "SPAN 102 – Spanish II",          "#D84315", 10,  7, 16,  0, 17,  0, "Language Center 108"),
  // Week of Nov 10
  _ev("e2a", "CHEM 201 – Organic Chemistry",  "#E85D04", 10, 10,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e2b", "MATH 240 – Linear Algebra",     "#5C6BC0", 10, 10, 14,  0, 15, 15, "Math Hall 101"),
  _ev("e2c", "HIST 110 – U.S. History",        "#2E7D32", 10, 11, 11,  0, 12, 15, "Liberal Arts 305"),
  _ev("e2d", "CHEM 201 – Organic Chemistry",  "#E85D04", 10, 12,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e2e", "BIOL 150 – Biology",            "#0277BD", 10, 12, 13,  0, 14, 15, "Science Hall 220"),
  _ev("e2f", "PSYC 101 – Psychology",          "#8E24AA", 10, 13, 15, 30, 16, 45, "Psych Building 110"),
  // Week of Nov 17 — selected week
  _ev("e3a", "CHEM 201 – Organic Chemistry",  "#E85D04", 10, 17,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e3b", "MATH 240 – Linear Algebra",     "#5C6BC0", 10, 17, 14,  0, 15, 15, "Math Hall 101"),
  _ev("e3c", "HIST 110 – U.S. History",        "#2E7D32", 10, 18, 11,  0, 12, 15, "Liberal Arts 305"),
  _ev("e3d", "PSYC 101 – Psychology",          "#8E24AA", 10, 18, 15, 30, 16, 45, "Psych Building 110"),
  _ev("e3e", "CHEM 201 – Organic Chemistry",  "#E85D04", 10, 19,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e3f", "BIOL 150 – Biology",            "#0277BD", 10, 19, 13,  0, 14, 15, "Science Hall 220"),
  _ev("e3g", "HIST 110 – U.S. History",        "#2E7D32", 10, 20, 11,  0, 12, 15, "Liberal Arts 305"),
  _ev("e3h", "SPAN 102 – Spanish II",          "#D84315", 10, 21, 16,  0, 17,  0, "Language Center 108"),
  // Week of Nov 24
  _ev("e4a", "CHEM 201 – Organic Chemistry",  "#E85D04", 10, 24,  9,  0, 10, 15, "Chem Building 202"),
  _ev("e4b", "HIST 110 – U.S. History",        "#2E7D32", 10, 25, 11,  0, 12, 15, "Liberal Arts 305"),
];
const DEMO_TASKS_CAL = [
  { id: "d-1", title: "Discussion post — environmental policy", className: "POLS 200", dueDate: new Date(2025, 10, 15), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d0",  title: "Review lecture notes — today's quiz",    className: "BIOL 150", dueDate: new Date(2025, 10, 17), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d1",  title: "Study for Organic Chemistry midterm",    className: "CHEM 201", dueDate: new Date(2025, 10, 18), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d2",  title: "Write 5-page essay on the Civil War",    className: "HIST 110", dueDate: new Date(2025, 10, 19), completed: false, priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d3",  title: "Problem Set 4 — Linear Algebra",         className: "MATH 240", dueDate: new Date(2025, 10, 20), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d4",  title: "Read chapters 7–9 for lecture",          className: "PSYC 101", dueDate: new Date(2025, 10, 21), completed: false, priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d5",  title: "Lab report — titration experiment",      className: "CHEM 201", dueDate: new Date(2025, 10, 22), completed: false, priority: "LOW",    aiPriority: "LOW"    },
  { id: "d6",  title: "Spanish composition draft",              className: "SPAN 102", dueDate: new Date(2025, 10, 24), completed: false, priority: "LOW",    aiPriority: "LOW"    },
  { id: "d7",  title: "Quiz review — macro economics",          className: "ECON 101", dueDate: new Date(2025, 10, 18), completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM" },
  { id: "d8",  title: "Group project slides",                   className: "BUS 210",  dueDate: new Date(2025, 10, 16), completed: true,  priority: "HIGH",   aiPriority: "HIGH"   },
  { id: "d9",  title: "Annotated bibliography draft",           className: "HIST 110", dueDate: new Date(2025, 10, 14), completed: true,  priority: "MEDIUM", aiPriority: "MEDIUM" },
];

const DAYS_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

const fmt = (d) => format(new Date(d), "h:mm a").replace(":00 ", " ");

const safeDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const formatDueTime = (dt) => {
  if (!dt) return null;
  const [h, m] = dt;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, "0")} ${suffix}`;
};

const isEventNow = (ev) => {
  try {
    return isWithinInterval(new Date(), { start: new Date(ev.startDate), end: new Date(ev.endDate) });
  } catch { return false; }
};

export default function CalendarScreen({ navigation }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { isPro } = useSubscription();
  const realCal = useCalendarEvents(!DEMO_MODE);
  const realTasks = useTasks();

  const events          = DEMO_MODE ? DEMO_EVENTS        : realCal.events;
  const sources         = DEMO_MODE ? ["School Calendar"] : realCal.sources;
  const status          = DEMO_MODE ? "granted"          : realCal.status;
  const requestPermission = DEMO_MODE ? () => {}         : realCal.requestPermission;
  const tasks           = DEMO_MODE ? DEMO_TASKS_CAL     : realTasks.tasks;
  const completeTask    = DEMO_MODE ? () => {}           : realTasks.completeTask;
  const { openAddTask } = useContext(AddTaskContext);

  const [currentMonth, setCurrentMonth] = useState(DEMO_MODE ? new Date(2025, 10, 1) : new Date());
  const [selectedDay,  setSelectedDay]  = useState(DEMO_MODE ? new Date(2025, 10, 17) : new Date());

  // Build calendar weeks for current month
  const calendarWeeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end   = endOfWeek(endOfMonth(currentMonth));
    const weeks = [];
    let day = start;
    while (day <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(day)); day = addDays(day, 1); }
      weeks.push(week);
    }
    return weeks;
  }, [currentMonth]);

  const tasksByDay = useMemo(() => {
    const map = {};
    (tasks ?? []).forEach((t) => {
      const d = safeDate(t.dueDate);
      if (!d) return;
      const key = format(d, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const eventsByDay = useMemo(() => {
    const map = {};
    (events ?? []).forEach((ev) => {
      try {
        const key = format(new Date(ev.startDate), "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(ev);
      } catch {}
    });
    return map;
  }, [events]);

  const handleMonthChange = useCallback((dir) => {
    Haptics.selectionAsync().catch(() => {});
    setCurrentMonth((m) => dir > 0 ? addMonths(m, 1) : subMonths(m, 1));
  }, []);

  const handleDayPress = useCallback((day) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedDay(day);
  }, []);

  const handleAddTask = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openAddTask({ dueDate: selectedDay });
  }, [selectedDay, openAddTask]);

  const openSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:").catch(() => {});
    } else {
      Linking.openSettings().catch(() => {});
    }
  };
  const openAccountSettings = () => {
    Linking.openURL("App-Prefs:root=ACCOUNTS_AND_PASSWORDS")
      .catch(() => Linking.openURL("app-settings:").catch(() => {}));
  };

  const selectedKey    = format(selectedDay, "yyyy-MM-dd");
  const selectedTasks  = tasksByDay[selectedKey]  ?? [];
  const selectedEvents = eventsByDay[selectedKey] ?? [];

  const isCurrentMonthNow =
    currentMonth.getMonth()     === new Date().getMonth() &&
    currentMonth.getFullYear()  === new Date().getFullYear();

  return (
    // Outer container: accent strip + fixed grid + scrollable day panel
    <View style={s.safe}>

      {/* ── Accent strip (FIXED — never scrolls) ── */}
      <View style={[s.accentStrip, { paddingTop: insets.top + 2 }]}>
        {/* Title + Plan button */}
        <View style={s.stripTopRow}>
          <Text style={s.stripTitle}>Calendar</Text>
          <TouchableOpacity
            style={s.planBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); navigation.navigate(isPro ? "StudyPlan" : "Paywall"); }}
            activeOpacity={0.7}
          >
            <Feather name="edit-3" size={14} color="#fff" />
            <Text style={s.planBtnLabel}>Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Month nav */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => handleMonthChange(-1)} style={s.monthArrow} activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <View style={{ alignItems: "center", gap: 3 }}>
            <Text style={s.monthLabel}>{format(currentMonth, "MMMM yyyy")}</Text>
            {!isCurrentMonthNow && !DEMO_MODE && (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setCurrentMonth(new Date()); setSelectedDay(new Date()); }}
                style={s.todayPill}
                activeOpacity={0.7}
              >
                <Text style={s.todayPillText}>Back to today</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => handleMonthChange(1)} style={s.monthArrow} activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Calendar grid — FIXED, never scrolls ── */}
      <View style={s.gridContainer}>
        <View style={s.weekHeaderRow}>
          {DAYS_LETTER.map((d, i) => (
            <Text key={i} style={s.weekDayLabel}>{d}</Text>
          ))}
        </View>
        {calendarWeeks.map((week, wi) => (
          <View key={wi} style={s.weekRow}>
            {week.map((day, di) => {
              const key            = format(day, "yyyy-MM-dd");
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected     = isSameDay(day, selectedDay);
              const isTodayDay     = isToday(day);
              const dayTasks       = tasksByDay[key]  ?? [];
              const dayEvents      = eventsByDay[key] ?? [];
              const hasContent     = dayTasks.length > 0 || dayEvents.length > 0;

              return (
                <TouchableOpacity
                  key={di}
                  style={s.dayCell}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.75}
                >
                  <View style={[
                    s.dayCellNumWrap,
                    isSelected && { backgroundColor: colors.accent },
                    isTodayDay && !isSelected && { backgroundColor: colors.accentGlow, borderWidth: 1.5, borderColor: colors.accent },
                  ]}>
                    <Text style={[
                      s.dayCellNum,
                      !isCurrentMonth && s.dayCellFaded,
                      isSelected      && s.dayCellSelected,
                      isTodayDay && !isSelected && { color: colors.accent },
                    ]}>
                      {format(day, "d")}
                    </Text>
                  </View>
                  {hasContent && (
                    <View style={s.dotRow}>
                      {dayTasks.slice(0, 3).map((t, i) => (
                        <View key={i} style={[s.dot, {
                          backgroundColor: isSelected ? "rgba(255,255,255,0.85)"
                            : t.priority === "HIGH"   ? colors.high
                            : t.priority === "MEDIUM" ? colors.medium
                            : colors.low,
                        }]} />
                      ))}
                      {dayEvents.slice(0, 2).map((ev, i) => (
                        <View key={`ev${i}`} style={[s.dot, s.dotCalendar, {
                          backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : (ev.color ?? colors.accent),
                        }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── Only day detail panel scrolls ── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Selected day panel ── */}
        <View style={s.panel}>
          {/* Panel header */}
          <View style={s.panelHeader}>
            <View>
              <Text style={s.panelDate}>
                {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE, MMMM d")}
              </Text>
              <Text style={s.panelSubtitle}>
                {selectedTasks.length + selectedEvents.length === 0
                  ? "Nothing scheduled"
                  : `${selectedTasks.length} task${selectedTasks.length !== 1 ? "s" : ""}${selectedEvents.length > 0 ? ` · ${selectedEvents.length} event${selectedEvents.length !== 1 ? "s" : ""}` : ""}`}
              </Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={handleAddTask} activeOpacity={0.7}>
              <Feather name="plus" size={14} color={colors.accent} />
              <Text style={s.addBtnText}>Add task</Text>
            </TouchableOpacity>
          </View>

          {/* Tasks due this day */}
          {selectedTasks.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionLabel}>TASKS DUE</Text>
              {selectedTasks.map((task, i) => (
                <TouchableOpacity
                  key={task.id}
                  style={[s.taskRow, i < selectedTasks.length - 1 && s.rowDivider]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); openAddTask(task); }}
                  activeOpacity={0.75}
                >
                  <TouchableOpacity
                    style={[s.completionCircle, task.completed && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                    onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); completeTask(task); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    {task.completed && <Feather name="check" size={11} color="#fff" />}
                  </TouchableOpacity>
                  <View style={[s.priorityStrip, {
                    backgroundColor: task.priority === "HIGH" ? colors.high : task.priority === "MEDIUM" ? colors.medium : colors.low,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskTitle, task.completed && s.taskDone]} numberOfLines={2}>{task.title}</Text>
                    {task.className && <Text style={s.taskMeta}>{task.className}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    {task.dueTime && <Text style={s.taskMeta}>{formatDueTime(task.dueTime)}</Text>}
                    <Feather name="chevron-right" size={14} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Calendar events this day */}
          {selectedEvents.length > 0 && (
            <View style={s.sectionCard}>
              <Text style={s.sectionLabel}>CALENDAR</Text>
              {selectedEvents.map((ev, i) => {
                const live = isEventNow(ev);
                return (
                  <View key={ev.id} style={[s.eventRow, live && s.eventRowLive, i < selectedEvents.length - 1 && s.rowDivider]}>
                    <View style={[s.eventStrip, { backgroundColor: ev.color ?? colors.accent }]} />
                    <View style={s.eventTimeCol}>
                      <Text style={[s.eventTime, live && { color: colors.accent }]}>
                        {ev.allDay ? "All day" : fmt(ev.startDate)}
                      </Text>
                      {!ev.allDay && <Text style={s.eventTimeEnd}>{fmt(ev.endDate)}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.taskTitle, live && { color: colors.accent }]} numberOfLines={1}>{ev.title}</Text>
                      {!!ev.location && <Text style={s.taskMeta} numberOfLines={1}>{ev.location}</Text>}
                    </View>
                    {live && (
                      <View style={[s.liveChip, { backgroundColor: ev.color ?? colors.accent }]}>
                        <Text style={s.liveText}>NOW</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Calendar permission prompts */}
          {status === "undetermined" && (
            <View style={s.permCard}>
              <View style={s.permIcon}><Feather name="calendar" size={22} color={colors.accent} /></View>
              <Text style={s.permTitle}>Connect your calendar</Text>
              <Text style={s.permSub}>See classes, meetings, and deadlines all in one place.</Text>
              <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
                <Text style={s.permBtnText}>Allow Calendar Access</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openAccountSettings} activeOpacity={0.7} style={{ marginTop: 10 }}>
                <Text style={s.permGhost}>Add Google or Outlook first →</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "denied" && (
            <View style={s.permCard}>
              <View style={[s.permIcon, { backgroundColor: colors.isDark ? colors.bgCard : "#F4F4F9" }]}>
                <Feather name="lock" size={22} color={colors.textMuted} />
              </View>
              <Text style={s.permTitle}>Calendar access off</Text>
              <Text style={s.permSub}>Settings → Planora → Calendars, then toggle on.</Text>
              <TouchableOpacity style={s.permBtn} onPress={openSettings} activeOpacity={0.85}>
                <Text style={s.permBtnText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "granted" && selectedTasks.length === 0 && selectedEvents.length === 0 && (
            <View style={s.emptyDay}>
              <Text style={s.emptyDayText}>Free day — tap "Add task" to get ahead</Text>
            </View>
          )}

          {sources.length > 0 && status === "granted" && (
            <Text style={s.sourcesLabel}>From: {sources.join(" · ")}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // ── Accent strip (fixed header) ──
  accentStrip: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  stripTopRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  stripTitle: { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: "#fff" },
  planBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10,
  },
  planBtnLabel: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: "#fff" },

  monthNav: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  monthArrow: {
    width: 32, height: 32, alignItems: "center", justifyContent: "center",
    borderRadius: 10, backgroundColor: "rgba(255,255,255,0.14)",
  },
  monthLabel: { fontSize: 16, fontFamily: "Outfit-Bold", color: "#fff" },
  todayPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2,
  },
  todayPillText: { fontSize: 11, fontFamily: "Outfit-Bold", color: "#fff" },

  weekHeaderRow: { flexDirection: "row", paddingHorizontal: 4, paddingTop: 6, marginBottom: 2 },
  weekDayLabel: {
    flex: 1, textAlign: "center",
    fontSize: 11, fontFamily: "Outfit-Bold",
    color: colors.textMuted, letterSpacing: 0.5,
  },

  // ── Grid (fixed, not in ScrollView) ──
  gridContainer: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FAFAFA",
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 8,
    marginTop: 10,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#E8E8F0",
  },
  weekRow: { flexDirection: "row" },
  dayCell: {
    flex: 1, height: 46, margin: 1,
    alignItems: "center", justifyContent: "center", paddingBottom: 2,
  },
  dayCellNumWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  dayCellNum: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  dayCellFaded: { color: colors.textMuted, opacity: 0.35 },
  dayCellSelected: { color: "#fff", fontFamily: "Outfit-Bold" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 2, justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotCalendar: { borderRadius: 1 },

  // ── Detail panel ──
  panel: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  panelHeader: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: spacing.md,
  },
  panelDate: { fontSize: 18, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  panelSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.accentGlow,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, marginTop: 2,
  },
  addBtnText: { fontSize: 13, fontFamily: "Outfit-SemiBold", color: colors.accent },

  sectionCard: {
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: 16, borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2",
    overflow: "hidden", marginBottom: spacing.md,
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    }),
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Outfit-ExtraBold",
    color: colors.textMuted, letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F0F0F8",
  },

  // Task row
  taskRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 12, gap: 10,
  },
  completionCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  priorityStrip: { width: 3, borderRadius: 2, alignSelf: "stretch", minHeight: 30 },
  taskTitle: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  taskDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  taskMeta: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },

  // Event row
  eventRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 11, paddingHorizontal: 12, gap: 10,
  },
  eventRowLive: { backgroundColor: colors.isDark ? colors.accent + "10" : colors.accent + "08" },
  eventStrip: { width: 3, borderRadius: 2, alignSelf: "stretch", minHeight: 30 },
  eventTimeCol: { width: 64, flexShrink: 0 },
  eventTime: { fontSize: 11, fontFamily: "Outfit-SemiBold", color: colors.textMuted },
  eventTimeEnd: { fontSize: 10, fontFamily: "Outfit-Regular", color: colors.textMuted, marginTop: 1 },
  liveChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexShrink: 0 },
  liveText: { fontSize: 9, fontFamily: "Outfit-Bold", color: "#fff", letterSpacing: 0.5 },

  // Permission / empty
  permCard: {
    alignItems: "center", paddingTop: 32, paddingHorizontal: 24, paddingBottom: 24,
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: 20, borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2", marginBottom: spacing.md,
  },
  permIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  permTitle: { fontSize: 18, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, textAlign: "center", marginBottom: 8 },
  permSub: { fontSize: 13, fontFamily: "Outfit-Regular", color: colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: 24 },
  permBtn: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  permBtnText: { fontSize: 14, fontFamily: "Outfit-Bold", color: "#fff" },
  permGhost: { fontSize: 13, fontFamily: "Outfit-Medium", color: colors.accent },

  emptyDay: { paddingVertical: 24, alignItems: "center" },
  emptyDayText: { fontSize: 13, fontFamily: "Outfit-Regular", color: colors.textMuted, fontStyle: "italic" },
  sourcesLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted, textAlign: "center", marginTop: 8 },
});
