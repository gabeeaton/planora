// ============================================================
// src/screens/AuthScreen.js
// ============================================================

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";
import { resetPassword } from "../services/firebase";
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
  inputError: { borderColor: colors.high },
  inputIcon:  { position: "absolute", left: 14, top: 15, zIndex: 1 },
  eyeBtn:     { position: "absolute", right: 14, top: 15, zIndex: 1 },
  fieldError: { fontSize: 12, color: colors.high, marginTop: 4, marginLeft: 2 },

  // Global error row
  errorRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: spacing.md,
    backgroundColor: "rgba(255,92,92,0.1)", padding: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: "rgba(255,92,92,0.3)",
  },
  errorText: { color: colors.high, fontSize: 13, flex: 1, lineHeight: 18 },

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

  // Forgot password
  successRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(92,255,143,0.1)", padding: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.low,
    marginBottom: spacing.md,
  },
  successText: { color: colors.low, fontSize: 13, flex: 1, lineHeight: 18 },
  resetBack: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg,
  },
  resetBackText: { fontSize: 14, color: colors.textSecondary },

});

const friendlyAuthError = (err) => {
  const msg = err?.message ?? String(err);
  if (msg.includes("user-not-found"))         return "No account found with this email.";
  if (msg.includes("wrong-password"))         return "Incorrect password.";
  if (msg.includes("invalid-credential"))     return "Invalid email or password.";
  if (msg.includes("email-already-in-use"))   return "An account with this email already exists. Try signing in.";
  if (msg.includes("invalid-email"))          return "Please enter a valid email address.";
  if (msg.includes("weak-password"))          return "Password must be at least 6 characters.";
  if (msg.includes("too-many-requests"))      return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("network-request-failed")) return "No internet connection. Check your network and try again.";
  if (msg.includes("verify your email"))       return msg;
  return "Something went wrong. Please try again.";
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// ── Password Reset Screen ─────────────────────────────────────
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
      if (msg.includes("user-not-found")) setSent(true);
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
const AuthScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { login, register } = useAuth();

  const [mode, setMode]                         = useState("login");
  const [email, setEmail]                       = useState("");
  const [password, setPassword]                 = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [showPassword, setShowPassword]         = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState("");
  const [emailError, setEmailError]             = useState("");
  const [passwordError, setPasswordError]       = useState("");
  const [confirmError, setConfirmError]         = useState("");

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
      } else {
        await register(email.trim(), password);
        navigation.navigate("EmailVerification", { email: email.trim() });
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password mode ──────────────────────────────────
  if (mode === "forgot") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <View style={styles.logoWrap}>
                <Feather name="check-square" size={32} color={colors.accent} />
              </View>
              <Text style={styles.brandName}>Planora</Text>
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

  // ── Login / Register ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Feather name="check-square" size={32} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>Planora</Text>
            <Text style={styles.brandTagline}>Your semester, organized.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{mode === "login" ? "Welcome back" : "Create account"}</Text>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="mail" size={16}
                  color={emailError ? colors.high : colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, emailError && styles.inputError]}
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
                <Feather
                  name="lock" size={16}
                  color={passwordError ? colors.high : colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { paddingRight: 44 }, passwordError && styles.inputError]}
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

            {/* Confirm password (register only) */}
            {mode === "register" && (
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <Feather
                    name="lock" size={16}
                    color={confirmError ? colors.high : colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={confirmRef}
                    style={[styles.input, confirmError && styles.inputError]}
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

            {mode === "login" && (
              <TouchableOpacity
                onPress={() => { setMode("forgot"); clearErrors(); }}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { setMode(mode === "login" ? "register" : "login"); clearErrors(); }}
              style={styles.toggleBtn}
            >
              <Text style={styles.toggleText}>
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <Text style={styles.toggleLink}>{mode === "login" ? "Sign Up" : "Sign In"}</Text>
              </Text>
            </TouchableOpacity>

            {mode === "register" && (
              <Text style={[styles.toggleText, { textAlign: "center", marginTop: 8 }]}>
                By signing up you agree to our{" "}
                <Text style={styles.toggleLink} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={styles.toggleLink} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy Policy</Text>.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Email Verification Screen ─────────────────────────────────
export const EmailVerificationScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const email = route?.params?.email ?? "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: "rgba(108,99,255,0.12)",
          borderWidth: 2, borderColor: colors.accent,
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}>
          <Feather name="mail" size={36} color={colors.accent} />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.textPrimary, textAlign: "center", marginBottom: 12 }}>
          Check your email
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
          We sent a verification link to{"\n"}
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{email}</Text>
          {"\n\n"}Tap the link in the email to activate your account, then come back and sign in.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Auth")}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: 14, paddingHorizontal: 32,
            borderRadius: 12, width: "100%", alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default AuthScreen;