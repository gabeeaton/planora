// ============================================================
// src/screens/ChatScreen.js
// Academic coach chat — gpt-4o-mini
// Free users: AsyncStorage only, 3 messages/day limit
// Scholar users: Firestore-backed history (cross-device, persistent), unlimited
// ============================================================

// ── Demo mode (set true for screenshots/TikTok, false for production) ──
const DEMO_MODE = false;

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { sendChatMessage } from "../services/openai";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "../services/firebase";
import { spacing, radius, typography } from "../utils/theme";

const HISTORY_KEY     = (uid) => `@planora_chat_${uid}`;
const MAX_STORED      = 60; // messages kept in AsyncStorage
const FREE_DAILY_LIMIT = 10;
const todayKey        = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const COUNT_KEY       = (uid) => `@planora_chat_count_${uid}_${todayKey()}`;

// ── Suggested starter prompts ─────────────────────────────────
const STARTERS = [
  { text: "Am I going to be okay this week?" },
  { text: "I'm overwhelmed — help me prioritize." },
  { text: "Break down a task into subtasks", sub: "Adds them to your task list", icon: "git-branch" },
  { text: "Which class needs the most attention?" },
];

// ── Date separator label ──────────────────────────────────────
const getDateLabel = (ts) => {
  const msgDate = new Date(ts);
  const today   = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  if (isSameDay(msgDate, today))     return "Today";
  if (isSameDay(msgDate, yesterday)) return "Yesterday";
  return msgDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

// ── Animated three-dot typing indicator ──────────────────────
const TypingDots = ({ color }) => {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 2 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: color,
            opacity: dot,
            transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        />
      ))}
    </View>
  );
};

const MessageBubble = React.memo(({ item, styles, colors }) => {
  const isNew      = Date.now() - (item.ts ?? 0) < 2000;
  const opacity    = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(isNew ? 10 : 0)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, speed: 22, bounciness: 3, useNativeDriver: true }),
    ]).start();
  }, []);

  const isUser = item.role === "user";
  return (
    <Animated.View style={[styles.bubbleRow, isUser && styles.bubbleRowUser, { opacity, transform: [{ translateY }] }]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Feather name="zap" size={14} color={colors.accent} />
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAI,
        item.isError && styles.bubbleError,
        item.isConfirm && styles.bubbleConfirm,
      ]}>
        <Text style={[
          styles.bubbleText,
          isUser ? styles.bubbleTextUser : styles.bubbleTextAI,
          item.isError && styles.bubbleTextError,
          item.isConfirm && styles.bubbleTextConfirm,
        ]}>
          {item.isConfirm ? "✓ " : ""}{item.text}
        </Text>
      </View>
    </Animated.View>
  );
});

export default function ChatScreen() {
  const { colors }                   = useTheme();
  const navigation                   = useNavigation();
  const { user }                     = useAuth();
  const { tasks, patterns, createTask, createManyTasks } = useTasks();
  const { profile }                  = useUserProfile();
  const { isPro: realIsPro }         = useSubscription();
  const styles                       = makeStyles(colors);

  const isPro = DEMO_MODE ? true : realIsPro;

  const DEMO_MESSAGES = [
    { id: "dm1", role: "user",      text: "I'm feeling overwhelmed — help me prioritize.",                                                                                                                                                                                          ts: Date.now() - 5 * 60000 },
    { id: "dm2", role: "assistant", text: "I get it — let's break this down. Based on your tasks, your most urgent is the Orgo midterm tomorrow. I'd block 2 hours tonight just for that. After that, your HIST 110 essay is due in 2 days — outline it first thing tomorrow morning so it doesn't sneak up on you.",  ts: Date.now() - 4 * 60000 },
    { id: "dm3", role: "user",      text: "What about my math problem set?",                                                                                                                                                                                                         ts: Date.now() - 3 * 60000 },
    { id: "dm4", role: "assistant", text: "MATH 240 is due in 3 days so you have a bit of breathing room. I'd tackle it Wednesday after you've submitted the history essay. You tend to do your best focused work in the afternoon — save the problem set for then.",                ts: Date.now() - 2 * 60000 },
    { id: "dm5", role: "user",      text: "Which class should I be most worried about?",                                                                                                                                                                                             ts: Date.now() - 1 * 60000 },
    { id: "dm6", role: "assistant", text: "CHEM 201 — you have both a midterm and a lab report due within 5 days. It's your highest-stakes class right now. If you can get ahead on the reading tonight after your study session, you'll be in a much better spot by the weekend.", ts: Date.now()              },
  ];

  const [messages, setMessages]      = useState(DEMO_MODE ? DEMO_MESSAGES : []); // { id, role, text, ts }
  const [input, setInput]            = useState("");
  const [typing, setTyping]          = useState(false);
  const [historyLoaded, setHistLoaded] = useState(false);
  const [dailyCount, setDailyCount]  = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load history ───────────────────────────────────────────
  // Scholar: Firestore (cross-device). Free: AsyncStorage (device-local).
  useEffect(() => {
    if (!user || DEMO_MODE) { setHistLoaded(true); return; }
    const load = async () => {
      // Clear demo messages if they were accidentally saved
      const raw = await AsyncStorage.getItem(HISTORY_KEY(user.uid)).catch(() => null);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.some((m) => m.id?.startsWith("dm"))) {
          await AsyncStorage.removeItem(HISTORY_KEY(user.uid)).catch(() => {});
          if (isPro) await clearChatHistory(user.uid).catch(() => {});
          setHistLoaded(true);
          return;
        }
      }
      try {
        if (isPro) {
          const firestoreMsgs = await loadChatHistory(user.uid);
          if (firestoreMsgs.length > 0) {
            setMessages(firestoreMsgs);
            setHistLoaded(true);
            return;
          }
        }
        // Fallback to AsyncStorage (free users, or Scholar with no Firestore history yet)
        const raw = await AsyncStorage.getItem(HISTORY_KEY(user.uid));
        if (raw) setMessages(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setHistLoaded(true);
      }
    };
    load();
  }, [user?.uid, isPro]);

  // ── Persist history ────────────────────────────────────────
  useEffect(() => {
    if (!user || !historyLoaded || DEMO_MODE) return;
    const toStore = messages.slice(-MAX_STORED);
    AsyncStorage.setItem(HISTORY_KEY(user.uid), JSON.stringify(toStore)).catch(() => {});
    if (isPro) saveChatHistory(user.uid, toStore);
  }, [messages, historyLoaded]);

  // ── Load daily message count (free users only) ────────────
  useEffect(() => {
    if (!user || isPro) return;
    AsyncStorage.getItem(COUNT_KEY(user.uid))
      .then((val) => setDailyCount(val ? parseInt(val, 10) : 0))
      .catch(() => {});
  }, [user?.uid, isPro]);

  // ── Send message ───────────────────────────────────────────
  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    // Free user daily limit
    if (!isPro) {
      const current = parseInt(
        (await AsyncStorage.getItem(COUNT_KEY(user.uid)).catch(() => "0")) ?? "0",
        10
      );
      if (current >= FREE_DAILY_LIMIT) {
        navigation.navigate("Paywall");
        return;
      }
      const next = current + 1;
      await AsyncStorage.setItem(COUNT_KEY(user.uid), String(next)).catch(() => {});
      setDailyCount(next);
    }

    const userMsg = { id: Date.now().toString(), role: "user", text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Build history for API (role/content format, exclude ids/ts)
    const apiHistory = messages
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const { text: reply, action } = await sendChatMessage(
        apiHistory.slice(0, -1), // history without the new message (sendChatMessage appends it)
        trimmed,
        tasks,
        profile,
        patterns
      );
      const aiMsg = { id: (Date.now() + 1).toString(), role: "assistant", text: reply, ts: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);

      // Execute task creation if AI returned an action
      if (action?.type === "createTask" && action.title) {
        try {
          await createTask({
            title: action.title,
            dueDate: action.dueDate ? new Date(action.dueDate + "T12:00:00") : null,
            className: action.className ?? null,
            priority: (action.priority ?? "MEDIUM").toUpperCase(),
            completed: false,
          });
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Added "${action.title}" to your task list.`,
            ts: Date.now(), isConfirm: true,
          }]);
        } catch {
          // fails silently — text reply is still shown
        }
      } else if (action?.type === "createTasks" && Array.isArray(action.tasks) && action.tasks.length > 0) {
        try {
          const toCreate = action.tasks.map((t) => ({
            title: t.title,
            dueDate: t.dueDate ? new Date(t.dueDate + "T12:00:00") : null,
            dueTime: Array.isArray(t.dueTime) && t.dueTime.length === 2 ? t.dueTime : null,
            className: t.className ?? null,
            priority: (t.priority ?? "MEDIUM").toUpperCase(),
            completed: false,
          }));
          await createManyTasks(toCreate);
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Added ${toCreate.length} tasks to your list.`,
            ts: Date.now(), isConfirm: true,
          }]);
        } catch {
          // fails silently
        }
      }
    } catch (err) {
      if (err?.limitReached) {
        navigation.navigate("Paywall");
        return;
      }
      const errMsg = { id: (Date.now() + 1).toString(), role: "assistant", text: err.message ?? "Something went wrong. Try again.", ts: Date.now(), isError: true };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setTyping(false);
    }
  }, [typing, messages, tasks, profile, patterns, isPro]);

  // ── Clear chat ─────────────────────────────────────────────
  const clearChat = () => {
    Alert.alert("Clear chat?", "This will delete your conversation history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive", onPress: () => {
          setMessages([]);
          AsyncStorage.removeItem(HISTORY_KEY(user.uid)).catch(() => {});
          if (isPro) clearChatHistory(user.uid);
        },
      },
    ]);
  };

  // ── Scroll to bottom on new message ───────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, typing]);

  // ── Inject date separators into message list ─────────────
  const displayData = React.useMemo(() => {
    const result = [];
    let lastLabel = null;
    messages.forEach((msg) => {
      const label = getDateLabel(msg.ts);
      if (label !== lastLabel) {
        result.push({ id: `sep-${msg.ts}`, type: "separator", label });
        lastLabel = label;
      }
      result.push(msg);
    });
    return result;
  }, [messages]);

  // ── Render message bubble or date separator ────────────────
  const renderMessage = useCallback(({ item }) => {
    if (item.type === "separator") {
      return (
        <View style={styles.dateSepRow}>
          <View style={styles.dateSepLine} />
          <Text style={styles.dateSepText}>{item.label}</Text>
          <View style={styles.dateSepLine} />
        </View>
      );
    }
    return <MessageBubble item={item} styles={styles} colors={colors} />;
  }, [styles, colors]);

  const isEmpty = messages.length === 0 && !typing;
  const firstName = profile?.name?.split(" ")[0] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Feather name="zap" size={18} color={colors.accent} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Academic Coach</Text>
          <Text style={styles.headerSub}>Powered by your real schedule</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Feather name="trash-2" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isEmpty ? undefined : (Platform.OS === "ios" ? "padding" : "height")}
        keyboardVerticalOffset={60}
      >
        {/* Empty state with starters */}
        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="zap" size={28} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {firstName ? `Hi ${firstName}.` : "What's on your mind?"}
            </Text>
            <Text style={styles.emptySub}>
              Ask about your workload, upcoming deadlines, or what to tackle next.
            </Text>
            <View style={styles.startersCard}>
              {STARTERS.map((s, i) => (
                <TouchableOpacity
                  key={s.text}
                  style={[styles.starterBtn, i === STARTERS.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => send(s.text)}
                  activeOpacity={0.6}
                >
                  {s.icon && (
                    <View style={styles.starterIconWrap}>
                      <Feather name={s.icon} size={13} color={colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.starterText}>{s.text}</Text>
                    {s.sub && <Text style={styles.starterSub}>{s.sub}</Text>}
                  </View>
                  <Feather name="chevron-right" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={displayData}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={typing ? (
              <View style={styles.bubbleRow}>
                <View style={styles.avatar}>
                  <Feather name="zap" size={14} color={colors.accent} />
                </View>
                <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                  <TypingDots color={colors.accent} />
                </View>
              </View>
            ) : null}
          />
        )}

        {/* Free user limit banner */}
        {!isPro && dailyCount >= FREE_DAILY_LIMIT && (
          <TouchableOpacity style={styles.limitBanner} onPress={() => navigation.navigate("Paywall")} activeOpacity={0.85}>
            <Feather name="zap" size={13} color={colors.accent} />
            <Text style={styles.limitBannerText}>
              Daily limit reached · <Text style={{ fontFamily: "Outfit-ExtraBold" }}>Upgrade to Scholar</Text> for unlimited
            </Text>
          </TouchableOpacity>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          {!isPro && dailyCount < FREE_DAILY_LIMIT && (
            <Text style={styles.limitHint}>{FREE_DAILY_LIMIT - dailyCount} left today</Text>
          )}
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask your coach..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            blurOnSubmit
            editable={isPro || dailyCount < FREE_DAILY_LIMIT}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || typing || (!isPro && dailyCount >= FREE_DAILY_LIMIT)) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || typing || (!isPro && dailyCount >= FREE_DAILY_LIMIT)}
          >
            <Feather name="send" size={18} color={!input.trim() || typing || (!isPro && dailyCount >= FREE_DAILY_LIMIT) ? colors.textMuted : "#fff"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? "transparent" : "#EAEAF0",
    gap: 10,
  },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accentGlow, borderWidth: 1.5, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 15, fontFamily: "Outfit-Bold", color: colors.textPrimary },
  headerSub:    { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  clearBtn:     { padding: 4 },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.xl, paddingBottom: 40,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 22, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, marginBottom: 6, textAlign: "center" },
  emptySub:   { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg },
  startersCard: {
    width: "100%", borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: colors.isDark ? colors.border : "#EBEBF5",
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
    }),
  },
  starterBtn: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border : "#F0F0F5",
    gap: 10,
  },
  starterText: { fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit-Medium" },
  starterSub:  { fontSize: 11, color: colors.accent, fontFamily: "Outfit-SemiBold", marginTop: 2 },
  starterIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginRight: 2,
  },

  // Date separators
  dateSepRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: colors.isDark ? colors.border : "#E5E5EA" },
  dateSepText: { fontSize: 11, fontFamily: "Outfit-SemiBold", color: colors.textMuted, letterSpacing: 0.5 },

  // Messages
  list: { padding: spacing.md, gap: 12, paddingBottom: spacing.md },
  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser:      { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAI: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.isDark ? colors.border : "#F0F0F5",
    borderBottomLeftRadius: 4,
  },
  bubbleError:     { borderColor: colors.high, backgroundColor: colors.highGlow },
  bubbleConfirm:   { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  bubbleTextConfirm: { color: colors.accent, fontFamily: "Outfit-SemiBold" },
  bubbleText:      { fontSize: 15, lineHeight: 22 },
  bubbleTextUser:  { color: "#fff" },
  bubbleTextAI:    { color: colors.textPrimary },
  bubbleTextError: { color: colors.high },
  typingBubble:    { paddingVertical: 8, paddingHorizontal: 14 },

  limitBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.accentGlow,
    borderTopWidth: 1, borderTopColor: colors.accent + "44",
  },
  limitBannerText: { fontSize: 13, color: colors.accent, flex: 1 },
  limitHint: {
    position: "absolute", top: -18, right: spacing.md + 50,
    fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-SemiBold",
  },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderTopWidth: 1, 
    borderTopColor: colors.isDark ? colors.border : "#F0F0F5",
    backgroundColor: colors.isDark ? colors.bg : "#F2F2F7",
  },
  input: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, paddingTop: 10,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15, maxHeight: 120,
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderColor: colors.isDark ? colors.border : "#E5E5EA",
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
});
