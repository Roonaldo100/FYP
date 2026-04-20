// styles/modals.ts
import { StyleSheet } from "react-native";
import { fontSize, fontWeight, radius, spacing, type AppColors, lightColors } from "./tokens";

export const makeModalStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      padding: spacing.xxl,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
    },

    title: {
      fontWeight: fontWeight.black,
      fontSize: fontSize.md,
      color: colors.text,
      marginBottom: spacing.md,
    },

    topAction: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },

    topActionText: {
      fontWeight: fontWeight.black,
      color: colors.text,
    },

    row: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceAlt,
    },

    rowText: {
      color: colors.text,
      fontWeight: fontWeight.bold,
    },

    closeButton: {
      marginTop: spacing.lg,
    },
  });

export const modalStyles = makeModalStyles(lightColors);