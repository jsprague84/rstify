/**
 * ThemedPressable — NativeWind v4 safe interactive element.
 *
 * NativeWind v4's CSS interop on Pressable can crash with "Couldn't find
 * a navigation context" during conditional re-renders. This component
 * uses TouchableOpacity with useColorScheme for theme-aware styling,
 * bypassing the interop entirely.
 *
 * Use this instead of <Pressable className="..."> anywhere you need
 * theme-aware interactive elements. For non-interactive containers,
 * <View className="..."> is fine.
 *
 * For animated press effects (scale + haptics), use AnimatedPressable
 * instead — it uses Reanimated's wrapper which bypasses the interop.
 */
import React from "react";
import {
  TouchableOpacity,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useColorScheme } from "nativewind";

type ThemeStyleFn = (isDark: boolean) => StyleProp<ViewStyle>;

interface ThemedPressableProps extends Omit<TouchableOpacityProps, "style"> {
  /** Static style or theme-aware function: (isDark) => style */
  style?: StyleProp<ViewStyle> | ThemeStyleFn;
}

export function ThemedPressable({
  style,
  activeOpacity = 0.7,
  children,
  ...rest
}: ThemedPressableProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const resolvedStyle = typeof style === "function" ? style(isDark) : style;

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      style={resolvedStyle}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
}
