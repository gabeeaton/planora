import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { spacing, radius } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import { Feather } from "@expo/vector-icons";


const makeStyles = (colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    paddingBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: { padding: 4 },
  navDisabled: { opacity: 0.3 },
  monthTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  // Week header row — mirrors grid row exactly
  weekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 20,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  // Each row is a flex row — cells use flex:1 so they're equally spaced
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
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  cellPast: {
    opacity: 0.25,
  },
  cellText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "400",
    textAlign: "center",
  },
  cellTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cellTextToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  cellTextPast: {
    color: colors.textMuted,
  },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 12,
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
    fontWeight: "600",
  },
});

const MONTHS = ["January","February","March","April","May","June",
                 "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// Fixed cell size — 7 cells + 8px padding on each side + 6 gaps of 2px = grid width
// We keep it simple: CELL px square, no gap between cells, horizontal padding = (containerWidth - 7*CELL) / 2
// Instead, we just let the grid be full width and use flex, but with explicit width+height (not aspectRatio)
const CELL = 40;

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

  // Build grid: empty cells + day numbers
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={prevMonth}
          disabled={!canGoPrev}
          style={[styles.navBtn, !canGoPrev && styles.navDisabled]}
        >
          <Feather name="chevron-left" size={20} color={canGoPrev ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>

        <TouchableOpacity
          onPress={nextMonth}
          disabled={!canGoNext}
          style={[styles.navBtn, !canGoNext && styles.navDisabled]}
        >
          <Feather name="chevron-right" size={20} color={canGoNext ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels — one per column, matching grid columns */}
      <View style={styles.weekRow}>
        {DAYS.map((d) => (
          <View key={d} style={styles.weekCell}>
            <Text style={styles.weekLabel}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid — rows of 7 */}
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
                onPress={() => selectDay(day)}
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
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Clear button */}
      <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
        <Feather name="x-circle" size={15} color="#FF6B6B" />
        <Text style={styles.clearText}>No due date</Text>
      </TouchableOpacity>
    </View>
  );
};


export default DatePicker;