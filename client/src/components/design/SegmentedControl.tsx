import React from 'react';
import { View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedPressable } from './ThemedPressable';

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
          <ThemedPressable
            key={label}
            onPress={() => handlePress(index)}
            style={(isDark) => ({
              flex: 1,
              paddingVertical: 6,
              borderRadius: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSelected
                ? (isDark ? '#1e293b' : '#ffffff')
                : 'transparent',
            })}
          >
            <Text
              className={
                isSelected
                  ? 'text-body font-medium text-gray-900 dark:text-white'
                  : 'text-body font-medium text-gray-500 dark:text-gray-400'
              }
            >
              {label}
            </Text>
          </ThemedPressable>
        );
      })}
    </View>
  );
}
