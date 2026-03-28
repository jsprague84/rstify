import React from "react";
import { create } from "zustand";
import { useColorScheme } from "react-native";
import { storage } from "../storage/mmkv";

const THEME_KEY = "rstify_theme_mode";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;

  // Derived state - actual theme being used
  activeTheme: "light" | "dark";

  setMode: (mode: ThemeMode) => void;
  updateActiveTheme: (systemTheme: string | null | undefined) => void;
}

// Read saved mode synchronously at store creation time
const savedMode = storage.getString(THEME_KEY) as ThemeMode | undefined;

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: savedMode ?? "system",
  activeTheme: "light",

  setMode: (mode: ThemeMode) => {
    storage.set(THEME_KEY, mode);
    set({ mode });
  },

  updateActiveTheme: (systemTheme: string | null | undefined) => {
    const { mode } = get();
    let activeTheme: "light" | "dark" = "light";

    if (mode === "system") {
      activeTheme = systemTheme === "dark" ? "dark" : "light";
    } else {
      activeTheme = mode;
    }

    set({ activeTheme });
  },
}));

// Hook to get current theme
export function useTheme() {
  const systemColorScheme = useColorScheme();
  const { mode, activeTheme, updateActiveTheme } = useThemeStore();

  // Update active theme when system theme or mode changes
  React.useEffect(() => {
    updateActiveTheme(systemColorScheme);
  }, [systemColorScheme, mode, updateActiveTheme]);

  return {
    isDark: activeTheme === "dark",
    mode,
    activeTheme,
  };
}
