import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface SkeletonShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  className?: string;
}

export function SkeletonShimmer({
  width = '100%',
  height = 16,
  borderRadius = 8,
  className,
}: SkeletonShimmerProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800 }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={className ?? 'bg-surface-elevated dark:bg-surface-elevated'}
      style={[
        animatedStyle,
        {
          width: width as number,
          height,
          borderRadius,
        },
      ]}
    />
  );
}

export function MessageCardSkeleton() {
  return (
    <View className="bg-white dark:bg-surface-card mx-4 my-1 rounded-lg p-3">
      {/* Header row: icon + title lines */}
      <View className="flex-row items-center gap-3 mb-3">
        {/* Icon placeholder */}
        <SkeletonShimmer width={32} height={32} borderRadius={8} />
        <View className="flex-1 gap-2">
          {/* Title */}
          <SkeletonShimmer width="60%" height={14} borderRadius={6} />
          {/* Subtitle */}
          <SkeletonShimmer width="40%" height={11} borderRadius={5} />
        </View>
      </View>
      {/* Body text lines */}
      <View className="gap-2">
        <SkeletonShimmer height={13} borderRadius={6} />
        <SkeletonShimmer width="85%" height={13} borderRadius={6} />
        <SkeletonShimmer width="55%" height={13} borderRadius={6} />
      </View>
    </View>
  );
}
