// ============================================================
// src/components/NotificationPermissionPrompt.js
//
// Shown once, after the user has created or imported their first tasks.
// Explains the value of notifications before asking permission —
// "explxain before you ask" dramatically improves grant rates.
//
// Usage in DashboardScreen:
//   <NotificationPermissionPrompt
//     visible={showNotifPrompt}
//     onDismiss={() => setShowNotifPrompt(false)}
//   />
// ============================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestNotificationPermissions } from "../services/notifications";

export const NOTIF_PROMPT_KEY = "@tf_notif_prompt_shown";

const BENEFITS = [
  { icon: "bell",           text: "Reminder 24 hours before every deadline" },
  { icon: "alert-triangle", text: "⚠️ 2-hour warning for high-priority tasks" },
  { icon: "bar-chart-2",    text: "Weekly summary every Sunday at 7pm" },
];

const makeStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    paddingTop: spacing.md,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: "center", marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accentGlow,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: spacing.md,
    ...shadows.accent,
  },
  title: {
    fontSize: 22, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
    textAlign: "center", letterSpacing: -0.3, marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14, color: colors.textSecondary, textAlign: "center",
    lineHeight: 20, marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginBottom: spacing.sm,
  },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1, fontSize: 14, color: colors.textPrimary,
    fontFamily: "Outfit-Medium", lineHeight: 19,
  },
  divider: {
    height: 1, backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  allowBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: spacing.sm,
    ...shadows.accent,
  },
  allowBtnText: {
    color: "#fff", fontSize: 16, fontFamily: "Outfit-ExtraBold",
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  skipBtnText: {
    fontSize: 13, color: colors.textMuted,
  },
});

const NotificationPermissionPrompt = ({ visible, onDismiss }) => {
  const { colors }   = useTheme();
  const styles       = makeStyles(colors);
  const [loading, setLoading] = useState(false);
  const allowScale   = useRef(new Animated.Value(1)).current;
  const onAllowIn  = () => Animated.spring(allowScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onAllowOut = () => Animated.spring(allowScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const handleAllow = async () => {
    setLoading(true);
    try {
      const granted = await requestNotificationPermissions();
      if (granted) {
        // Weekly summary is scheduled automatically by useTasks when tasks load
      }
    } catch (err) {
      console.warn("Notification setup error:", err);
    } finally {
      // Mark as shown regardless of outcome — don't ask twice
      await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "true").catch(() => {});
      setLoading(false);
      onDismiss();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "true").catch(() => {});
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <Feather name="bell" size={28} color={colors.accent} />
          </View>

          <Text style={styles.title}>Never miss a deadline</Text>
          <Text style={styles.subtitle}>
            Planora can remind you before things are due — so you're never caught off guard.
          </Text>

          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Feather name={b.icon} size={16} color={colors.accent} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <Animated.View style={{ transform: [{ scale: allowScale }] }}>
            <TouchableOpacity
              style={[styles.allowBtn, loading && { opacity: 0.7 }]}
              onPress={handleAllow}
              onPressIn={onAllowIn}
              onPressOut={onAllowOut}
              disabled={loading}
              activeOpacity={1}
            >
              <Feather name="bell" size={18} color="#fff" />
              <Text style={styles.allowBtnText}>
                {loading ? "Setting up..." : "Turn on reminders"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Not right now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default NotificationPermissionPrompt;