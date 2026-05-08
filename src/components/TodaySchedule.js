// ============================================================
// src/components/TodaySchedule.js
// Shows today's Apple Calendar events as a timeline strip
// on the Dashboard. Only visible when permission is granted
// and there are events.
// ============================================================

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useTheme } from "../utils/ThemeContext";
import { spacing, radius } from "../utils/theme";
import * as Calendar from "expo-calendar";

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  return format(new Date(dateStr), "h:mm a").replace(":00", "");
};

const isHappening = (event) => {
  const now = new Date();
  return isWithinInterval(now, {
    start: new Date(event.startDate),
    end:   new Date(event.endDate),
  });
};

export default function TodaySchedule({ events, permission, onRequestPermission }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  // Not yet asked / denied
  if (permission !== "granted") {
    return (
      <TouchableOpacity style={s.permissionRow} onPress={onRequestPermission} activeOpacity={0.75}>
        <View style={s.permIconWrap}>
          <Feather name="calendar" size={14} color={colors.accent} />
        </View>
        <Text style={s.permText}>Add your calendar</Text>
        <Feather name="chevron-right" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  // Granted but nothing today
  if (events.length === 0) return null;

  return (
    <View style={s.container}>
      <Text style={s.label}>TODAY'S SCHEDULE</Text>
      <View style={s.card}>
        {events.map((ev, i) => {
          const now      = isHappening(ev);
          const allDay   = ev.allDay;
          const timeStr  = allDay ? "All day" : `${formatTime(ev.startDate)} – ${formatTime(ev.endDate)}`;
          const last     = i === events.length - 1;

          return (
            <View
              key={ev.id}
              style={[s.row, !last && s.rowBorder]}
            >
              {/* Time indicator */}
              <View style={s.timeCol}>
                <Text style={[s.time, now && s.timeNow]}>{timeStr}</Text>
                {now && <View style={s.nowDot} />}
              </View>

              {/* Event details */}
              <View style={s.details}>
                <Text style={[s.title, now && s.titleNow]} numberOfLines={1}>
                  {ev.title}
                </Text>
                {ev.location ? (
                  <Text style={s.location} numberOfLines={1}>{ev.location}</Text>
                ) : null}
              </View>

              {/* Calendar color dot */}
              {ev.color ? (
                <View style={[s.calDot, { backgroundColor: ev.color }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  label: {
    fontSize: 11,
    fontFamily: "Outfit-ExtraBold",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F0F0F8",
  },
  timeCol: {
    width: 80,
    alignItems: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  time: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: colors.textMuted,
  },
  timeNow: {
    color: colors.accent,
    fontFamily: "Outfit-SemiBold",
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  details: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Outfit-SemiBold",
    color: colors.textPrimary,
  },
  titleNow: {
    color: colors.accent,
  },
  location: {
    fontSize: 11,
    fontFamily: "Outfit-Regular",
    color: colors.textMuted,
    marginTop: 1,
  },
  calDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },

  // Permission prompt
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#EBEBF2",
    borderStyle: "dashed",
  },
  permIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  permText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit-Medium",
    color: colors.textSecondary,
  },
});
