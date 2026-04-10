// ============================================================
// src/screens/ChatScreen.js
// Academic coach chat — gpt-4o-mini, local history via AsyncStorage
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../utils/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useTasks } from "../hooks/useTasks";
import { useUserProfile } from "../hooks/useUserProfile";
import { sendChatMessage } from "../services/openai";
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
  const insets                       = useSafeAreaInsets();
  const { user }                     = useAuth();
  const { tasks, patterns }          = useTasks();
  const { profile }                  = useUserProfile();
  const styles                       = makeStyles(colors);

  const [messages, setMessages]      = useState([]); // { id, role, text, ts }
  const [input, setInput]            = useState("");
  const [typing, setTyping]          = useState(false);
  const [historyLoaded, setHistLoaded] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load history ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(HISTORY_KEY(user.uid))
      .then((raw) => {
        if (raw) setMessages(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setHistLoaded(true));
  }, [user]);

  // ── Persist history ────────────────────────────────────────
  useEffect(() => {
    if (!user || !historyLoaded) return;
    const toStore = messages.slice(-MAX_STORED);
    AsyncStorage.setItem(HISTORY_KEY(user.uid), JSON.stringify(toStore)).catch(() => {});
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Academic Coach</Text>
          <Text style={styles.headerSub}>Powered by AI · knows your tasks</Text>
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
        keyboardVerticalOffset={0}
      >
        {/* Empty state with starters */}
        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Feather name="cpu" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Your Academic Coach</Text>
            <Text style={styles.emptySub}>
              Ask me anything about your workload, study strategy, or which class needs attention.
            </Text>
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <TouchableOpacity key={s} style={styles.starterBtn} onPress={() => send(s)}>
                  <Text style={styles.starterText}>{s}</Text>
                  <Feather name="arrow-right" size={13} color={colors.accent} />
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
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
  backBtn:      { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  headerSub:    { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  clearBtn:     { padding: 4 },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.xl, paddingBottom: 80,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  emptySub:   { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg },
  starters:   { width: "100%", gap: 8 },
  starterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  starterText: { fontSize: 14, color: colors.textPrimary, flex: 1, marginRight: 8 },

  // Messages
  list: { padding: spacing.md, gap: 12, paddingBottom: 8 },
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
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: spacing.md, paddingTop: 10,
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
