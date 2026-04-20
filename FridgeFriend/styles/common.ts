// styles/common.ts
import { StyleSheet } from "react-native";
import { fontSize, fontWeight, radius, spacing, type AppColors, lightColors } from "./tokens";

export const makeCommonStyles = (colors: AppColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      padding: spacing.xxxl,
      backgroundColor: colors.surfaceMuted,
    },

    screenPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
      padding: spacing.xxxl,
    },

    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    centeredContent: {
      alignItems: "center",
      justifyContent: "center",
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
    },

    wrapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    section: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xxl,
      marginBottom: spacing.xxxl,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
    },

    title: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      color: colors.text,
    },

    titleOnPrimary: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      color: colors.primaryTextOn,
    },

    sectionTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.lg,
      color: colors.text,
    },

    label: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      marginBottom: spacing.xs,
      color: colors.text,
    },

    helperText: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },

    divider: {
      height: 1,
      backgroundColor: colors.borderSoft,
    },

    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.loadingOverlay,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
  });

export const commonStyles = makeCommonStyles(lightColors);