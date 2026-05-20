// ============================================================
// utils/theme.js — pure constants only, NO React imports
// This file must never import from screens or components.
// ============================================================

export const COLOR_THEMES = {
  purple: { key: "purple", label: "Purple", accent: "#7C3AED", accentLight: "#A78BFA", accentGlowDark: "rgba(124,58,237,0.20)", accentGlowLight: "rgba(124,58,237,0.14)", bgLight: "#EDE8F8", cardLight: "#F5F1FE" },
  blue:   { key: "blue",   label: "Blue",   accent: "#3B82F6", accentLight: "#60A5FA", accentGlowDark: "rgba(59,130,246,0.18)",  accentGlowLight: "rgba(59,130,246,0.22)",  bgLight: "#EAF0FC", cardLight: "#F5F8FF" },
  green:  { key: "green",  label: "Green",  accent: "#10B981", accentLight: "#34D399", accentGlowDark: "rgba(16,185,129,0.18)",  accentGlowLight: "rgba(16,185,129,0.22)",  bgLight: "#E8F5F1", cardLight: "#F4FBF8" },
  pink:   { key: "pink",   label: "Pink",   accent: "#EC4899", accentLight: "#F472B6", accentGlowDark: "rgba(236,72,153,0.18)",  accentGlowLight: "rgba(236,72,153,0.22)",  bgLight: "#FAE9F3", cardLight: "#FEF4FA" },
  orange: { key: "orange", label: "Orange", accent: "#F97316", accentLight: "#FB923C", accentGlowDark: "rgba(249,115,22,0.18)",  accentGlowLight: "rgba(249,115,22,0.22)",  bgLight: "#FAF0E8", cardLight: "#FEF8F3" },
  yellow: { key: "yellow", label: "Yellow", accent: "#EAB308", accentLight: "#FACC15", accentGlowDark: "rgba(234,179,8,0.18)",   accentGlowLight: "rgba(234,179,8,0.22)",   bgLight: "#FAF4E0", cardLight: "#FEFBF0" },
  red:    { key: "red",    label: "Red",    accent: "#EF4444", accentLight: "#F87171", accentGlowDark: "rgba(239,68,68,0.18)",   accentGlowLight: "rgba(239,68,68,0.22)",   bgLight: "#FAE8E8", cardLight: "#FEF4F4" },
};

const DARK_BASE = {
  bg:            "#0A0A0F",
  bgCard:        "#13131A",
  bgElevated:    "#1C1C27",
  bgInput:       "#1C1C27",
  textPrimary:   "#F0F0FF",
  textSecondary: "#8888AA",
  textMuted:     "#44445A",
  border:        "#22222E",
  borderLight:   "#2A2A38",
  overlay:       "rgba(0,0,0,0.7)",
  isDark:        true,
};

const LIGHT_BASE = {
  bg:            "#F7F7F9",   // was #F0F0F7 — less purple tint
  bgCard:        "#FFFFFF",
  bgElevated:    "#EFEFEF",   // was #E8E8F2
  bgInput:       "#F2F2F5",   // was #F5F5FA
  textPrimary:   "#0D0D14",   // was #0A0A1A — slightly softer
  textSecondary: "#52526B",   // was #44445A — lighter, more readable
  textMuted:     "#9898B0",   // was #8888A0
  border:        "#E5E5EC",   // was #D8D8E8 — much softer
  borderLight:   "#EFEFF5",   // was #E4E4F0
  isDark:        false,
};

export const buildColors = (isDark, accentKey) => {
  const base   = isDark ? DARK_BASE : LIGHT_BASE;
  const accent = COLOR_THEMES[accentKey] ?? COLOR_THEMES.purple;
  return {
    ...base,
    ...(isDark ? {} : { bgCard: accent.cardLight }),
    accent:      accent.accent,
    accentLight: accent.accentLight,
    accentGlow:  isDark ? accent.accentGlowDark : accent.accentGlowLight,
    high:        isDark ? "#FF5C5C" : "#DC2626",
    highGlow:    isDark ? "rgba(255,92,92,0.15)"  : "rgba(220,38,38,0.14)",
    medium:      isDark ? "#FFB347" : "#D97706",
    mediumGlow:  isDark ? "rgba(255,179,71,0.15)" : "rgba(217,119,6,0.14)",
    low:         isDark ? "#5CFF8F" : "#059669",
    lowGlow:     isDark ? "rgba(92,255,143,0.15)" : "rgba(5,150,105,0.14)",
    // In light mode cards have no border — shadows provide depth instead
    cardBorder:  isDark ? base.border : "transparent",
    cardBorderW: isDark ? 1 : 0,
    white:       "#FFFFFF",
    black:       "#000000",
    transparent: "transparent",
  };
};

// Default dark/purple — used as fallback before context is ready
export const colors = buildColors(true, "purple");

// Legacy shims so old code that calls getAccentColors() still works
export const getAccentColors = () => ({
  accent:       colors.accent,
  accentLight:  colors.accentLight,
  accentGlow:   colors.accentGlow,
  accentShadow: {
    shadowColor:   colors.accent,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius:  12,
    elevation:     8,
  },
});
export const setActiveTheme = () => {};
export const getActiveTheme = () => COLOR_THEMES.purple;

export const typography = {
  display:   { fontFamily: "Outfit-ExtraBold", fontSize: 32, letterSpacing: -1   },
  h1:        { fontFamily: "Outfit-Bold",      fontSize: 24, letterSpacing: -0.5 },
  h2:        { fontFamily: "Outfit-SemiBold",  fontSize: 18, letterSpacing: -0.3 },
  h3:        { fontFamily: "Outfit-SemiBold",  fontSize: 15 },
  body:      { fontFamily: "Outfit-Regular",   fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: "Outfit-Regular",   fontSize: 12, lineHeight: 17 },
  label:     { fontFamily: "Outfit-SemiBold",  fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
};

export const spacing  = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius   = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export const makeShadows = (accent) => ({
  card: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  accent: {
    shadowColor: accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});

export const shadows = makeShadows("#9060E8");

export const priorityColors = (isDark = true) => isDark
  ? { HIGH: "#FF5C5C", MEDIUM: "#FFB347", LOW: "#5CFF8F" }
  : { HIGH: "#DC2626", MEDIUM: "#D97706", LOW: "#059669" };

// ── Class colors ──────────────────────────────────────────────
// Deterministic hash → one of 8 vivid colors. Same class name always
// gets the same color across every screen.

export const CLASS_COLORS_DARK  = [
  "#9060E8", "#FF6B6B", "#FFB347", "#5CFF8F",
  "#5BC8FF", "#FF8EE8", "#FFE45C", "#A8FF78",
];
export const CLASS_COLORS_LIGHT = [
  "#7C3AED", "#DC2626", "#D97706", "#059669",
  "#0284C7", "#C026D3", "#B45309", "#16A34A",
];
// Keep old export for any code that hasn't been updated
export const CLASS_COLORS = CLASS_COLORS_DARK;

export const getClassColor = (className, isDark = true) => {
  if (!className || typeof className !== "string") return isDark ? "#44445A" : "#6B7280";
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = isDark ? CLASS_COLORS_DARK : CLASS_COLORS_LIGHT;
  return palette[Math.abs(hash) % palette.length];
};
export const priorityGlow = (isDark = true) => isDark
  ? { HIGH: "rgba(255,92,92,0.15)",  MEDIUM: "rgba(255,179,71,0.15)", LOW: "rgba(92,255,143,0.15)" }
  : { HIGH: "rgba(220,38,38,0.12)",  MEDIUM: "rgba(217,119,6,0.12)",  LOW: "rgba(5,150,105,0.12)"  };