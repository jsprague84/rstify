import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const SWIPE_THRESHOLD = 80;
const ITEM_HEIGHT = 80; // approximate, animates out on trigger

interface SwipeableRowProps {
  onDelete?: () => void;
  onArchive?: () => void;
  children: React.ReactNode;
}

export function SwipeableRow({ onDelete, onArchive, children }: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue(ITEM_HEIGHT);
  const rowOpacity = useSharedValue(1);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  const triggerDelete = () => {
    triggerHaptic();
    onDelete?.();
  };

  const triggerArchive = () => {
    triggerHaptic();
    onArchive?.();
  };

  const slideOut = (direction: 'left' | 'right', callback: () => void) => {
    const target = direction === 'left' ? -400 : 400;
    translateX.value = withTiming(target, { duration: 250 });
    rowOpacity.value = withTiming(0, { duration: 200 });
    rowHeight.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(callback)();
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      // Only allow swipe left if onDelete is provided, right if onArchive is provided
      if (event.translationX < 0 && onDelete) {
        translateX.value = event.translationX;
      } else if (event.translationX > 0 && onArchive) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD && onDelete) {
        runOnJS(slideOut)('left', triggerDelete);
      } else if (event.translationX > SWIPE_THRESHOLD && onArchive) {
        runOnJS(slideOut)('right', triggerArchive);
      } else {
        // Spring back
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: rowOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    height: rowHeight.value,
    overflow: 'hidden',
  }));

  // Background behind the row — shows delete (red) on left-swipe, read (blue) on right-swipe
  const deleteVisible = useAnimatedStyle(() => ({
    opacity: translateX.value < -10 ? 1 : 0,
  }));

  const archiveVisible = useAnimatedStyle(() => ({
    opacity: translateX.value > 10 ? 1 : 0,
  }));

  return (
    <Animated.View style={containerStyle}>
      {/* Background actions */}
      <View style={StyleSheet.absoluteFill} className="flex-row">
        {/* Archive/read background (right-swipe) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, archiveVisible]}
          className="bg-primary flex-row items-center pl-5"
        >
          <Text className="text-white font-semibold text-body">Read</Text>
        </Animated.View>
        {/* Delete background (left-swipe) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, deleteVisible]}
          className="bg-error flex-row items-center justify-end pr-5"
        >
          <Text className="text-white font-semibold text-body">Delete</Text>
        </Animated.View>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={rowStyle}
          accessibilityHint="Swipe left to delete, swipe right to mark as read"
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
