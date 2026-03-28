import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SegmentedControlProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
}: SegmentedControlProps) {
  const handlePress = (index: number) => {
    if (index === selectedIndex) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onChange(index);
  };

  return (
    <View className="flex-row bg-surface-light-elevated dark:bg-surface-elevated rounded-lg p-0.5 gap-0.5">
      {segments.map((label, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable
            key={label}
            onPress={() => handlePress(index)}
            className={`flex-1 py-1.5 rounded-md items-center justify-center ${
              isSelected
                ? 'bg-white dark:bg-surface-card shadow-sm'
                : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-body font-medium ${
                isSelected
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
