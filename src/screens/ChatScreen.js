// ============================================================
// src/screens/ChatScreen.js
// Academic coach chat — gpt-4o-mini
// Free users: AsyncStorage only (device-local)
// Scholar users: Firestore-backed history (cross-device, persistent)
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
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

const HISTORY_KEY = (uid) => `@planora_chat_${uid}`;
const MAX_STORED  = 60; // messages kept in AsyncStorage

// ── Suggested starter prompts ─────────────────────────────────
const STARTERS = [
  "What should I focus on this week?",
  "I'm feeling overwhelmed — help me prioritize.",
  "Am I on track to finish everything before finals?",
  "Which class should I be most worried about?",
];

export default function ChatScreen() {
  const { colors }                   = useTheme();
  const navigation                   = useNavigation();
  const { user }                     = useAuth();
  const { tasks, patterns }          = useTasks();
  const { profile }                  = useUserProfile();
  const { isPro }                    = useSubscription();
  const styles                       = makeStyles(colors);

  const [messages, setMessages]      = useState([]); // { id, role, text, ts }
  const [input, setInput]            = useState("");
  const [typing, setTyping]          = useState(false);
  const [historyLoaded, setHistLoaded] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load history ───────────────────────────────────────────
  // Scholar: Firestore (cross-device). Free: AsyncStorage (device-local).
  useEffect(() => {
    if (!user) return;
    const load = async () => {
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
    if (!user || !historyLoaded) return;
    const toStore = messages.slice(-MAX_STORED);
    AsyncStorage.setItem(HISTORY_KEY(user.uid), JSON.stringify(toStore)).catch(() => {});
    if (isPro) saveChatHistory(user.uid, toStore);
  }, [messages, historyLoaded]);

  // ── Send message ───────────────────────────────────────────
  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const userMsg = { id: Date.now().toString(), role: "user", text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Build history for API (role/content format, exclude ids/ts)
    const apiHistory = messages
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const reply = await sendChatMessage(
        apiHistory.slice(0, -1), // history without the new message (sendChatMessage appends it)
        trimmed,
        tasks,
        profile,
        patterns
      );
      const aiMsg = { id: (Date.now() + 1).toString(), role: "assistant", text: reply, ts: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
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
  }, [typing, messages, tasks, profile, patterns]);

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

  // ── Render message bubble ──────────────────────────────────
  const renderMessage = ({ item }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Feather name="cpu" size={14} color={colors.accent} />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          item.isError && styles.bubbleError,
        ]}>
          <Text style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAI,
            item.isError && styles.bubbleTextError,
          ]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  const isEmpty = messages.length === 0 && !typing;
  const firstName = profile?.name?.split(" ")[0] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Feather name="cpu" size={18} color={colors.accent} />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Academic Coach</Text>
          <Text style={styles.headerSub}>Knows your tasks, classes & deadlines</Text>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
            <Feather name="trash-2" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={60}
      >
        {/* Empty state with starters */}
        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="cpu" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {firstName ? `Hi ${firstName}! 👋` : "Your Academic Coach"}
            </Text>
            <Text style={styles.emptySub}>
              {firstName
                ? "Ask me anything about your workload, upcoming deadlines, or which class needs attention right now."
                : "Ask me anything about your workload, study strategy, or which class needs attention."}
            </Text>
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <TouchableOpacity key={s} style={styles.starterBtn} onPress={() => send(s)}>
                  <Text style={styles.starterText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={typing ? (
              <View style={styles.bubbleRow}>
                <View style={styles.avatar}>
                  <Feather name="cpu" size={14} color={colors.accent} />
                </View>
                <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              </View>
            ) : null}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
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
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || typing) && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || typing}
          >
            <Feather name="send" size={18} color={!input.trim() || typing ? colors.textMuted : "#fff"} />
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
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 10,
  },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accentGlow, borderWidth: 1.5, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#5CFF8F", borderWidth: 1.5, borderColor: colors.bg,
  },
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
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
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  emptySub:   { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.md },
  starters:   { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  starterBtn: {
    backgroundColor: colors.bgCard, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.border,
  },
  starterText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },

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
  bubbleAI:        { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleError:     { borderColor: colors.high, backgroundColor: "rgba(255,92,92,0.08)" },
  bubbleText:      { fontSize: 15, lineHeight: 22 },
  bubbleTextUser:  { color: "#fff" },
  bubbleTextAI:    { color: colors.textPrimary },
  bubbleTextError: { color: colors.high },
  typingBubble:    { paddingVertical: 12, paddingHorizontal: 16 },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, paddingTop: 10,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
});
