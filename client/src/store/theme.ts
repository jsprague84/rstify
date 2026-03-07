import React from "react";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

const THEME_KEY = "rstify_theme_mode";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  isLoading: boolean;

  // Derived state - actual theme being used
  activeTheme: "light" | "dark";

  initialize: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  updateActiveTheme: (systemTheme: "light" | "dark" | null) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  isLoading: true,
  activeTheme: "light",

  initialize: async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_KEY);
      const mode = (savedMode as ThemeMode) ?? "system";
      set({ mode, isLoading: false });
    } catch {
      set({ mode: "system", isLoading: false });
    }
  },

  setMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
      set({ mode });
    } catch (error) {
      console.error("Failed to save theme mode:", error);
    }
  },

  updateActiveTheme: (systemTheme: "light" | "dark" | null) => {
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

