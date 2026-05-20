// ============================================================
// src/screens/ResetPasswordScreen.js
// Handles in-app password reset via deep link.
// Deep link: planora://reset-password?oobCode=XXX
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { auth, confirmPasswordReset } from "../services/firebase";
import { spacing, radius, typography } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

export default function ResetPasswordScreen({ route, navigation }) {
  const { colors } = useTheme();
  const oobCode = route.params?.oobCode ?? null;

  const [password, setPassword]         = useState("");
  const [confirm, setConfirm]           = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [error, setError]               = useState("");

  const handleReset = async () => {
    setError("");
    if (!oobCode) { setError("Invalid or expired reset link."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err) {
      const msg = err?.code ?? "";
      if (msg.includes("expired") || msg.includes("invalid"))
        setError("This reset link has expired. Request a new one.");
      else
        setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const s = StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.bg },
    inner:   { flex: 1, paddingHorizontal: spacing.lg, justifyContent: "center" },
    back:    { position: "absolute", top: spacing.lg, left: spacing.lg, padding: 8 },
    icon:    {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.accentGlow, borderWidth: 1.5, borderColor: colors.accent,
      alignItems: "center", justifyContent: "center",
      alignSelf: "center", marginBottom: spacing.lg,
    },
    title:   { ...typography.h2, color: colors.textPrimary, textAlign: "center", marginBottom: 6 },
    sub:     { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
    label:   { fontSize: 12, fontFamily: "Outfit-Bold", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
    wrap:    { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    input:   { flex: 1, height: 48, fontSize: 16, color: colors.textPrimary },
    eye:     { padding: 8 },
    error:   { fontSize: 13, color: "#FF5C5C", marginBottom: spacing.md, textAlign: "center" },
    btn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm },
    btnText: { color: "#fff", fontFamily: "Outfit-Bold", fontSize: 16 },
    doneIcon: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: "rgba(92,255,143,0.15)", borderWidth: 2, borderColor: "#5CFF8F",
      alignItems: "center", justifyContent: "center",
      alignSelf: "center", marginBottom: spacing.lg,
    },
    doneTitle: { ...typography.h2, color: colors.textPrimary, textAlign: "center", marginBottom: 8 },
    doneSub:   { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  });

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.inner}>
          <View style={s.doneIcon}>
            <Feather name="check" size={36} color="#5CFF8F" />
          </View>
          <Text style={s.doneTitle}>Password updated!</Text>
          <Text style={s.doneSub}>Your password has been changed.{"\n"}Sign in with your new password.</Text>
          <TouchableOpacity style={s.btn} onPress={() => navigation.replace("Auth")}>
            <Text style={s.btnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={s.inner}>
          <View style={s.icon}>
            <Feather name="lock" size={26} color={colors.accent} />
          </View>
          <Text style={s.title}>Set new password</Text>
          <Text style={s.sub}>Choose a new password for your Planora account.</Text>

          <Text style={s.label}>New password</Text>
          <View style={s.wrap}>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(""); }}
              secureTextEntry={!showPass}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <TouchableOpacity style={s.eye} onPress={() => setShowPass(x => !x)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Confirm password</Text>
          <View style={s.wrap}>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(""); }}
              secureTextEntry={!showPass}
              placeholder="Repeat password"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Update password</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
