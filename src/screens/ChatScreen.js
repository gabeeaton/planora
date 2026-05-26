// ============================================================
// src/screens/ChatScreen.js
// Academic coach chat — gpt-4o-mini
// Free users: AsyncStorage only, 3 messages/day limit
// Scholar users: Firestore-backed history (cross-device, persistent), unlimited
// ============================================================

import { FEATURE_FLAGS } from "../config";
const DEMO_MODE = FEATURE_FLAGS.DEMO_MODE;

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform,
  Alert, Animated, Modal, ScrollView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSubscription } from "../hooks/useSubscription";
import { sendChatMessage, invalidateTodayFocusCache, getWhatDoIDo } from "../services/openai";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "../services/firebase";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { spacing, radius, typography } from "../utils/theme";
import * as Haptics from "expo-haptics";

const ACE_LOGO    = require("../assets/logo.png");
const HISTORY_KEY = (uid) => `@planora_chat_${uid}`;
const MAX_STORED      = 60; // messages kept in AsyncStorage
const FREE_DAILY_LIMIT = 5;
const todayKey        = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const COUNT_KEY       = (uid) => `@planora_chat_count_${uid}_${todayKey()}`;

const COACH_NAME = "Ace"; // ← change to swap the AI character name everywhere

// ── Intro message tail (varies each open) ─────────────────────
const INTRO_TAILS = [
  "What's stressing you out?",
  "What do you need right now?",
  "What are we tackling today?",
  "What's on your mind?",
  "Where do you want to start?",
];
const pickIntroTail = () => INTRO_TAILS[Math.floor(Math.random() * INTRO_TAILS.length)];

// ── Suggested starter prompts ─────────────────────────────────
const ASK_STARTERS = [
  { text: "Am I going to be okay this week?" },
  { text: "I've been procrastinating — be honest with me." },
  { text: "Which class should I actually worry about?" },
];

const ACTION_STARTERS = [
  { text: "Break this down into subtasks",    sub: "Adds them to your task list",    icon: "git-branch" },
  { text: "Move a task to a different date",  sub: "Reschedules it in your list",    icon: "calendar"   },
  { text: "Mark a task as done",              sub: "Completes it instantly",          icon: "check-circle"},
  { text: "Log a grade on an assignment",     sub: "Saves it to the task",           icon: "award"      },
];

// ── Capabilities sheet data ────────────────────────────────────
const CAPABILITIES = [
  { section: "Ask anything" },
  { icon: "help-circle",    text: "How am I tracking this week?",      sub: "Real assessment of your workload" },
  { icon: "alert-triangle", text: "What's most urgent right now?",     sub: "Ranked by deadline and grade impact" },
  { icon: "layers",         text: "Which class needs attention?",      sub: "Based on upcoming due dates" },
  { icon: "message-circle", text: "I'm overwhelmed — what do I do?",  sub: "Step-by-step plan from your tasks" },
  { section: "Actions it can take" },
  { icon: "plus-circle",   text: "Add a task to your list",            sub: "\"Add a paper due Friday for HIST 110\"" },
  { icon: "git-branch",    text: "Break an assignment into subtasks",  sub: "\"Break down my term paper\"" },
  { icon: "calendar",      text: "Reschedule a task",                  sub: "\"Move my essay to Thursday\"" },
  { icon: "check-circle",  text: "Mark a task complete",               sub: "\"Mark my CHEM lab as done\"" },
  { icon: "award",         text: "Log a grade",                        sub: "\"I got an 88 on my HIST exam\"" },
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
        <Image source={ACE_LOGO} style={styles.avatar} />
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
  const route                        = useRoute();
  const { user }                     = useAuth();
  const { tasks, patterns, createTask, createManyTasks, editTask, completeTask } = useTasks();
  const { profile }                  = useUserProfile();
  const { isPro: realIsPro }         = useSubscription();
  const { events: calendarEvents }   = useCalendarEvents(!DEMO_MODE);  // status/requestPermission handled in CalendarScreen
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
  const [showCapabilities, setShowCapabilities] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // No auto-focus — user opens keyboard intentionally by tapping the input

  // Blur input when switching away from this tab so keyboard doesn't persist
  useEffect(() => {
    const unsub = navigation.addListener("blur", () => inputRef.current?.blur());
    return unsub;
  }, [navigation]);

  // Auto-send suggestion tapped from the quick-asks bar
  const initialTextSent = useRef(false);
  useEffect(() => {
    const initialText = route.params?.initialText;
    if (!initialText || !historyLoaded || initialTextSent.current) return;
    initialTextSent.current = true;
    const t = setTimeout(() => send(initialText), 420);
    return () => clearTimeout(t);
  }, [historyLoaded, route.params?.initialText]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

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
        patterns,
        calendarEvents
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
          invalidateTodayFocusCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          invalidateTodayFocusCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Added ${toCreate.length} tasks to your list.`,
            ts: Date.now(), isConfirm: true,
          }]);
        } catch {
          // fails silently
        }
      } else if (action?.type === "rescheduleTask" && action.taskId && action.newDueDate) {
        try {
          const target = tasks.find((t) => t.id === action.taskId);
          await editTask(action.taskId, { dueDate: new Date(action.newDueDate + "T12:00:00") });
          invalidateTodayFocusCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Rescheduled "${target?.title ?? "task"}" to ${action.newDueDate}.`,
            ts: Date.now(), isConfirm: true,
          }]);
        } catch {
          // fails silently
        }
      } else if (action?.type === "completeTask" && action.taskId) {
        try {
          const target = tasks.find((t) => t.id === action.taskId);
          if (!target) throw new Error("Task not found");
          await completeTask(target);
          invalidateTodayFocusCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Marked "${target?.title ?? "task"}" as complete.`,
            ts: Date.now(), isConfirm: true,
          }]);
        } catch {
          // fails silently
        }
      } else if (action?.type === "logGrade" && action.taskId && action.grade != null) {
        try {
          const target = tasks.find((t) => t.id === action.taskId);
          await editTask(action.taskId, { grade: action.grade });
          invalidateTodayFocusCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMessages((prev) => [...prev, {
            id: (Date.now() + 2).toString(), role: "assistant",
            text: `Logged grade "${action.grade}" for "${target?.title ?? "task"}".`,
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
  }, [typing, messages, tasks, profile, patterns, isPro, calendarEvents]);

  // ── "Where should I start?" quick action ──────────────────
  // Free for everyone — counts against daily limit like any chat message.
  const handleWhereToStart = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!isPro) {
      const current = parseInt(
        (await AsyncStorage.getItem(COUNT_KEY(user.uid)).catch(() => "0")) ?? "0", 10
      );
      if (current >= FREE_DAILY_LIMIT) { navigation.navigate("Paywall"); return; }
      await AsyncStorage.setItem(COUNT_KEY(user.uid), String(current + 1)).catch(() => {});
      setDailyCount(current + 1);
    }
    const userMsg = { id: Date.now().toString(), role: "user", text: "Where should I start?", ts: Date.now() };
    setMessages([userMsg]);
    setTyping(true);
    try {
      const rec = await getWhatDoIDo(tasks, profile, patterns);
      const replyText = rec.recommendation + (rec.reasoning ? `\n\n${rec.reasoning}` : "");
      setMessages([userMsg, { id: (Date.now() + 1).toString(), role: "assistant", text: replyText, ts: Date.now() }]);
    } catch (err) {
      if (err?.limitReached) { navigation.navigate("Paywall"); setMessages([]); return; }
      setMessages([userMsg, { id: (Date.now() + 1).toString(), role: "assistant", text: err.message ?? "Something went wrong.", ts: Date.now(), isError: true }]);
    } finally {
      setTyping(false);
    }
  }, [isPro, user, tasks, profile, patterns, navigation]);

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

  // ── Intro message for empty chat ──────────────────────────
  const firstName = profile?.name?.split(" ")[0] ?? null;

  const introText = React.useMemo(() => {
    if (!historyLoaded || messages.length > 0 || DEMO_MODE) return null;
    const classes = (profile?.classes ?? [])
      .slice(0, 3)
      .map((c) => c.name || c.className || c)
      .filter(Boolean);
    const capLine = "Ask me anything about your week, or just tell me what you need — I can add tasks, move deadlines, break things down, and log grades.";
    if (firstName && classes.length > 0) {
      const overflow = (profile?.classes?.length ?? 0) - classes.length;
      const list =
        classes.length === 1
          ? classes[0]
          : classes.slice(0, -1).join(", ") +
            (overflow > 0
              ? `, and ${overflow + 1} more`
              : ` and ${classes[classes.length - 1]}`);
      return `Hey ${firstName} — I'm ${COACH_NAME}, your AI study coach. I've got ${list} loaded and I know what's due. ${capLine}`;
    }
    if (firstName)
      return `Hey ${firstName} — I'm ${COACH_NAME}, your AI study coach. I know your schedule and deadlines. ${capLine}`;
    return `Hey — I'm ${COACH_NAME}, your AI study coach. I know your classes and deadlines. ${capLine}`;
  }, [historyLoaded, messages.length, profile, firstName]);

  // ── Inject date separators (or intro) into message list ───
  const displayData = React.useMemo(() => {
    const result = [];
    if (historyLoaded && messages.length === 0 && !DEMO_MODE && introText) {
      result.push({ id: "intro", role: "assistant", text: introText, ts: Date.now() });
      result.push({ id: "starters", type: "starters" });
      return result;
    }
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
  }, [messages, historyLoaded, introText]);

  // ── Render message bubble, date separator, or starter chips ─
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
    if (item.type === "starters") {
      return (
        <View style={styles.suggestionRow}>
          {["Where should I start?", ...ASK_STARTERS.map((s) => s.text)].map((text) => (
            <TouchableOpacity
              key={text}
              style={styles.suggestionChip}
              onPress={() =>
                text === "Where should I start?" ? handleWhereToStart() : send(text)
              }
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionChipText}>{text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return <MessageBubble item={item} styles={styles} colors={colors} />;
  }, [styles, colors, send, handleWhereToStart]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Image source={ACE_LOGO} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{COACH_NAME}</Text>
          <Text style={styles.headerSub}>Knows your classes, grades & deadlines</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); clearChat(); }} style={styles.clearBtn}>
            <Feather name="trash-2" size={18} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowCapabilities(true); }} style={styles.clearBtn}>
            <Feather name="info" size={18} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Capabilities sheet */}
      <Modal visible={showCapabilities} transparent animationType="slide" onRequestClose={() => setShowCapabilities(false)}>
        <TouchableOpacity style={styles.capOverlay} activeOpacity={1} onPress={() => setShowCapabilities(false)}>
          <View style={styles.capSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.capHandle} />
            <Text style={styles.capTitle}>What I can do</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CAPABILITIES.map((item, i) =>
                item.section ? (
                  <Text key={i} style={styles.capSection}>{item.section.toUpperCase()}</Text>
                ) : (
                  <View key={i} style={styles.capRow}>
                    <View style={styles.capIconWrap}>
                      <Feather name={item.icon} size={15} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.capItemText}>{item.text}</Text>
                      <Text style={styles.capItemSub}>{item.sub}</Text>
                    </View>
                  </View>
                )
              )}
              <View style={{ height: 8 }} />
            </ScrollView>
            <TouchableOpacity style={styles.capCloseBtn} onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowCapabilities(false); }}>
              <Text style={styles.capCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
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
              <Image source={ACE_LOGO} style={styles.avatar} />
              <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                <TypingDots color={colors.accent} />
              </View>
            </View>
          ) : null}
        />

        {/* Free user limit banner */}
        {!isPro && dailyCount >= FREE_DAILY_LIMIT && (
          <TouchableOpacity style={styles.limitBanner} onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.navigate("Paywall"); }} activeOpacity={0.85}>
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
            placeholder="What's on your mind?"
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
    paddingHorizontal: spacing.md, paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.accent,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  headerAvatar: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontFamily: "Outfit-Bold", color: "#fff" },
  headerSub:    { fontSize: 11, color: "rgba(255,255,255,0.72)", fontFamily: "Outfit-Regular", marginTop: 1 },
  clearBtn:     { padding: 6 },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24, paddingBottom: 40,
  },
  emptyLogoWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  emptyTitle: {
    fontSize: 26, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
    textAlign: "center", marginBottom: 8,
  },
  emptySub: {
    fontSize: 14, fontFamily: "Outfit-Regular",
    color: colors.textSecondary, textAlign: "center", lineHeight: 20,
    marginBottom: 32, paddingHorizontal: 8,
  },
  whereToStartBtn: {
    width: "100%", flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 18, marginBottom: 28,
    backgroundColor: colors.accent,
    gap: 12,
  },
  whereToStartIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  whereToStartTitle: {
    fontSize: 15, fontFamily: "Outfit-Bold", color: "#fff", marginBottom: 2,
  },
  whereToStartSub: {
    fontSize: 12, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.72)", lineHeight: 16,
  },
  suggestLabel: {
    fontSize: 11, fontFamily: "Outfit-ExtraBold", color: colors.textMuted,
    letterSpacing: 1, marginBottom: 10, alignSelf: "flex-start",
  },
  startersCard: {
    width: "100%", borderRadius: 16, overflow: "hidden",
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderWidth: 1, borderColor: colors.isDark ? colors.border : "#EBEBF5",
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    }),
  },
  starterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border : "#F3F3F8",
    gap: 12,
  },
  starterText: { fontSize: 14, color: colors.textPrimary, fontFamily: "Outfit-Medium", flex: 1 },
  starterSub:  { fontSize: 11, color: colors.textMuted, fontFamily: "Outfit-Regular", marginTop: 2 },
  emptyCapHint: {
    fontSize: 12, fontFamily: "Outfit-Regular", color: colors.textMuted,
    textAlign: "center", marginTop: 12, lineHeight: 17,
  },
  capLink: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: spacing.md, alignSelf: "center", padding: 4,
  },
  capLinkText: { fontSize: 13, color: colors.accent, fontFamily: "Outfit-SemiBold" },

  // Inline suggestion chips (shown below intro bubble)
  suggestionRow: {
    paddingLeft: 38,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accent + "25",
  },
  suggestionChipText: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: colors.accent,
  },

  starterIconWrap: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center",
  },

  // Capabilities modal
  capOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  capSheet: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingBottom: 36, paddingTop: 12,
    maxHeight: "80%",
  },
  capHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: 16,
  },
  capTitle: {
    fontSize: 18, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  capSection: {
    fontSize: 11, fontFamily: "Outfit-ExtraBold", color: colors.textMuted,
    letterSpacing: 1, marginTop: spacing.md, marginBottom: 6,
  },
  capRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.isDark ? colors.border + "80" : "#F3F3F8",
  },
  capIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  capItemText: { fontSize: 14, fontFamily: "Outfit-SemiBold", color: colors.textPrimary },
  capItemSub:  { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  capCloseBtn: {
    marginTop: spacing.md, backgroundColor: colors.isDark ? colors.border : "#F2F2F7",
    borderRadius: radius.md, paddingVertical: 14, alignItems: "center",
  },
  capCloseTxt: { fontSize: 15, fontFamily: "Outfit-Bold", color: colors.textPrimary },

  // Date separators
  dateSepRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 14 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: colors.isDark ? colors.border : "#EBEBF0" },
  dateSepText: { fontSize: 11, fontFamily: "Outfit-SemiBold", color: colors.textMuted, letterSpacing: 0.5 },

  // Messages
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 10 },
  bubbleRow:     { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 2 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 42, height: 42, flexShrink: 0,
  },
  bubble: {
    maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 5,
  },
  bubbleAI: {
    backgroundColor: colors.isDark ? colors.bgCard : "#FFFFFF",
    borderBottomLeftRadius: 5,
    borderWidth: colors.isDark ? 0 : 1,
    borderColor: colors.isDark ? "transparent" : "#E8E8F0",
    ...(colors.isDark ? {} : {
      shadowColor: "#6B6B8A",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.07,
      shadowRadius: 4,
      elevation: 2,
    }),
  },
  bubbleError:       { backgroundColor: colors.highGlow, borderWidth: 1, borderColor: colors.high },
  bubbleConfirm:     { backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent },
  bubbleTextConfirm: { color: colors.accent, fontFamily: "Outfit-SemiBold" },
  bubbleText:        { fontSize: 15, lineHeight: 22, fontFamily: "Outfit-Regular" },
  bubbleTextUser:    { color: "#fff" },
  bubbleTextAI:      { color: colors.textPrimary },
  bubbleTextError:   { color: colors.high },
  typingBubble:      { paddingVertical: 8, paddingHorizontal: 14 },

  limitBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.accentGlow,
    borderTopWidth: 1, borderTopColor: colors.accent + "33",
  },
  limitBannerText: { fontSize: 13, color: colors.accent, flex: 1 },
  limitHint: {
    position: "absolute", top: -18, right: spacing.md + 50,
    fontSize: 10, color: colors.textMuted, fontFamily: "Outfit-SemiBold",
  },

  // Input bar — seamless, no gray background
  inputBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.isDark ? colors.border : "#EBEBF0",
    backgroundColor: colors.isDark ? colors.bg : "#FFFFFF",
  },
  input: {
    flex: 1, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1,
    color: colors.textPrimary, fontSize: 15, maxHeight: 120,
    fontFamily: "Outfit-Regular",
    backgroundColor: colors.isDark ? colors.bgCard : "#F2F2F7",
    borderColor: colors.isDark ? colors.border : "transparent",
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.isDark ? colors.bgCard : "#EBEBF0", borderWidth: 0 },
});
