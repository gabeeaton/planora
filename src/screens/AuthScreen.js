// ============================================================
// src/screens/AuthScreen.js
// Fixed:
//   - ForgotPasswordScreen had stray login/register code removed
//   - Registration -> "Check your email" screen works correctly
//   - Login with unverified email -> goes to verify screen
//   - Resend verification email uses stored email + password
// ============================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";
import { resetPassword, resendVerificationEmail } from "../services/firebase";
import { typography, spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";

const makeStyles = (colors) => StyleSheet.create({
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
  brandTagline: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  cardTitle:  { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.lg },
  field:      { marginBottom: spacing.md },
  label:      { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  inputWrap:  { position: "relative" },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingLeft: 42,
    paddingVertical: 13, color: colors.textPrimary, fontSize: 15,
  },
  inputIcon:  { position: "absolute", left: 14, top: 15, zIndex: 1 },
  eyeBtn:     { position: "absolute", right: 14, top: 15, zIndex: 1 },
  fieldError: { fontSize: 12, color: colors.high, marginTop: 4, marginLeft: 2 },
  errorRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: spacing.md,
    backgroundColor: "rgba(255,92,92,0.1)", padding: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,92,92,0.3)",
  },
  errorText:   { color: colors.high, fontSize: 13, flex: 1, lineHeight: 18 },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginTop: spacing.xs, ...shadows.accent,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: colors.white, fontSize: 16, fontWeight: "700" },
  forgotBtn:  { alignItems: "center", marginTop: spacing.sm, padding: spacing.xs },
  forgotText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  toggleBtn:  { alignItems: "center", marginTop: spacing.md, padding: spacing.xs },
  toggleText: { ...typography.body, color: colors.textSecondary },
  toggleLink: { color: colors.accent, fontWeight: "600" },
  verifyCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", ...shadows.card,
  },
  verifyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentGlow, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  verifyTitle:    { ...typography.h1, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.sm },
  verifyBody:     { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.lg },
  verifyEmail:    { color: colors.accent, fontWeight: "700" },
  verifyNote: {
    ...typography.bodySmall, color: colors.textMuted,
    textAlign: "center", marginTop: spacing.md, lineHeight: 17,
  },
  resetBack: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: spacing.lg,
  },
  resetBackText: { fontSize: 14, color: colors.textSecondary },
  successRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(92,255,143,0.1)", padding: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.low,
    marginBottom: spacing.md,
  },
  successText: { color: colors.low, fontSize: 13, flex: 1, lineHeight: 18 },
});

const friendlyAuthError = (err) => {
  const msg = err?.message ?? String(err);
  if (msg === "EMAIL_NOT_VERIFIED")
    return "Please verify your email before signing in. Check your inbox (and spam folder).";
  if (msg.includes("user-not-found"))         return "No account found with this email.";
  if (msg.includes("wrong-password"))         return "Incorrect password.";
  if (msg.includes("invalid-credential"))     return "Invalid email or password.";
  if (msg.includes("email-already-in-use"))   return "An account with this email already exists. Try signing in.";
  if (msg.includes("invalid-email"))          return "Please enter a valid email address.";
  if (msg.includes("weak-password"))          return "Password must be at least 6 characters.";
  if (msg.includes("too-many-requests"))      return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("network-request-failed")) return "No internet connection. Check your network and try again.";
  return "Something went wrong. Please try again.";
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ── Password Reset Screen (clean - no stray code) ─────────────
const ForgotPasswordScreen = ({ onBack, colors, styles }) => {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const handleReset = async () => {
    if (!email.trim() || !isValidEmail(email)) {
      setError("Please enter a valid email address."); return;
    }
    setLoading(true); setError("");
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const msg = err?.message ?? "";
      if (msg.includes("user-not-found")) setSent(true); // Don't reveal if account exists
      else setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onBack} style={styles.resetBack}>
        <Feather name="arrow-left" size={16} color={colors.textSecondary} />
        <Text style={styles.resetBackText}>Back to sign in</Text>
      </TouchableOpacity>

      <Text style={[styles.cardTitle, { marginBottom: spacing.xs }]}>Reset password</Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
        Enter your email and we'll send a reset link.
      </Text>

      {sent ? (
        <View style={styles.successRow}>
          <Feather name="check-circle" size={14} color={colors.low} />
          <Text style={styles.successText}>
            If an account exists for {email}, you'll get a reset link shortly. Check your spam folder too.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={colors.high} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitText}>Send Reset Link</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

// ── Main Auth Screen ──────────────────────────────────────────
const AuthScreen = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { login, register } = useAuth();

  const [mode, setMode]                         = useState("login"); // "login" | "register" | "forgot" | "verify"
  const [email, setEmail]                       = useState("");
  const [password, setPassword]                 = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [showPassword, setShowPassword]         = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState("");
  const [emailError, setEmailError]             = useState("");
  const [passwordError, setPasswordError]       = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [confirmError, setConfirmError]         = useState("");

  // Store password temporarily so resend can re-auth to get a Firebase user
  const lastPasswordRef = useRef("");

  const passwordRef = useRef(null);
  const confirmRef  = useRef(null);

  const clearErrors = () => {
    setError(""); setEmailError(""); setPasswordError(""); setConfirmError("");
  };

  const validate = () => {
    let valid = true; clearErrors();
    if (!email.trim())             { setEmailError("Email is required."); valid = false; }
    else if (!isValidEmail(email)) { setEmailError("Enter a valid email address."); valid = false; }
    if (!password)                 { setPasswordError("Password is required."); valid = false; }
    else if (password.length < 6)  { setPasswordError("Password must be at least 6 characters."); valid = false; }
    if (mode === "register" && password !== confirmPassword)
                                   { setConfirmError("Passwords do not match."); valid = false; }
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        // Success: AppNavigator listens to auth state and navigates automatically
      } else {
        await register(email.trim(), password);
        // Registration succeeded - show "check your email" screen
        lastPasswordRef.current = password;
        setVerificationEmail(email.trim());
        setMode("verify");
      }
    } catch (err) {
      if (err.message === "EMAIL_NOT_VERIFIED") {
        // User exists but hasn't verified - show verify screen
        lastPasswordRef.current = password;
        setVerificationEmail(email.trim());
        setMode("verify");
      } else {
        setError(friendlyAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(verificationEmail, lastPasswordRef.current);
      Alert.alert("Sent!", "Verification email resent. Check your inbox and spam folder.");
    } catch {
      Alert.alert(
        "Couldn't resend",
        "Please tap 'Go to Sign In' and try signing in — we'll resend the verification link automatically."
      );
    }
  };

  // ── Verification sent screen ────────────────────────────────
  if (mode === "verify") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: "center" }]}>
          <View style={styles.verifyCard}>
            <View style={styles.verifyIcon}>
              <Feather name="mail" size={32} color={colors.accent} />
            </View>
            <Text style={styles.verifyTitle}>Check your email</Text>
            <Text style={styles.verifyBody}>
              We sent a verification link to{" "}
              <Text style={styles.verifyEmail}>{verificationEmail}</Text>.
              {"\n\n"}Tap the link in the email to activate your account, then come back here to sign in.
            </Text>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => {
                setMode("login");
                clearErrors();
                setPassword("");
                setConfirmPassword("");
                lastPasswordRef.current = "";
              }}
            >
              <Feather name="log-in" size={18} color={colors.white} />
              <Text style={styles.submitText}>Go to Sign In</Text>
            </TouchableOpacity>
            <Text style={styles.verifyNote}>
              Didn't get it?{" "}
              <Text style={{ color: colors.accent, fontWeight: "600" }} onPress={handleResend}>
                Resend email
              </Text>
              {"\n"}Also check your spam folder.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Forgot password screen ──────────────────────────────────
  if (mode === "forgot") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <View style={styles.logoWrap}>
                <Feather name="check-square" size={32} color={colors.accent} />
              </View>
              <Text style={styles.brandName}>TaskFlow</Text>
            </View>
            <ForgotPasswordScreen
              onBack={() => { setMode("login"); clearErrors(); }}
              colors={colors}
              styles={styles}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Login / Register ────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Feather name="check-square" size={32} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>TaskFlow</Text>
            <Text style={styles.brandTagline}>AI-powered productivity for focused minds</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{mode === "login" ? "Welcome back" : "Create account"}</Text>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={16} color={emailError ? colors.high : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); if (error) setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={16} color={passwordError ? colors.high : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(""); if (error) setError(""); }}
                  secureTextEntry={!showPassword}
                  returnKeyType={mode === "login" ? "done" : "next"}
                  onSubmitEditing={mode === "login" ? handleSubmit : () => confirmRef.current?.focus()}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
            </View>

            {/* Confirm password */}
            {mode === "register" && (
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrap}>
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
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <>
                    <Feather name={mode === "login" ? "log-in" : "user-plus"} size={18} color={colors.white} />
                    <Text style={styles.submitText}>{mode === "login" ? "Sign In" : "Create Account"}</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Forgot password - login only */}
            {mode === "login" && (
              <TouchableOpacity onPress={() => { setMode("forgot"); clearErrors(); }} style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Toggle login/register */}
            <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); clearErrors(); }} style={styles.toggleBtn}>
              <Text style={styles.toggleText}>
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <Text style={styles.toggleLink}>{mode === "login" ? "Sign Up" : "Sign In"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;