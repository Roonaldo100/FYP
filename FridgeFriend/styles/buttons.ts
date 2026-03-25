// styles/buttons.ts
import { StyleSheet } from "react-native";
import { colors, fontSize, fontWeight, radius, spacing } from "./tokens";

export const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  primary: {
    backgroundColor: colors.primary,
  },

  primaryText: {
    color: colors.primaryTextOn,
    fontWeight: fontWeight.black,
    fontSize: fontSize.sm,
  },

  accent: {
    backgroundColor: colors.accent,
  },

  accentText: {
    color: colors.accentText,
    fontWeight: fontWeight.heavy,
    fontSize: fontSize.sm,
  },

  secondary: {
    backgroundColor: colors.surfaceAlt,
  },

  secondaryText: {
    color: colors.text,
    fontWeight: fontWeight.heavy,
    fontSize: fontSize.sm,
  },

  light: {
    backgroundColor: colors.surface,
  },

  lightText: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },

  danger: {
    backgroundColor: colors.danger,
  },

  dangerText: {
    color: colors.dangerTextOn,
    fontWeight: fontWeight.black,
    fontSize: fontSize.sm,
  },

  pill: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  gridButton: {
    width: 150,
    height: 60,
    margin: 5,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});