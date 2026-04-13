// ============================================================
// utils/theme.js — pure constants only, NO React imports
// This file must never import from screens or components.
// ============================================================

export const COLOR_THEMES = {
  purple: { key: "purple", label: "Purple", accent: "#9060E8", accentLight: "#A87AEE", accentGlowDark: "rgba(144,96,232,0.18)", accentGlowLight: "rgba(144,96,232,0.12)" },
  blue:   { key: "blue",   label: "Blue",   accent: "#3B82F6", accentLight: "#60A5FA", accentGlowDark: "rgba(59,130,246,0.18)",  accentGlowLight: "rgba(59,130,246,0.12)"  },
  green:  { key: "green",  label: "Green",  accent: "#10B981", accentLight: "#34D399", accentGlowDark: "rgba(16,185,129,0.18)",  accentGlowLight: "rgba(16,185,129,0.12)"  },
  pink:   { key: "pink",   label: "Pink",   accent: "#EC4899", accentLight: "#F472B6", accentGlowDark: "rgba(236,72,153,0.18)",  accentGlowLight: "rgba(236,72,153,0.12)"  },
  orange: { key: "orange", label: "Orange", accent: "#F97316", accentLight: "#FB923C", accentGlowDark: "rgba(249,115,22,0.18)",  accentGlowLight: "rgba(249,115,22,0.12)"  },
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
  bg:            "#F2F2F7",
  bgCard:        "#FFFFFF",
  bgElevated:    "#E5E5EA",
  bgInput:       "#EBEBF0",
  textPrimary:   "#0A0A1A",
  textSecondary: "#3C3C43",
  textMuted:     "#8E8E93",
  border:        "#C6C6C8",
  borderLight:   "#D1D1D6",
  overlay:       "rgba(0,0,0,0.4)",
  isDark:        false,
};

export const buildColors = (isDark, accentKey) => {
  const base   = isDark ? DARK_BASE : LIGHT_BASE;
  const accent = COLOR_THEMES[accentKey] ?? COLOR_THEMES.purple;
  return {
    ...base,
    accent:      accent.accent,
    accentLight: accent.accentLight,
    accentGlow:  isDark ? accent.accentGlowDark : accent.accentGlowLight,
    high:        "#FF5C5C",
    highGlow:    "rgba(255,92,92,0.15)",
    medium:      "#FFB347",
    mediumGlow:  "rgba(255,179,71,0.15)",
    low:         "#5CFF8F",
    lowGlow:     "rgba(92,255,143,0.15)",
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
  display:   { fontWeight: "800", fontSize: 32, letterSpacing: -1   },
  h1:        { fontWeight: "700", fontSize: 24, letterSpacing: -0.5 },
  h2:        { fontWeight: "600", fontSize: 18, letterSpacing: -0.3 },
  h3:        { fontWeight: "600", fontSize: 15 },
  body:      { fontWeight: "400", fontSize: 14, lineHeight: 20 },
  bodySmall: { fontWeight: "400", fontSize: 12, lineHeight: 17 },
  label:     { fontWeight: "600", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
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

export const priorityColors = { HIGH: "#FF5C5C", MEDIUM: "#FFB347", LOW: "#5CFF8F" };
export const priorityGlow   = {
  HIGH:   "rgba(255,92,92,0.15)",
  MEDIUM: "rgba(255,179,71,0.15)",
  LOW:    "rgba(92,255,143,0.15)",
};