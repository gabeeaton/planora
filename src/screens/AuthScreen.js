// ============================================================
// src/screens/AuthScreen.js
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Linking, Image, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";
import { resetPassword } from "../services/firebase";
import { VERCEL_API_URL } from "../config";
import { typography, spacing, radius, shadows } from "../utils/theme";
import { useTheme } from "../utils/ThemeContext";
import * as Haptics from "expo-haptics";

const tap = () => Haptics.selectionAsync().catch(() => {});

const makeStyles = (colors) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
  kav:       { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: "center", paddingVertical: spacing.lg },

  // ── Background decoration ──
  orb1: {
    position: "absolute", width: 320, height: 320, borderRadius: 160,
    backgroundColor: colors.accentGlow, top: -100, right: -100,
  },
  orb2: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.accentGlow, bottom: 60, left: -80,
  },

  // ── Brand header ──
  brand:    { marginBottom: spacing.xl },
  logoHalo: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: colors.accentGlow,
    borderWidth: 1, borderColor: colors.accent + "40",
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoMark: {
    width: 64, height: 64, borderRadius: 16,
    overflow: "hidden",
  },
  logoImg:      { width: "100%", height: "100%" },
  brandName:    { fontSize: 32, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, letterSpacing: -1 },
  brandTagline: { fontSize: 15, color: colors.textSecondary, marginTop: 4, fontFamily: "Outfit-Regular" },

  // ── Divider ──
  divider: {
    height: 1, backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },

  // ── Form ──
  formTitle: { fontSize: 20, fontFamily: "Outfit-Bold", color: colors.textPrimary, marginBottom: spacing.lg, letterSpacing: -0.3 },

  field:     { marginBottom: spacing.sm },
  inputWrap: { position: "relative" },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingLeft: 44,
    paddingVertical: 14, color: colors.textPrimary, fontSize: 15,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.bgElevated },
  inputError: { borderColor: colors.high },
  inputIcon:  { position: "absolute", left: 14, top: 16, zIndex: 1 },
  eyeBtn:     { position: "absolute", right: 14, top: 16, zIndex: 1 },
  fieldError: { fontSize: 12, color: colors.high, marginTop: 4, marginLeft: 4 },

  // Global error
  errorRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: colors.highGlow, padding: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: "rgba(255,92,92,0.3)",
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.high, fontSize: 13, flex: 1, lineHeight: 18 },

  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
    alignItems: "center", justifyContent: "center",
    marginTop: spacing.sm,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Outfit-Bold", letterSpacing: 0.1 },

  forgotBtn:  { alignItems: "center", marginTop: spacing.md },
  forgotText: { fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit-Medium" },

  toggleRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.md },
  toggleText: { fontSize: 14, color: colors.textSecondary },
  toggleLink: { fontSize: 14, color: colors.accent, fontFamily: "Outfit-SemiBold" },

  legalText: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: spacing.md, lineHeight: 16 },
  legalLink:  { color: colors.textMuted, textDecorationLine: "underline" },

  // Forgot password
  successRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(92,255,143,0.1)", padding: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.low,
    marginBottom: spacing.md,
  },
  successText: { color: colors.low, fontSize: 13, flex: 1, lineHeight: 18 },
  resetBack:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
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
const ForgotPasswordScreen = ({ onBack, colors, styles, initialEmail }) => {
  const [email, setEmail]     = useState(initialEmail ?? "");
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
    <View>
      <TouchableOpacity onPress={() => { tap(); onBack(); }} style={styles.resetBack}>
        <Feather name="arrow-left" size={16} color={colors.textSecondary} />
        <Text style={styles.resetBackText}>Back to sign in</Text>
      </TouchableOpacity>

      <Text style={[styles.formTitle, { marginBottom: spacing.xs }]}>Reset password</Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
        Enter your email and we'll send a reset link.
      </Text>

      {sent ? (
        <View style={styles.successRow}>
          <Feather name="check-circle" size={14} color={colors.low} />
          <Text style={styles.successText}>
            A password reset link has been sent to {email}. If it doesn't arrive within a minute, check your spam or junk folder.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
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
            onPress={() => { tap(); handleReset(); }}
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
  const [focusedField, setFocusedField]         = useState(null);

  const passwordRef  = useRef(null);
  const confirmRef   = useRef(null);
  const submitScale  = useRef(new Animated.Value(1)).current;
  const formOpacity  = useRef(new Animated.Value(0)).current;
  const formSlide    = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(formSlide,   { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
    ]).start();
  }, []);

  const onSubmitIn  = () => Animated.spring(submitScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }).start();
  const onSubmitOut = () => Animated.spring(submitScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  const clearErrors = () => {
    setError(""); setEmailError(""); setPasswordError(""); setConfirmError("");
  };

  // When this screen gains focus (including from deep link), always show login
  // and pre-fill the email they registered with if available
  useFocusEffect(useCallback(() => {
    setMode("login");
    clearErrors();
    AsyncStorage.getItem("@planora_pending_email").then((saved) => {
      if (saved) setEmail(saved);
    }).catch(() => {});
  }, []));

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
        AsyncStorage.removeItem("@planora_pending_email").catch(() => {});
      } else {
        await register(email.trim(), password);
        AsyncStorage.setItem("@planora_pending_email", email.trim()).catch(() => {});
        // Send branded verification email via Resend — non-blocking
        fetch(`${VERCEL_API_URL}/api/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-secret": process.env.EXPO_PUBLIC_EMAIL_API_SECRET ?? "",
          },
          body: JSON.stringify({ type: "verify", email: email.trim() }),
        }).catch(() => {});
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
        <View style={styles.orb1} pointerEvents="none" />
        <View style={styles.orb2} pointerEvents="none" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <View style={styles.logoHalo}>
                <View style={styles.logoMark}>
                  <Image source={require("../assets/logo.jpg")} style={styles.logoImg} resizeMode="cover" />
                </View>
              </View>
              <Text style={styles.brandName}>Planora</Text>
            </View>
            <ForgotPasswordScreen
              onBack={() => { setMode("login"); clearErrors(); }}
              colors={colors}
              styles={styles}
              initialEmail={email}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Login / Register ──────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.kav}>
        <Animated.ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          style={{ opacity: formOpacity, transform: [{ translateY: formSlide }] }}
        >

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoHalo}>
              <View style={styles.logoMark}>
                <Image source={require("../assets/logo.jpg")} style={styles.logoImg} resizeMode="cover" />
              </View>
            </View>
            <Text style={styles.brandName}>Planora</Text>
            <Text style={styles.brandTagline}>Find your focus.</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Form title */}
          <Text style={styles.formTitle}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <View style={styles.inputWrap}>
              <Feather
                name="mail" size={16}
                color={emailError ? colors.high : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, focusedField === "email" && styles.inputFocused, emailError && styles.inputError]}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(""); if (error) setError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                selectionColor={colors.accent}
                returnKeyType="next"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
            {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <View style={styles.inputWrap}>
              <Feather
                name="lock" size={16}
                color={passwordError ? colors.high : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { paddingRight: 44 }, focusedField === "password" && styles.inputFocused, passwordError && styles.inputError]}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(v) => { setPassword(v); if (passwordError) setPasswordError(""); if (error) setError(""); }}
                secureTextEntry={!showPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                textContentType={mode === "login" ? "password" : "newPassword"}
                selectionColor={colors.accent}
                returnKeyType={mode === "login" ? "done" : "next"}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={mode === "login" ? handleSubmit : () => confirmRef.current?.focus()}
              />
              <TouchableOpacity onPress={() => { tap(); setShowPassword((v) => !v); }} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
          </View>

          {/* Confirm password (register only) */}
          {mode === "register" && (
            <View style={styles.field}>
              <View style={styles.inputWrap}>
                <Feather
                  name="lock" size={16}
                  color={confirmError ? colors.high : colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={confirmRef}
                  style={[styles.input, focusedField === "confirm" && styles.inputFocused, confirmError && styles.inputError]}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); if (confirmError) setConfirmError(""); }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  selectionColor={colors.accent}
                  returnKeyType="done"
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
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
          <Animated.View style={{ transform: [{ scale: submitScale }] }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); handleSubmit(); }}
              onPressIn={onSubmitIn}
              onPressOut={onSubmitOut}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              disabled={loading}
              activeOpacity={1}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{mode === "login" ? "Sign In" : "Sign Up"}</Text>
              }
            </TouchableOpacity>
          </Animated.View>

          {/* Forgot password */}
          {mode === "login" && (
            <TouchableOpacity
              onPress={() => { tap(); setMode("forgot"); clearErrors(); }}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </TouchableOpacity>
          )}

          {/* Toggle login / register */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {mode === "login" ? "Don't have an account?  " : "Already have an account?  "}
            </Text>
            <TouchableOpacity onPress={() => { tap(); setMode(mode === "login" ? "register" : "login"); clearErrors(); }}>
              <Text style={styles.toggleLink}>{mode === "login" ? "Sign Up" : "Sign In"}</Text>
            </TouchableOpacity>
          </View>

          {/* Legal (register only) */}
          {mode === "register" && (
            <Text style={styles.legalText}>
              By signing up you agree to our{" "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/terms")}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL("https://planoraapp.net/privacy")}>Privacy Policy</Text>.
            </Text>
          )}

        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Email Verification Screen ─────────────────────────────────
export const EmailVerificationScreen = ({ navigation, route }) => {
  const { colors }        = useTheme();
  const email             = route?.params?.email ?? "";
  const [resent, setResent]   = useState(false);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch(`${VERCEL_API_URL}/api/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-secret": process.env.EXPO_PUBLIC_EMAIL_API_SECRET ?? "",
        },
        body: JSON.stringify({ type: "verify", email }),
      });
      setResent(true);
    } catch {
      Alert.alert("Error", "Could not resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: colors.accentGlow,
          borderWidth: 2, borderColor: colors.accent,
          alignItems: "center", justifyContent: "center",
          marginBottom: 24,
        }}>
          <Feather name="mail" size={36} color={colors.accent} />
        </View>
        <Text style={{ fontSize: 24, fontFamily: "Outfit-ExtraBold", color: colors.textPrimary, textAlign: "center", marginBottom: 12 }}>
          Check your email
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
          We sent a verification link to{"\n"}
          <Text style={{ color: colors.textPrimary, fontFamily: "Outfit-Bold" }}>{email}</Text>
          {"\n\n"}Tap the link to activate your account, then return here to sign in. If you don't see it, check your spam or junk folder.
        </Text>
        <TouchableOpacity
          onPress={() => { tap(); navigation.replace("Auth"); }}
          style={{
            backgroundColor: colors.accent,
            paddingVertical: 14, paddingHorizontal: 32,
            borderRadius: 12, width: "100%", alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", fontFamily: "Outfit-Bold", fontSize: 16 }}>Back to Sign In</Text>
        </TouchableOpacity>
        {resent ? (
          <Text style={{ fontSize: 13, color: colors.low, fontFamily: "Outfit-SemiBold", textAlign: "center" }}>
            Email resent. Check your inbox and spam or junk folder.
          </Text>
        ) : (
          <TouchableOpacity onPress={() => { tap(); handleResend(); }} disabled={resending}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {resending ? "Resending..." : "Didn't get it? Resend email"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default AuthScreen;