// ============================================================
// src/components/CompletionShareSheet.js
// Slides up after task completion on streak milestones.
// Uses absolute View (not Modal) so Share.share() doesn't conflict.
// ============================================================

import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Share,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../utils/ThemeContext";
import { spacing, radius } from "../utils/theme";

// ── Visual preview card ───────────────────────────────────────
const ShareCard = ({ task, streak, accentColor }) => {
  const title     = task?.title ?? "Task complete";
  const className = typeof task?.className === "string" ? task.className
                  : task?.className?.name ?? null;
  return (
    <View style={card.root}>
      <View style={[card.strip, { backgroundColor: accentColor }]} />
      <View style={card.body}>
        <View style={[card.checkWrap, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}>
          <Feather name="check" size={26} color={accentColor} />
        </View>
        <Text style={card.title} numberOfLines={3}>{title}</Text>
        <View style={card.chipsRow}>
          {className ? (
            <View style={[card.chip, { backgroundColor: accentColor + "22", borderColor: accentColor + "44" }]}>
              <Text style={[card.chipText, { color: accentColor }]}>{className}</Text>
            </View>
          ) : null}
          {streak > 0 && (
            <View style={card.streakChip}>
              <Text style={card.streakText}>🔥 {streak}-day streak</Text>
            </View>
          )}
        </View>
      </View>
      <View style={card.footer}>
        <View style={card.footerLine} />
        <Text style={card.footerBrand}>PLANORA</Text>
      </View>
    </View>
  );
};

const card = StyleSheet.create({
  root:       { width: 300, backgroundColor: "#13131A", borderRadius: 20, overflow: "hidden" },
  strip:      { height: 4, width: "100%" },
  body:       { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20 },
  checkWrap:  { width: 56, height: 56, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title:      { fontSize: 18, fontFamily: "Outfit-ExtraBold", color: "#F0F0FF", textAlign: "center", lineHeight: 25, marginBottom: 16 },
  chipsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  chip:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText:   { fontSize: 12, fontFamily: "Outfit-SemiBold" },
  streakChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(255,179,0,0.15)", borderWidth: 1, borderColor: "rgba(255,179,0,0.3)" },
  streakText: { fontSize: 12, fontFamily: "Outfit-SemiBold", color: "#FFB300" },
  footer:     { alignItems: "center", paddingBottom: 20, paddingTop: 4, paddingHorizontal: 24 },
  footerLine: { width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 12 },
  footerBrand:{ fontSize: 10, fontFamily: "Outfit-ExtraBold", color: "rgba(255,255,255,0.25)", letterSpacing: 2 },
});

// ── Sheet ─────────────────────────────────────────────────────
export default function CompletionShareSheet({ task, streak, onDismiss }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const slideAnim  = useRef(new Animated.Value(500)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const shareScale = useRef(new Animated.Value(1)).current;
  const dismissed  = useRef(false);
  const timerRef   = useRef(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(dismiss, 8000);
    return () => clearTimeout(timerRef.current);
  }, []);

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 500, duration: 200, useNativeDriver: true }),
    ]).start();
    // Always call onDismiss after animation — don't rely solely on .start() callback
    setTimeout(() => onDismiss?.(), 220);
  };

  const handleShare = async () => {
    clearTimeout(timerRef.current); // cancel auto-dismiss while share sheet is open
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const title     = task?.title ?? "a task";
    const className = typeof task?.className === "string" ? task.className
                    : task?.className?.name ?? null;
    const streakLine = streak > 0 ? ` 🔥 ${streak}-day streak` : "";
    const classLine  = className ? ` · ${className}` : "";
    const message = `Just finished "${title}"${classLine}${streakLine}\n\nStaying on top of everything with Planora — the AI planner built for college. planora.app`;
    try {
      await Share.share({ message });
    } catch {
      // cancelled
    }
    dismiss();
  };

  const styles = makeStyles(colors, insets);

  return (
    // Absolute overlay — avoids Modal-on-Modal conflict with Share.share() on iOS
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Nice work! 🎉</Text>
        <Text style={styles.sheetSub}>Share your win with friends.</Text>
        <View style={styles.cardWrap}>
          <ShareCard task={task} streak={streak} accentColor={colors.accent} />
        </View>
        <Animated.View style={{ transform: [{ scale: shareScale }], width: "100%" }}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            onPressIn={() => Animated.spring(shareScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start()}
            onPressOut={() => Animated.spring(shareScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
            activeOpacity={1}
          >
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors, insets) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: Math.max(insets.bottom, 24) + 20,
    paddingTop: 12,
    alignItems: "center",
  },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 20 },
  sheetTitle:   { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, marginBottom: 4 },
  sheetSub:     { fontSize: 14, fontFamily: "Outfit-Regular", color: colors.textSecondary, marginBottom: 24 },
  cardWrap:     { marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  shareBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, marginBottom: 12, width: "100%" },
  shareBtnText: { fontSize: 16, fontFamily: "Outfit-ExtraBold", color: "#fff" },
  dismissBtn:   { paddingVertical: 10, paddingHorizontal: 20 },
  dismissText:  { fontSize: 14, color: colors.textMuted, fontFamily: "Outfit-Regular" },
});
