// ============================================================
// utils/theme.js
// Central design system for TaskFlow.
// All colors, typography, spacing, and shadow styles live here.
// Import this file instead of hardcoding values in components.
// ============================================================

export const colors = {
  // ── Background layers ──────────────────────────────────────
  bg: "#0A0A0F",          // Deep space black
  bgCard: "#13131A",      // Slightly lighter card background
  bgElevated: "#1C1C27",  // Elevated surfaces, modals
  bgInput: "#1C1C27",     // Form inputs

  // ── Brand / Accent ─────────────────────────────────────────
  accent: "#6C63FF",       // Primary purple
  accentLight: "#8B84FF",  // Hover/active state
  accentGlow: "rgba(108, 99, 255, 0.2)",  // Glow/shadow

  // ── Semantic colors ────────────────────────────────────────
  high: "#FF5C5C",         // High priority / danger
  highGlow: "rgba(255, 92, 92, 0.15)",
  medium: "#FFB347",       // Medium priority / warning
  mediumGlow: "rgba(255, 179, 71, 0.15)",
  low: "#5CFF8F",          // Low priority / success
  lowGlow: "rgba(92, 255, 143, 0.15)",

  // ── Text ───────────────────────────────────────────────────
  textPrimary: "#F0F0FF",    // Headings
  textSecondary: "#8888AA",  // Subtitles, meta
  textMuted: "#44445A",      // Disabled, placeholder

  // ── Borders ────────────────────────────────────────────────
  border: "#22222E",
  borderLight: "#2A2A38",

  // ── Utility ────────────────────────────────────────────────
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
  overlay: "rgba(0,0,0,0.7)",
};

export const typography = {
  // Display / Hero text
  display: {
    fontFamily: "System",
    fontWeight: "800",
    fontSize: 32,
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  // Section headings
  h1: {
    fontWeight: "700",
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  h2: {
    fontWeight: "600",
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  h3: {
    fontWeight: "600",
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Body text
  body: {
    fontWeight: "400",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  bodySmall: {
    fontWeight: "400",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  // Labels / captions
  label: {
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  accent: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Priority label → color mapping
export const priorityColors = {
  HIGH: colors.high,
  MEDIUM: colors.medium,
  LOW: colors.low,
};

export const priorityGlow = {
  HIGH: colors.highGlow,
  MEDIUM: colors.mediumGlow,
  LOW: colors.lowGlow,
};
