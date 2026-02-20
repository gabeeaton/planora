// ============================================================
// src/screens/AuthScreen.js
// Sign in / Sign up — comprehensive error handling,
// network awareness, input validation.
// ============================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";
import { colors, typography, spacing, radius, shadows } from "../utils/theme";

// ── Friendly error message mapping ───────────────────────────
const friendlyAuthError = (err) => {
  const msg = err?.message ?? err?.code ?? String(err);
  if (msg.includes("user-not-found"))           return "No account found with this email.";
  if (msg.includes("wrong-password"))           return "Incorrect password. Please try again.";
  if (msg.includes("invalid-credential"))       return "Invalid email or password.";
  if (msg.includes("email-already-in-use"))     return "An account with this email already exists. Try signing in.";
  if (msg.includes("invalid-email"))            return "Please enter a valid email address.";
  if (msg.includes("weak-password"))            return "Password must be at least 6 characters.";
  if (msg.includes("too-many-requests"))        return "Too many failed attempts. Please wait a moment and try again.";
  if (msg.includes("network-request-failed"))   return "No internet connection. Check your network and try again.";
  if (msg.includes("user-disabled"))            return "This account has been disabled. Contact support.";
  if (msg.includes("operation-not-allowed"))    return "Email sign-in is not enabled. Contact support.";
  if (msg.includes("account-exists-with-different-credential"))
                                                return "An account exists with a different sign-in method.";
  return "Something went wrong. Please try again.";
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const AuthScreen = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin]           = useState(true);
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  // Per-field inline errors
  const [emailError, setEmailError]         = useState("");
  const [passwordError, setPasswordError]   = useState("");
  const [confirmError, setConfirmError]     = useState("");

  const passwordRef = useRef(null);
  const confirmRef  = useRef(null);

  const clearErrors = () => {
    setError(""); setEmailError(""); setPasswordError(""); setConfirmError("");
  };

  const validate = () => {
    let valid = true;
    clearErrors();

    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    }

    if (!isLogin && password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin((v) => !v);
    clearErrors();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Feather name="check-square" size={32} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>TaskFlow</Text>
            <Text style={styles.brandTagline}>AI-powered productivity for focused minds</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isLogin ? "Welcome back" : "Create account"}</Text>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={[styles.inputWrap, emailError && styles.inputWrapError]}>
                <Feather name="mail" size={16} color={emailError ? colors.high : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); if (error) setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.inputWrap, passwordError && styles.inputWrapError]}>
                <Feather name="lock" size={16} color={passwordError ? colors.high : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(""); if (error) setError(""); }}
                  secureTextEntry={!showPassword}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  returnKeyType={isLogin ? "done" : "next"}
                  onSubmitEditing={isLogin ? handleSubmit : () => confirmRef.current?.focus()}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
            </View>

            {/* Confirm password */}
            {!isLogin && (
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={[styles.inputWrap, confirmError && styles.inputWrapError]}>
                  <Feather name="lock" size={16} color={confirmError ? colors.high : colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    ref={confirmRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); if (confirmError) setConfirmError(""); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
                {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
              </View>
            )}

            {/* Global error */}
            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.high} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Feather name={isLogin ? "log-in" : "user-plus"} size={18} color={colors.white} />
                  <Text style={styles.submitText}>{isLogin ? "Sign In" : "Create Account"}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Forgot password hint — login only */}
            {isLogin && (
              <Text style={styles.forgotHint}>
                Forgot your password? Contact support or create a new account.
              </Text>
            )}

            {/* Toggle */}
            <TouchableOpacity onPress={switchMode} style={styles.toggleBtn}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <Text style={styles.toggleLink}>{isLogin ? "Sign Up" : "Sign In"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  kav:       { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: "center", paddingVertical: spacing.xxl },
  brand:     { alignItems: "center", marginBottom: spacing.xxl },
  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md, ...shadows.accent,
  },
  brandName:    { fontSize: 34, fontWeight: "900", color: colors.textPrimary, letterSpacing: -1 },
  brandTagline: { ...typography.body, textAlign: "center", marginTop: spacing.xs },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  cardTitle: { ...typography.h1, marginBottom: spacing.lg },
  field:     { marginBottom: spacing.md },
  label:     { ...typography.label, marginBottom: spacing.xs },
  inputWrap: { position: "relative", borderRadius: radius.md, overflow: "hidden" },
  inputWrapError: {},
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingLeft: 42,
    paddingVertical: 13, color: colors.textPrimary, fontSize: 15,
  },
  inputIcon:  { position: "absolute", left: 14, top: 15, zIndex: 1 },
  eyeBtn:     { position: "absolute", right: 14, top: 15, zIndex: 1 },
  fieldError: { fontSize: 12, color: colors.high, marginTop: 4, marginLeft: 2 },
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md,
    backgroundColor: "rgba(255,92,92,0.1)", padding: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,92,92,0.3)",
  },
  errorText:  { color: colors.high, fontSize: 13, flex: 1 },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginTop: spacing.xs, ...shadows.accent,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: colors.white, fontSize: 16, fontWeight: "700" },
  forgotHint: {
    ...typography.bodySmall, textAlign: "center",
    marginTop: spacing.sm, color: colors.textMuted,
  },
  toggleBtn:  { alignItems: "center", marginTop: spacing.md, padding: spacing.xs },
  toggleText: { ...typography.body, color: colors.textSecondary },
  toggleLink: { color: colors.accent, fontWeight: "600" },
});

export default AuthScreen;