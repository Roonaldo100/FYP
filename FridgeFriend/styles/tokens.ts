// styles/tokens.ts
export const colors = {
  primary: "#663399",
  primaryTextOn: "#ffffff",

  accent: "#ffcc00",
  accentText: "#333333",

  surface: "#ffffff",
  surfaceAlt: "#eeeeee",
  surfaceMuted: "#f7f7f7",

  text: "#333333",
  textMuted: "#666666",
  textLight: "#cccccc",

  border: "#dddddd",
  borderSoft: "#eeeeee",

  danger: "#b00020",
  dangerTextOn: "#ffffff",

  overlay: "rgba(0,0,0,0.5)",
  loadingOverlay: "#0008",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 20,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  pill: 999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export const fontWeight = {
  normal: "400" as const,
  medium: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
  black: "900" as const,
};