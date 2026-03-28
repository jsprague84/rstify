import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export const EmptyState = React.memo(function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    opacity.value = withSpring(1, { damping: 20, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View className="flex-1 justify-center items-center p-8">
      <Animated.View style={animatedStyle} className="items-center">
        <Ionicons name={icon} size={48} color="#94a3b8" />
        <Text className="text-base font-semibold text-slate-400 dark:text-slate-500 mt-3">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-slate-400 dark:text-slate-500 mt-1 text-center">
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
});
