// ============================================================
// QuickAddPopup.js — Modal bottom sheet, matches TaskModal fields
// dueDate and dueTime stored separately to match createTask contract
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Keyboard, ScrollView, Platform, Modal,
  KeyboardAvoidingView, TouchableWithoutFeedback, LayoutAnimation, UIManager,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/ThemeContext";
import { useUserProfile } from "../hooks/useUserProfile";
import { spacing, radius } from "../utils/theme";
import DatePicker from "./DatePicker";
import { addDays, startOfDay, format } from "date-fns";

const DUE_CHIPS = [
  { label: "Today",     getValue: () => startOfDay(new Date()) },
  { label: "Tomorrow",  getValue: () => startOfDay(addDays(new Date(), 1)) },
  { label: "In 3 days", getValue: () => startOfDay(addDays(new Date(), 3)) },
  { label: "Next week", getValue: () => startOfDay(addDays(new Date(), 7)) },
  { label: "Custom…",   getValue: () => null },
];

const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_META = (colors) => ({
  HIGH:   { color: colors.high,   label: "High",   icon: "chevrons-up" },
  MEDIUM: { color: colors.medium, label: "Medium", icon: "minus"       },
  LOW:    { color: colors.low,    label: "Low",    icon: "chevrons-down"},
});

const RECURRENCE_OPTIONS = [
  { value: "none",     label: "Once"     },
  { value: "daily",    label: "Daily"    },
  { value: "weekly",   label: "Weekly"   },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly",  label: "Monthly"  },
];

const fmt12 = (h, m) => {
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function QuickAddPopup({ visible, onClose, onSave }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useUserProfile();
  const s = makeStyles(colors);

  const [modalVisible, setModalVisible]       = useState(false);
  const [title,        setTitle]              = useState("");
  const [description,  setDescription]        = useState("");
  const [showDesc,     setShowDesc]           = useState(false);
  const [className,    setClassName]          = useState(null);
  const [classId,      setClassId]            = useState(null);
  const [customClass,  setCustomClass]        = useState("");
  const [showCustom,   setShowCustom]         = useState(false);
  const [priority,     setPriority]           = useState("MEDIUM");
  const [recurrence,   setRecurrence]         = useState("none");
  const [dueChip,      setDueChip]            = useState(null);
  const [customDate,   setCustomDate]         = useState(null);
  const [showCal,      setShowCal]            = useState(false);
  const [dueTime,      setDueTime]            = useState(null);
  const [showTime,     setShowTime]           = useState(false);
  const [saving,       setSaving]             = useState(false);

  const titleRef  = useRef(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Profile classes
  const profileClassObjects = (profile?.classes ?? []).filter(Boolean);
  const profileClasses = profileClassObjects.map((c) => c.name || c.className || c).filter(Boolean);
  const classes = [...profileClasses, "Other"];

  const reset = () => {
    setTitle(""); setDescription(""); setShowDesc(false);
    setClassName(null); setClassId(null); setCustomClass(""); setShowCustom(false);
    setPriority("MEDIUM"); setRecurrence("none");
    setDueChip(null); setCustomDate(null); setShowCal(false);
    setDueTime(null); setShowTime(false); setSaving(false);
  };

  // Open: show modal then animate in
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      reset();
    }
  }, [visible]);

  useEffect(() => {
    if (modalVisible && visible) {
      slideAnim.setValue(600);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [modalVisible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

  // Resolved due date
  const resolvedDueDate = (() => {
    if (dueChip === null) return null;
    const chip = DUE_CHIPS[dueChip];
    if (chip.label === "Custom…") return customDate;
    return chip.getValue();
  })();

  const handleChipPress = (idx) => {
    Haptics.selectionAsync().catch(() => {});
    if (dueChip === idx) {
      setDueChip(null); setCustomDate(null); setShowCal(false);
      setDueTime(null); setShowTime(false);
      return;
    }
    setDueChip(idx);
    const isCustom = DUE_CHIPS[idx].label === "Custom…";
    setShowCal(isCustom);
    if (!isCustom) setShowCal(false);
  };

  const handleClassPress = (cls) => {
    Haptics.selectionAsync().catch(() => {});
    if (cls === "Other") {
      setClassName(null); setClassId(null);
      setShowCustom((v) => !v);
      if (showCustom) setCustomClass("");
    } else {
      const deselect = className === cls;
      setClassName(deselect ? null : cls);
      const obj = profileClassObjects.find((c) => (c.name || c.className) === cls);
      setClassId(deselect ? null : (obj?.id ?? obj?.classId ?? null));
      setShowCustom(false); setCustomClass("");
    }
  };

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    const finalClassName = showCustom ? (customClass.trim() || null) : className;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await onSave({
        title:       trimmed,
        description: description.trim() || null,
        className:   finalClassName,
        classId:     showCustom ? null : classId,
        priority,
        recurrence:  recurrence === "none" ? null : recurrence,
        dueDate:     resolvedDueDate ?? null,
        dueTime:     resolvedDueDate ? dueTime : null,
        completed:   false,
      });
    } finally {
      setSaving(false);
    }
    handleClose();
  }, [title, description, className, classId, customClass, showCustom, priority, recurrence, resolvedDueDate, dueTime, onSave, handleClose]);

  // Time picker value as Date
  const timePickerDate = (() => {
    const d = new Date();
    if (dueTime) { d.setHours(dueTime[0], dueTime[1], 0, 0); }
    else { d.setHours(9, 0, 0, 0); }
    return d;
  })();

  const pMeta = PRIORITY_META(colors);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.kavContainer}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={s.handle} />

          {/* Header row */}
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>New Task</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {/* Title */}
            <TextInput
              ref={titleRef}
              style={[s.titleInput, { color: colors.textPrimary }]}
              placeholder="What do you need to do?"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoCorrect={false}
              maxLength={140}
            />

            {/* Notes toggle / field */}
            {!showDesc ? (
              <TouchableOpacity
                style={s.addNotesRow}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowDesc(true);
                }}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={13} color={colors.textMuted} />
                <Text style={s.addNotesText}>Add notes</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={[s.notesInput, { color: colors.textPrimary }]}
                placeholder="Notes…"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            )}

            {/* Section: Class */}
            <Text style={s.sectionLabel}>CLASS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {classes.map((cls) => {
                const isOther = cls === "Other";
                const active  = isOther ? showCustom : className === cls;
                return (
                  <TouchableOpacity
                    key={cls}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => handleClassPress(cls)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{cls}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {showCustom && (
              <TextInput
                style={[s.customClassInput, { color: colors.textPrimary }]}
                placeholder="Class name…"
                placeholderTextColor={colors.textMuted}
                value={customClass}
                onChangeText={setCustomClass}
                autoCorrect={false}
                maxLength={60}
              />
            )}

            {/* Section: Priority */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>PRIORITY</Text>
            <View style={s.priorityRow}>
              {PRIORITIES.map((p) => {
                const meta   = pMeta[p];
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      s.priorityBtn,
                      active && { backgroundColor: meta.color + "18", borderColor: meta.color },
                    ]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setPriority(p); }}
                    activeOpacity={0.7}
                  >
                    <Feather name={meta.icon} size={13} color={active ? meta.color : colors.textMuted} />
                    <Text style={[s.priorityText, active && { color: meta.color, fontFamily: "Outfit-Bold" }]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section: Due date */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>DUE DATE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {DUE_CHIPS.map((chip, i) => {
                const active = dueChip === i;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => handleChipPress(i)}
                    activeOpacity={0.7}
                  >
                    {chip.label === "Custom…" && (
                      <Feather name="calendar" size={11} color={active ? colors.accent : colors.textMuted} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Inline date picker for custom */}
            {showCal && (
              <View style={{ marginBottom: 8 }}>
                <DatePicker
                  value={customDate}
                  onChange={(d) => { setCustomDate(d); Haptics.selectionAsync().catch(() => {}); }}
                  onClear={() => { setCustomDate(null); setDueChip(null); setShowCal(false); setDueTime(null); setShowTime(false); }}
                />
              </View>
            )}

            {/* Time section — shown when a date is selected */}
            {resolvedDueDate !== null && (
              <View style={s.timeSection}>
                <TouchableOpacity
                  style={[s.timeToggle, showTime && { borderColor: colors.accent, backgroundColor: colors.accentGlow }]}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowTime((v) => !v); if (showTime) setDueTime(null); }}
                  activeOpacity={0.7}
                >
                  <Feather name="clock" size={13} color={showTime ? colors.accent : colors.textMuted} />
                  <Text style={[s.timeToggleText, showTime && { color: colors.accent, fontFamily: "Outfit-SemiBold" }]}>
                    {dueTime ? fmt12(dueTime[0], dueTime[1]) : "Add time"}
                  </Text>
                  {showTime && (
                    <Feather name="x" size={12} color={colors.accent} style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>

                {showTime && (
                  <DateTimePicker
                    value={timePickerDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, date) => {
                      if (Platform.OS === "android") setShowTime(false);
                      if (date) setDueTime([date.getHours(), date.getMinutes()]);
                    }}
                    style={s.timePicker}
                    textColor={colors.textPrimary}
                  />
                )}
              </View>
            )}

            {/* Section: Repeat */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>REPEAT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[s.chipRow, { marginBottom: 8 }]}
              keyboardShouldPersistTaps="handled"
            >
              {RECURRENCE_OPTIONS.map((opt) => {
                const active = recurrence === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setRecurrence(opt.value); }}
                    activeOpacity={0.7}
                  >
                    {opt.value !== "none" && (
                      <Feather name="repeat" size={10} color={active ? colors.accent : colors.textMuted} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={[
              s.saveBtn,
              { backgroundColor: title.trim() ? colors.accent : colors.isDark ? colors.bgCard : "#EBEBF0" },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color={title.trim() ? "#fff" : colors.textMuted} />
            <Text style={[s.saveBtnText, { color: title.trim() ? "#fff" : colors.textMuted }]}>
              {saving ? "Adding…" : "Add Task"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kavContainer: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: colors.isDark ? 1 : 0,
    borderColor: colors.isDark ? colors.border : "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    maxHeight: "88%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.isDark ? colors.border : "#D0D0DC",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  titleInput: {
    fontSize: 20,
    fontFamily: "Outfit-SemiBold",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#E0E0EA",
    marginBottom: 4,
  },
  addNotesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addNotesText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: colors.textMuted,
  },
  notesInput: {
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#D8D8E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    minHeight: 72,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Outfit-ExtraBold",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 4,
    paddingRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#D8D8E0",
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
  },
  chipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Outfit-SemiBold",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
    fontFamily: "Outfit-Bold",
  },
  customClassInput: {
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#D8D8E0",
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
  },
  priorityText: {
    fontSize: 13,
    fontFamily: "Outfit-SemiBold",
    color: colors.textMuted,
  },
  timeSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  timeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#D8D8E0",
    backgroundColor: colors.isDark ? colors.bgInput : "#F5F5F7",
  },
  timeToggleText: {
    fontSize: 13,
    fontFamily: "Outfit-SemiBold",
    color: colors.textMuted,
  },
  timePicker: {
    marginTop: 4,
    alignSelf: "stretch",
    height: 120,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Outfit-Bold",
  },
});
