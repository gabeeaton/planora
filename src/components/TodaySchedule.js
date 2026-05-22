import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { format, isWithinInterval, differenceInMinutes } from "date-fns";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../utils/ThemeContext";
import { spacing, radius } from "../utils/theme";

const MAX_VISIBLE = 4;

const fmtTime = (d) => {
  try { return format(new Date(d), "h:mm a").replace(":00 ", " "); }
  catch { return ""; }
};

const fmtDate = (d) => {
  try { return format(new Date(d), "M/d"); }
  catch { return ""; }
};

const isNow = (ev) => {
  try { return isWithinInterval(new Date(), { start: new Date(ev.startDate), end: new Date(ev.endDate) }); }
  catch { return false; }
};

const getDuration = (ev) => {
  try {
    const mins = differenceInMinutes(new Date(ev.endDate), new Date(ev.startDate));
    if (mins <= 0 || mins > 60 * 24) return null;
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  } catch { return null; }
};

const EventRow = ({ ev, showDate, isLast }) => {
  const { colors } = useTheme();
  const live = isNow(ev);
  const dotColor = ev.color ?? colors.accent;
  const duration = getDuration(ev);

  const timeStr = ev.allDay
    ? (showDate ? fmtDate(ev.startDate) : "All day")
    : showDate
      ? fmtDate(ev.startDate)
      : fmtTime(ev.startDate);

  return (
    <View style={[s.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {/* Time column */}
      <View style={s.timeCol}>
        <Text style={[s.timeText, { color: live ? dotColor : colors.textMuted }]} numberOfLines={1}>
          {timeStr}
        </Text>
        {showDate && !ev.allDay && (
          <Text style={[s.timeSmall, { color: colors.textMuted }]} numberOfLines={1}>
            {fmtTime(ev.startDate)}
          </Text>
        )}
      </View>

      {/* Color indicator */}
      <View style={[s.dot, { backgroundColor: dotColor }]}>
        {live && <View style={[s.dotPulse, { backgroundColor: dotColor }]} />}
      </View>

      {/* Content */}
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.textPrimary }, live && { color: dotColor }]} numberOfLines={1}>
            {ev.title}
          </Text>
          {live && (
            <View style={[s.nowBadge, { backgroundColor: dotColor + "22", borderColor: dotColor + "55" }]}>
              <Text style={[s.nowText, { color: dotColor }]}>NOW</Text>
            </View>
          )}
        </View>
        {(ev.calendar || duration) && (
          <Text style={[s.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {[ev.calendar, duration].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
    </View>
  );
};

export default function TodaySchedule({ events = [], view = "today", onToggleView, onSeeAll }) {
  const { colors } = useTheme();
  const hasToday  = view === "today";
  const visible   = events.slice(0, MAX_VISIBLE);
  const overflow  = events.length - MAX_VISIBLE;

  return (
    <View style={[s.card, {
      backgroundColor: colors.isDark ? colors.bgCard : "#fff",
      borderColor: colors.isDark ? colors.border : "transparent",
      ...(colors.isDark ? {} : {
        shadowColor: "#6B6B8A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 10,
        elevation: 4,
      }),
    }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Feather name="calendar" size={14} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Schedule</Text>
        </View>
        <View style={s.headerRight}>
          {onToggleView && (
            <View style={[s.toggle, { backgroundColor: colors.isDark ? "rgba(255,255,255,0.07)" : "#F0F0F6", borderColor: colors.border }]}>
              {["today", "upcoming"].map((v) => {
                const active = view === v;
                return (
                  <TouchableOpacity
                    key={v}
                    style={[s.toggleBtn, active && { backgroundColor: colors.accent }]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); onToggleView(v); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.toggleText, { color: active ? "#fff" : colors.textMuted }]}>
                      {v === "today" ? "Today" : "Upcoming"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {onSeeAll && (
            <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); onSeeAll(); }} activeOpacity={0.7} style={{ marginLeft: 8 }}>
              <Text style={[s.seeAll, { color: colors.accent }]}>See all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Events */}
      {events.length === 0 ? (
        <View style={s.emptyWrap}>
          <Feather name="calendar" size={20} color={colors.textMuted} style={{ opacity: 0.4, marginBottom: 6 }} />
          <Text style={[s.emptyText, { color: colors.textMuted }]}>
            {hasToday ? "Nothing scheduled today" : "Nothing coming up this week"}
          </Text>
        </View>
      ) : (
        <View>
          {visible.map((ev, i) => (
            <EventRow key={ev.id} ev={ev} showDate={!hasToday} isLast={i === visible.length - 1 && overflow <= 0} />
          ))}
          {overflow > 0 && onSeeAll && (
            <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); onSeeAll(); }} style={s.moreBtn} activeOpacity={0.7}>
              <Text style={[s.moreText, { color: colors.accent }]}>+{overflow} more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerLeft:   { flexDirection: "row", alignItems: "center" },
  headerRight:  { flexDirection: "row", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Outfit-Bold", letterSpacing: 0.2 },
  toggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    padding: 3,
    gap: 3,
  },
  toggleBtn:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleText: { fontSize: 13, fontFamily: "Outfit-SemiBold" },
  seeAll:     { fontSize: 13, fontFamily: "Outfit-SemiBold" },

  // Event rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  timeCol: { width: 52, alignItems: "flex-end" },
  timeText: { fontSize: 13, fontFamily: "Outfit-SemiBold", textAlign: "right" },
  timeSmall: { fontSize: 11, fontFamily: "Outfit-Regular", textAlign: "right", marginTop: 1 },
  dot: {
    width: 9, height: 9, borderRadius: 5,
    flexShrink: 0,
    position: "relative",
  },
  dotPulse: {
    position: "absolute",
    width: 16, height: 16, borderRadius: 8,
    top: -3.5, left: -3.5,
    opacity: 0.25,
  },
  content:  { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title:    { fontSize: 15, fontFamily: "Outfit-SemiBold", flex: 1 },
  meta:     { fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 2 },
  nowBadge: {
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    flexShrink: 0,
  },
  nowText: { fontSize: 9, fontFamily: "Outfit-Bold", letterSpacing: 0.6 },

  // Empty
  emptyWrap: { alignItems: "center", paddingVertical: 22 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular" },

  // Overflow
  moreBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  moreText: { fontSize: 12, fontFamily: "Outfit-SemiBold" },
});
