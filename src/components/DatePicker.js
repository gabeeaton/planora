import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const tap = () => Haptics.selectionAsync().catch(() => {});

const CELL = 44;

const makeStyles = (colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    paddingBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthTitle: {
    fontSize: 15,
    fontFamily: "Outfit-Bold",
    color: colors.textPrimary,
  },
  yearText: {
    color: colors.textSecondary,
    fontFamily: "Outfit-Regular",
  },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.isDark ? colors.bgElevated : "#F0F0F5",
  },
  navDisabled: { opacity: 0.3 },
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 20,
  },
  weekLabel: {
    fontSize: 11,
    fontFamily: "Outfit-SemiBold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  gridRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    height: CELL,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CELL / 2,
  },
  cellSelected: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  cellToday: {
    backgroundColor: colors.accentGlow,
  },
  cellPast: {
    opacity: 0.22,
  },
  cellText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: "Outfit-Medium",
    textAlign: "center",
  },
  cellTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Outfit-Bold",
  },
  cellTextToday: {
    color: colors.accent,
    fontFamily: "Outfit-Bold",
  },
  cellTextPast: {
    color: colors.textMuted,
  },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  clearText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontFamily: "Outfit-SemiBold",
  },
});

const MONTHS = ["January","February","March","April","May","June",
                 "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

const DatePicker = ({ value, onChange, onClear }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initial = value ? new Date(value) : new Date(today);
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());

  const selected = value ? new Date(value) : null;
  if (selected) selected.setHours(0, 0, 0, 0);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewMonth, viewYear);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  const canGoPrev = !(viewYear === todayYear && viewMonth === todayMonth);
  const canGoNext = !(viewYear === todayYear + 5 && viewMonth === 11);

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day) => {
    const date = new Date(viewYear, viewMonth, day);
    date.setHours(0, 0, 0, 0);
    if (date < today) return;
    onChange(date);
  };

  const isSelected = (day) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const isPast = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isToday = (day) =>
    todayYear === viewYear &&
    todayMonth === viewMonth &&
    today.getDate() === day;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { tap(); prevMonth(); }}
          disabled={!canGoPrev}
          style={[styles.navBtn, !canGoPrev && styles.navDisabled]}
        >
          <Feather name="chevron-left" size={18} color={canGoPrev ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>
          {MONTHS[viewMonth]}{" "}
          <Text style={styles.yearText}>{viewYear}</Text>
        </Text>

        <TouchableOpacity
          onPress={() => { tap(); nextMonth(); }}
          disabled={!canGoNext}
          style={[styles.navBtn, !canGoNext && styles.navDisabled]}
        >
          <Feather name="chevron-right" size={18} color={canGoNext ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.weekRow}>
        {DAYS.map((d) => (
          <View key={d} style={styles.weekCell}>
            <Text style={styles.weekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
            if (!day) return <View key={colIdx} style={styles.cell} />;
            const past = isPast(day);
            const sel = isSelected(day);
            const tod = isToday(day);
            return (
              <TouchableOpacity
                key={colIdx}
                style={[
                  styles.cell,
                  sel && styles.cellSelected,
                  tod && !sel && styles.cellToday,
                  past && styles.cellPast,
                ]}
                onPress={() => { tap(); selectDay(day); }}
                disabled={past}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cellText,
                  sel && styles.cellTextSelected,
                  tod && !sel && styles.cellTextToday,
                  past && styles.cellTextPast,
                ]}>
                  {day}
                </Text>
                {tod && !sel && <View style={styles.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Clear button */}
      <TouchableOpacity onPress={() => { tap(); onClear(); }} style={styles.clearBtn}>
        <Feather name="x-circle" size={15} color="#FF6B6B" />
        <Text style={styles.clearText}>Task has no due date</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DatePicker;
