// ============================================================
// utils/theme.js
// Central design system for TaskFlow.
// Color themes are applied by re-exporting a mutable `colors`
// object. Components that need live theme updates should use
// getAccentColors() inline rather than styles from StyleSheet.
// ============================================================

export const COLOR_THEMES = {
  purple: { key: "purple", label: "Purple", accent: "#6C63FF", accentLight: "#8B84FF", accentGlow: "rgba(108,99,255,0.2)" },
  blue:   { key: "blue",   label: "Blue",   accent: "#3B82F6", accentLight: "#60A5FA", accentGlow: "rgba(59,130,246,0.2)" },
  green:  { key: "green",  label: "Green",  accent: "#10B981", accentLight: "#34D399", accentGlow: "rgba(16,185,129,0.2)" },
  pink:   { key: "pink",   label: "Pink",   accent: "#EC4899", accentLight: "#F472B6", accentGlow: "rgba(236,72,153,0.2)" },
  orange: { key: "orange", label: "Orange", accent: "#F97316", accentLight: "#FB923C", accentGlow: "rgba(249,115,22,0.2)" },
};

// Mutable theme state — call setActiveTheme() to swap
let _theme = COLOR_THEMES.purple;

export const setActiveTheme = (key) => {
  _theme = COLOR_THEMES[key] ?? COLOR_THEMES.purple;
};

export const getActiveTheme = () => _theme;

// Returns current accent values — call this inline in components
// so it always reflects the latest theme, not a frozen snapshot.
export const getAccentColors = () => ({
  accent:      _theme.accent,
  accentLight: _theme.accentLight,
  accentGlow:  _theme.accentGlow,
  accentShadow: {
    shadowColor: _theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

// Static colors — these never change with theme
export const colors = {
  bg:         "#0A0A0F",
  bgCard:     "#13131A",
  bgElevated: "#1C1C27",
  bgInput:    "#1C1C27",

  // Accent — always read via getAccentColors() for live theming,
  // but kept here as defaults so existing code doesn't break
  accent:      "#6C63FF",
  accentLight: "#8B84FF",
  accentGlow:  "rgba(108,99,255,0.2)",

  high:       "#FF5C5C",
  highGlow:   "rgba(255,92,92,0.15)",
  medium:     "#FFB347",
  mediumGlow: "rgba(255,179,71,0.15)",
  low:        "#5CFF8F",
  lowGlow:    "rgba(92,255,143,0.15)",

  textPrimary:   "#F0F0FF",
  textSecondary: "#8888AA",
  textMuted:     "#44445A",

  border:      "#22222E",
  borderLight: "#2A2A38",

  white:       "#FFFFFF",
  black:       "#000000",
  transparent: "transparent",
  overlay:     "rgba(0,0,0,0.7)",
};

export const typography = {
  display:   { fontWeight: "800", fontSize: 32, letterSpacing: -1,   color: colors.textPrimary },
  h1:        { fontWeight: "700", fontSize: 24, letterSpacing: -0.5, color: colors.textPrimary },
  h2:        { fontWeight: "600", fontSize: 18, letterSpacing: -0.3, color: colors.textPrimary },
  h3:        { fontWeight: "600", fontSize: 15, color: colors.textPrimary },
  body:      { fontWeight: "400", fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  bodySmall: { fontWeight: "400", fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  label:     { fontWeight: "600", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius  = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

export const shadows = {
  card: {
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  accent: {
    shadowColor: "#6C63FF", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
};

export const priorityColors = { HIGH: colors.high, MEDIUM: colors.medium, LOW: colors.low };
export const priorityGlow   = { HIGH: colors.highGlow, MEDIUM: colors.mediumGlow, LOW: colors.lowGlow };