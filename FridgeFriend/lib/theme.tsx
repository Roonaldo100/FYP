import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type AppColors } from "../styles/tokens";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: AppColors;
  loaded: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

const THEME_STORAGE_KEY = "fridgefriend_theme_mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") {
          setModeState(saved);
        }
      } catch (e) {
        console.error("Load theme error:", e);
      } finally {
        setLoaded(true);
      }
    };

    loadTheme();
  }, []);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (e) {
      console.error("Save theme error:", e);
    }
  };

  const toggleMode = async () => {
    await setMode(mode === "dark" ? "light" : "dark");
  };

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      colors: mode === "dark" ? darkColors : lightColors,
      loaded,
      setMode,
      toggleMode,
    }),
    [mode, loaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}