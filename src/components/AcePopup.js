// ============================================================
// AcePopup.js — mini floating Ace chat popup
// Uses a transparent Modal so it always renders above everything
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Keyboard, Platform, ScrollView,
  Modal, TouchableWithoutFeedback, Image, LayoutAnimation, UIManager,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { sendChatMessage } from "../services/openai";
import { saveChatHistory } from "../services/firebase";
import { spacing } from "../utils/theme";

const COACH_NAME = "Ace";
const TAB_BAR_HEIGHT = 62;
const ACE_BTN_SIZE = 50;
const HISTORY_KEY = (uid) => `@planora_chat_${uid}`;

const QUICK_ASKS = [
  "Am I going to be okay this week?",
  "Which class should I focus on?",
  "I've been procrastinating — be honest.",
];

const TypingDots = ({ colors }) => {
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = (d, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.delay(260),
      ])
    );
    const a0 = loop(d0, 0); const a1 = loop(d1, 150); const a2 = loop(d2, 300);
    a0.start(); a1.start(); a2.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); };
  }, []);
  const dot = (a) => (
    <Animated.View style={{
      width: 5, height: 5, borderRadius: 3,
      backgroundColor: colors.textMuted, marginHorizontal: 2,
      opacity: a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
    }} />
  );
  return <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>{dot(d0)}{dot(d1)}{dot(d2)}</View>;
};

export default function AcePopup({ visible, onClose, onOpenFullChat }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tasks, patterns } = useTasks();
  const { profile } = useUserProfile();
  const { isPro } = useSubscription();
  const s = makeStyles(colors);

  const [input,    setInput]    = useState("");
  const [typing,   setTyping]   = useState(false);
  const [response, setResponse] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const inputRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const [kbdHeight, setKbdHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        LayoutAnimation.configureNext({ duration: e.duration ?? 250, update: { type: "easeInEaseOut" } });
        setKbdHeight(e.endCoordinates.height);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        LayoutAnimation.configureNext({ duration: e.duration ?? 200, update: { type: "easeInEaseOut" } });
        setKbdHeight(0);
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Open modal before animating so component is mounted
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      setInput(""); setTyping(false); setResponse(null);
    }
  }, [visible]);

  // Animate once modal is visible
  useEffect(() => {
    if (modalVisible && visible) {
      slideAnim.setValue(40);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, speed: 26, bounciness: 6, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, speed: 26, bounciness: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [modalVisible]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  }, [onClose]);

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || typing) return;
    setInput("");
    setTyping(true);
    setResponse(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Keyboard.dismiss();

    let history = [];
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY(user?.uid));
      if (raw) history = JSON.parse(raw);
    } catch {}

    const apiHistory = history
      .filter((m) => m.role !== "separator")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const { text: aiText } = await sendChatMessage(apiHistory, trimmed, tasks, profile, patterns);
      const userMsg = { id: Date.now().toString(),     role: "user",      text: trimmed, ts: Date.now() };
      const aiMsg   = { id: (Date.now() + 1).toString(), role: "assistant", text: aiText,  ts: Date.now() };
      const newHistory = [...history, userMsg, aiMsg].slice(-60);
      AsyncStorage.setItem(HISTORY_KEY(user?.uid), JSON.stringify(newHistory)).catch(() => {});
      if (isPro && user?.uid) saveChatHistory(user.uid, newHistory).catch(() => {});
      setTyping(false);
      setResponse(aiText);
    } catch {
      setTyping(false);
      setResponse("Something went wrong. Tap to open the full chat.");
    }
  }, [input, typing, user?.uid, tasks, profile, patterns, isPro]);

  const bottomOffset = Math.max(insets.bottom, 8) + TAB_BAR_HEIGHT + ACE_BTN_SIZE + 16;
  // When keyboard is up: sit 8px above keyboard. When hidden: sit above tab bar + FAB.
  const cardMarginBottom = kbdHeight > 0 ? kbdHeight + 8 : bottomOffset;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Full-screen dismiss area */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Keyboard-aware wrapper — layout animated via LayoutAnimation + state */}
      <View style={s.kavContainer} pointerEvents="box-none">
        {/* Popup card — native-thread opacity/transform only, no Animated layout props */}
        <Animated.View
          style={[
            s.card,
            {
              marginBottom: cardMarginBottom,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={s.header}>
            <View style={[s.aceBadge, { backgroundColor: colors.accent }]}>
              <Image source={require("../assets/logo.png")} style={s.aceLogo} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerName}>{COACH_NAME}</Text>
              <Text style={s.headerSub}>AI study coach</Text>
            </View>
            <TouchableOpacity
              onPress={() => { handleClose(); setTimeout(onOpenFullChat, 200); }}
              style={s.expandBtn}
              activeOpacity={0.7}
            >
              <Feather name="maximize-2" size={14} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              style={[s.expandBtn, { marginLeft: 2 }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Response or quick asks */}
          <View style={s.body}>
            {typing ? (
              <TypingDots colors={colors} />
            ) : response ? (
              <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                <Text style={s.responseText}>{response}</Text>
                <TouchableOpacity
                  onPress={() => { handleClose(); setTimeout(onOpenFullChat, 200); }}
                  style={s.continueBtn}
                  activeOpacity={0.7}
                >
                  <Text style={s.continueBtnText}>Continue with {COACH_NAME} →</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipRow}
              >
                {QUICK_ASKS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={s.chip}
                    onPress={() => handleSend(q)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.chipText} numberOfLines={2}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Input row */}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={[s.input, { color: colors.textPrimary }]}
              value={input}
              onChangeText={setInput}
              placeholder={`Ask ${COACH_NAME} anything…`}
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              blurOnSubmit={false}
              maxLength={200}
            />
            <TouchableOpacity
              style={[s.sendBtn, {
                backgroundColor: input.trim() ? colors.accent : colors.accentGlow,
                opacity: typing ? 0.5 : 1,
              }]}
              onPress={() => handleSend()}
              disabled={!input.trim() || typing}
              activeOpacity={0.7}
            >
              <Feather name="send" size={14} color={input.trim() ? "#fff" : colors.accent} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  kavContainer: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    justifyContent: "flex-end",
  },
  card: {
    marginHorizontal: 12,
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderRadius: 20,
    borderWidth: colors.isDark ? 1 : 0,
    borderColor: colors.isDark ? colors.border : "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: colors.isDark ? 0.3 : 0.12,
    shadowRadius: 20,
    elevation: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.border : "#F0F0F8",
  },
  aceBadge: {
    width: 58, height: 58, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  aceLogo: {
    width: 50, height: 50,
  },
  headerName: {
    fontSize: 14, fontFamily: "Outfit-Bold", color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 11, fontFamily: "Outfit-Regular", color: colors.textMuted,
  },
  expandBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  body: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipRow: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    maxWidth: 160,
    backgroundColor: colors.isDark ? colors.bgInput : "#F4F4F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#E4E4EE",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: colors.textSecondary,
    lineHeight: 17,
  },
  responseText: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  continueBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
  },
  continueBtnText: {
    fontSize: 13,
    fontFamily: "Outfit-SemiBold",
    color: colors.accent,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.isDark ? colors.border : "#F0F0F8",
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    paddingVertical: 8,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
});
