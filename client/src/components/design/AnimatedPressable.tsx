import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  type AnimatedProps,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends PressableProps {
  scaleDown?: number;
  haptic?: boolean;
  className?: string;
  children?: React.ReactNode;
  entering?: AnimatedProps<PressableProps>['entering'];
  exiting?: AnimatedProps<PressableProps>['exiting'];
}

export function AnimatedPressable({
  scaleDown = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  children,
  style,
  entering,
  exiting,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
    scale.value = withSpring(scaleDown, { damping: 15, stiffness: 300 });
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    onPressOut?.(e);
  };

  return (
    <AnimatedPressableBase
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style as object]}
      entering={entering}
      exiting={exiting}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
