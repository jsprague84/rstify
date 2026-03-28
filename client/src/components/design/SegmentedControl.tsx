import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

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
          <TouchableOpacity
            key={label}
            activeOpacity={0.7}
            onPress={() => handlePress(index)}
            style={{
              flex: 1,
              paddingVertical: 6,
              borderRadius: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSelected
                ? (isDark ? '#1e293b' : '#ffffff')
                : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: isSelected
                  ? (isDark ? '#ffffff' : '#111827')
                  : (isDark ? '#9ca3af' : '#6b7280'),
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
