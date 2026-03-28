import React from "react";
import { create } from "zustand";
import { useColorScheme, Appearance } from "react-native";
import { storage } from "../storage/mmkv";

const THEME_KEY = "rstify_theme_mode";

type ThemeMode = "light" | "dark" | "system";

function resolveActiveTheme(
  mode: ThemeMode,
  systemTheme: string | null | undefined,
): "light" | "dark" {
  if (mode === "system") {
    return systemTheme === "dark" ? "dark" : "light";
  }
  return mode;
}

interface ThemeState {
  mode: ThemeMode;

  // Derived state - actual theme being used
  activeTheme: "light" | "dark";

  setMode: (mode: ThemeMode) => void;
  updateActiveTheme: (systemTheme: string | null | undefined) => void;
}

// Read saved mode synchronously at store creation time
const savedMode = (storage.getString(THEME_KEY) as ThemeMode | undefined) ?? "system";

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: savedMode,
  activeTheme: resolveActiveTheme(savedMode, Appearance.getColorScheme()),

  setMode: (mode: ThemeMode) => {
    const activeTheme = resolveActiveTheme(mode, Appearance.getColorScheme());
    storage.set(THEME_KEY, mode);
    set({ mode, activeTheme });
  },

  updateActiveTheme: (systemTheme: string | null | undefined) => {
    const { mode } = get();
    const activeTheme = resolveActiveTheme(mode, systemTheme);
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
