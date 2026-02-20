// ============================================================
// screens/AuthScreen.js
// Sign in / Sign up screen with email & password.
// Toggles between login and register mode.
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../hooks/useAuth";
import { colors, typography, spacing, radius, shadows } from "../utils/theme";

const AuthScreen = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    // Validation
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (err) {
      // Firebase auth error messages are user-friendly
      const msg = err.message || "Authentication failed";
      if (msg.includes("user-not-found") || msg.includes("wrong-password")) {
        setError("Invalid email or password");
      } else if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists");
      } else if (msg.includes("invalid-email")) {
        setError("Please enter a valid email address");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Feather name="check-square" size={32} color={colors.accent} />
            </View>
            <Text style={styles.brandName}>TaskFlow</Text>
            <Text style={styles.brandTagline}>
              AI-powered productivity for focused minds
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isLogin ? "Welcome back" : "Create account"}
            </Text>

            {/* Email input */}
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="mail"
                  size={16}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password input */}
            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputWrap}>
                <Feather
                  name="lock"
                  size={16}
                  color={colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm password (register only) */}
            {!isLogin && (
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <Feather
                    name="lock"
                    size={16}
                    color={colors.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </View>
            )}

            {/* Error */}
            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.high} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Feather
                    name={isLogin ? "log-in" : "user-plus"}
                    size={18}
                    color={colors.white}
                  />
                  <Text style={styles.submitText}>
                    {isLogin ? "Sign In" : "Create Account"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Toggle */}
            <TouchableOpacity
              onPress={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              style={styles.toggleBtn}
            >
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <Text style={styles.toggleLink}>
                  {isLogin ? "Sign Up" : "Sign In"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  kav: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },
  brand: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accentGlow,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.accent,
  },
  brandName: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  brandTagline: {
    ...typography.body,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTitle: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingLeft: 42,
    paddingVertical: 13,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputIcon: {
    position: "absolute",
    left: 14,
    top: 15,
    zIndex: 1,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 15,
    zIndex: 1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.md,
    backgroundColor: "rgba(255,92,92,0.1)",
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  errorText: {
    color: colors.high,
    fontSize: 13,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
    ...shadows.accent,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  toggleBtn: {
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.xs,
  },
  toggleText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  toggleLink: {
    color: colors.accent,
    fontWeight: "600",
  },
});

export default AuthScreen;
