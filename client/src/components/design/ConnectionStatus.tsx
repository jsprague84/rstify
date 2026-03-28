import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStatusProps {
  status: ConnectionState;
}

const DOT_CLASSES: Record<ConnectionState, string> = {
  connected: 'bg-success',
  reconnecting: 'bg-warning',
  disconnected: 'bg-error',
};

const LABELS: Record<ConnectionState, string> = {
  connected: 'Live',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

const LABEL_CLASSES: Record<ConnectionState, string> = {
  connected: 'text-success text-caption',
  reconnecting: 'text-warning text-caption',
  disconnected: 'text-error text-caption',
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (status === 'connected') {
      opacity.value = withRepeat(
        withTiming(0.3, { duration: 1000 }),
        -1,
        true,
      );
    } else {
      opacity.value = 1;
    }
  }, [status, opacity]);

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className="flex-row items-center gap-1.5">
      <Animated.View
        className={`w-2 h-2 rounded-full ${DOT_CLASSES[status]}`}
        style={dotAnimatedStyle}
      />
      <Text className={LABEL_CLASSES[status]}>{LABELS[status]}</Text>
    </View>
  );
}
