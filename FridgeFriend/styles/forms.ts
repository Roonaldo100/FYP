// styles/forms.ts
import { StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize, fontWeight } from "./tokens";

export const formStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
  },

  inputWide: {
    width: "100%",
  },

  inputFixed: {
    width: 280,
  },

  inputAlt: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    color: colors.text,
  },

  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    color: colors.text,
  },

  fieldGroup: {
    marginBottom: spacing.xl,
  },

  buttonGroupRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});