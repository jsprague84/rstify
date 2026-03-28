import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../design/AnimatedPressable';

interface SettingsRowProps {
  title: string;
  value?: string;
  href?: string;
  onPress?: () => void;
}

export function SettingsRow({ title, value, href, onPress }: SettingsRowProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (href) {
      router.push(href as never);
    }
  };

  return (
    <AnimatedPressable
      className="bg-white dark:bg-surface-card rounded-lg px-4 py-3 flex-row items-center justify-between"
      onPress={handlePress}
    >
      <Text className="text-base text-slate-900 dark:text-slate-100">{title}</Text>
      <View className="flex-row items-center gap-2">
        {value ? (
          <Text className="text-sm text-slate-500 dark:text-slate-400">{value}</Text>
        ) : null}
        {(href || onPress) && (
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        )}
      </View>
    </AnimatedPressable>
  );
}
