import React, { useRef } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SwipeableRow } from "../design/SwipeableRow";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { MessageIcon } from "../MessageIcon";
import { useMessagesStore } from "../../store";
import { formatTimeAgo } from "../../utils/time";
import type { SourceMeta } from "../../store/messages";

interface SourceGroupCardProps {
  source: SourceMeta;
  index?: number;
}

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  low: "#94a3b8", // slate-400
  medium: "#2563eb", // primary
  high: "#f59e0b", // warning
  critical: "#ef4444", // error
};

function getPriorityLevel(priority: number): string {
  if (priority >= 8) return "critical";
  if (priority >= 6) return "high";
  if (priority >= 4) return "medium";
  return "low";
}

export const SourceGroupCard = React.memo(function SourceGroupCard({
  source,
  index = 0,
}: SourceGroupCardProps) {
  const router = useRouter();
  const deleteGroup = useMessagesStore((s) => s.deleteGroup);
  const markGroupRead = useMessagesStore((s) => s.markGroupRead);

  // Only play entrance animation on the first render, not on recycle
  const hasAnimated = useRef(false);
  const entering = hasAnimated.current
    ? undefined
    : FadeInDown.delay(Math.min(index, 8) * 50).duration(300);
  hasAnimated.current = true;

  const level = getPriorityLevel(source.priority);
  const borderColor = PRIORITY_BORDER_COLORS[level];
  const timeAgo = source.latestTimestamp
    ? formatTimeAgo(source.latestTimestamp)
    : "";

  return (
    <SwipeableRow
      onDelete={() => deleteGroup(source.sourceId)}
      onArchive={() => markGroupRead(source.sourceId)}
    >
      <AnimatedPressable
        className="mx-4 mb-2 p-3 rounded-xl bg-white dark:bg-surface-card"
        style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
        onPress={() =>
          router.push(`/thread/${encodeURIComponent(source.sourceId)}`)
        }
        haptic={false}
        entering={entering}
        accessibilityRole="button"
        accessibilityLabel={`${source.name}, ${source.unreadCount > 0 ? `${source.unreadCount} new messages` : "no new messages"}`}
      >
        <View className="flex-row items-center gap-3">
          {/* Icon */}
          <MessageIcon
            iconUrl={source.iconUrl}
            size={40}
            name={source.name}
          />

          {/* Content */}
          <View className="flex-1 min-w-0">
            {/* Top row: name + badge + time */}
            <View className="flex-row items-center justify-between mb-0.5">
              <Text
                className="text-body font-semibold text-gray-900 dark:text-white flex-shrink"
                numberOfLines={1}
              >
                {source.name}
              </Text>
              <View className="flex-row items-center gap-2 ml-2">
                {source.unreadCount > 0 && (
                  <View className="bg-primary rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                    <Text className="text-white text-xs font-bold">
                      {source.unreadCount > 99
                        ? "99+"
                        : source.unreadCount}
                    </Text>
                  </View>
                )}
                <Text className="text-caption text-slate-400 dark:text-slate-500">
                  {timeAgo}
                </Text>
              </View>
            </View>

            {/* Preview text */}
            <Text
              className="text-sm text-slate-500 dark:text-slate-400"
              numberOfLines={2}
            >
              {source.latestPreview}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </SwipeableRow>
  );
});
