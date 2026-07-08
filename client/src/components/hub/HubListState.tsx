import React from "react";
import { View, Text } from "react-native";
import { EmptyState } from "../EmptyState";
import { MessageCardSkeleton } from "../design/SkeletonShimmer";
import { AnimatedPressable } from "../design/AnimatedPressable";
import type { Ionicons } from "@expo/vector-icons";

interface HubListStateProps {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  emptyIcon: keyof typeof Ionicons.glyphMap;
  emptyTitle: string;
  emptySubtitle: string;
}

/**
 * ListEmptyComponent for hub screens: skeletons on first load, inline
 * error + retry when the load failed (instead of a blank body), and a real
 * empty state otherwise.
 */
export function HubListState({ isLoading, error, onRetry, emptyIcon, emptyTitle, emptySubtitle }: HubListStateProps) {
  if (isLoading) {
    return (
      <View className="gap-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <MessageCardSkeleton key={i} />
        ))}
      </View>
    );
  }
  if (error) {
    return (
      <View className="items-center px-8 pt-16 gap-3">
        <Text className="text-body font-semibold text-slate-900 dark:text-white text-center">
          Couldn’t load
        </Text>
        <Text className="text-sm text-slate-500 dark:text-slate-400 text-center">{error}</Text>
        <AnimatedPressable className="px-5 py-2.5 rounded-full bg-primary mt-1" onPress={onRetry}>
          <Text className="text-white font-semibold text-sm">Retry</Text>
        </AnimatedPressable>
      </View>
    );
  }
  return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />;
}
