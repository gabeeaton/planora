import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { format, isWithinInterval } from "date-fns";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/ThemeContext";
import { spacing } from "../utils/theme";

const fmtTime = (d) => {
  try { return format(new Date(d), "h:mm a").replace(":00 ", " "); }
  catch { return ""; }
};

const fmtDate = (d) => {
  try { return format(new Date(d), "EEE, MMM d"); }
  catch { return ""; }
};

const isNow = (ev) => {
  try { return isWithinInterval(new Date(), { start: new Date(ev.startDate), end: new Date(ev.endDate) }); }
  catch { return false; }
};

const EventPill = ({ ev, showDate }) => {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const live = isNow(ev);
  const pillColor = ev.color ?? colors.accent;

  const timeLabel = ev.allDay
    ? (showDate ? fmtDate(ev.startDate) : "All day")
    : showDate
      ? `${fmtDate(ev.startDate)} · ${fmtTime(ev.startDate)}`
      : fmtTime(ev.startDate);

  return (
    <View style={[s.pill, live && { borderColor: pillColor, backgroundColor: colors.isDark ? pillColor + "14" : pillColor + "10" }]}>
      <View style={[s.pillStrip, { backgroundColor: pillColor }]} />
      <View style={s.pillContent}>
        <Text style={[s.pillTitle, live && { color: pillColor }]} numberOfLines={1}>{ev.title}</Text>
        <Text style={[s.pillTime, live && { color: pillColor, opacity: 0.8 }]} numberOfLines={1}>{timeLabel}</Text>
      </View>
      {live && (
        <View style={[s.liveTag, { backgroundColor: pillColor }]}>
          <Text style={s.liveTagText}>NOW</Text>
        </View>
      )}
    </View>
  );
};

export default function TodaySchedule({ events = [], view = "today", onToggleView, onSeeAll }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const hasToday    = view === "today";
  const showEmpty   = events.length === 0;

  return (
    <View style={s.wrap}>
      <View style={s.headerRow}>
        {/* Toggle */}
        {onToggleView && (
          <View style={[s.toggle, { backgroundColor: colors.isDark ? colors.bgCard : "#F0F0F6", borderColor: colors.border }]}>
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

        {onSeeAll && !onToggleView && (
          <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); onSeeAll(); }} activeOpacity={0.7}>
            <Text style={[s.seeAll, { color: colors.accent }]}>See all →</Text>
          </TouchableOpacity>
        )}
      </View>

      {showEmpty ? (
        <Text style={[s.empty, { color: colors.textMuted }]}>
          {hasToday ? "Nothing scheduled for today." : "No upcoming events in the next week."}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollRow}>
          {events.slice(0, 12).map((ev) => (
            <EventPill key={ev.id} ev={ev} showDate={!hasToday} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { marginBottom: 0 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  toggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    padding: 2,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: "Outfit-SemiBold",
  },
  seeAll: { fontSize: 13, fontFamily: "Outfit-SemiBold" },
  empty: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    paddingVertical: 8,
  },
  scrollRow: { gap: 10, paddingRight: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.isDark ? colors.bgCard : "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2",
    overflow: "hidden",
    minWidth: 140,
    maxWidth: 220,
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  pillStrip: { width: 4, alignSelf: "stretch", minHeight: 56 },
  pillContent: { flex: 1, paddingHorizontal: 11, paddingVertical: 12 },
  pillTitle: { fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: 3 },
  pillTime:  { fontSize: 12, fontFamily: "Outfit-Medium", color: colors.textMuted },
  liveTag: { paddingHorizontal: 6, paddingVertical: 3, marginRight: 8, borderRadius: 5, flexShrink: 0 },
  liveTagText: { fontSize: 10, fontFamily: "Outfit-Bold", color: "#fff", letterSpacing: 0.6 },
});
