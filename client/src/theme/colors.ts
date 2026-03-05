/**
 * Comprehensive color palette for rstify mobile app
 * Supports both light and dark modes with beautiful, accessible colors
 */

export const Colors = {
  light: {
    // Backgrounds
    background: "#FFFFFF",
    backgroundSecondary: "#F9FAFB",
    backgroundTertiary: "#F3F4F6",

    // Surfaces
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",

    // Text
    text: "#111827",
    textSecondary: "#6B7280",
    textTertiary: "#9CA3AF",
    textInverse: "#FFFFFF",

    // Borders
    border: "#E5E7EB",
    borderLight: "#F3F4F6",
    borderFocus: "#3B82F6",

    // Primary (Blue)
    primary: "#2563EB",
    primaryLight: "#60A5FA",
    primaryDark: "#1D4ED8",

    // Success (Green)
    success: "#10B981",
    successLight: "#34D399",
    successDark: "#059669",

    // Warning (Orange)
    warning: "#F59E0B",
    warningLight: "#FBBF24",
    warningDark: "#D97706",

    // Error (Red)
    error: "#EF4444",
    errorLight: "#F87171",
    errorDark: "#DC2626",

    // Info
    info: "#3B82F6",
    infoLight: "#60A5FA",

    // Accent colors
    accent: "#8B5CF6",
    accentLight: "#A78BFA",

    // Status bar
    statusBar: "dark",
  },

  dark: {
    // Backgrounds
    background: "#0F172A", // Slate-900
    backgroundSecondary: "#1E293B", // Slate-800
    backgroundTertiary: "#334155", // Slate-700

    // Surfaces
    surface: "#1E293B",
    surfaceElevated: "#334155",

    // Text
    text: "#F1F5F9",
    textSecondary: "#CBD5E1",
    textTertiary: "#94A3B8",
    textInverse: "#0F172A",

    // Borders
    border: "#334155",
    borderLight: "#1E293B",
    borderFocus: "#60A5FA",

    // Primary (Blue)
    primary: "#60A5FA",
    primaryLight: "#93C5FD",
    primaryDark: "#3B82F6",

    // Success (Green)
    success: "#34D399",
    successLight: "#6EE7B7",
    successDark: "#10B981",

    // Warning (Orange)
    warning: "#FBBF24",
    warningLight: "#FCD34D",
    warningDark: "#F59E0B",

    // Error (Red)
    error: "#F87171",
    errorLight: "#FCA5A5",
    errorDark: "#EF4444",

    // Info
    info: "#60A5FA",
    infoLight: "#93C5FD",

    // Accent colors
    accent: "#A78BFA",
    accentLight: "#C4B5FD",

    // Status bar
    statusBar: "light",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorKey = keyof typeof Colors.light;
