import { useMemo } from "react";
import { useTheme } from "./theme";
import { makeCommonStyles } from "../styles/common";
import { makeButtonStyles } from "../styles/buttons";
import { makeFormStyles } from "../styles/forms";
import { makeModalStyles } from "../styles/modals";

export function useAppStyles() {
  const theme = useTheme();

  const commonStyles = useMemo(() => makeCommonStyles(theme.colors), [theme.colors]);
  const buttonStyles = useMemo(() => makeButtonStyles(theme.colors), [theme.colors]);
  const formStyles = useMemo(() => makeFormStyles(theme.colors), [theme.colors]);
  const modalStyles = useMemo(() => makeModalStyles(theme.colors), [theme.colors]);

  return {
    ...theme,
    commonStyles,
    buttonStyles,
    formStyles,
    modalStyles,
  };
}