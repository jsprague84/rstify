import React, { useRef, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { FadeInDown } from "react-native-reanimated";
import { SwipeableRow } from "../design/SwipeableRow";
import { ConfirmSheet } from "../design/ConfirmSheet";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { MessageIcon } from "../MessageIcon";
import { useMessagesStore } from "../../store";
import { formatTimeAgoCompact as formatTimeAgo } from "shared";
import { getPriorityLevel } from "../../utils/priority";
import type { SourceMeta } from "../../store/messages";

interface SourceGroupCardProps {
  source: SourceMeta;
  index?: number;
}

export const SourceGroupCard = React.memo(function SourceGroupCard({
  source,
  index = 0,
}: SourceGroupCardProps) {
  const router = useRouter();
  const deleteGroup = useMessagesStore((s) => s.deleteGroup);
  const markGroupRead = useMessagesStore((s) => s.markGroupRead);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Only play entrance animation on the first render, not on recycle
  const hasAnimated = useRef(false);
  const entering = hasAnimated.current
    ? undefined
    : FadeInDown.delay(Math.min(index, 8) * 50).duration(300);
  hasAnimated.current = true;

  // Priority is a restrained signal: a small dot for high/critical only. Color = meaning.
  const level = getPriorityLevel(source.priority);
  const priorityDot =
    level === "critical" ? "bg-error" : level === "high" ? "bg-warning" : null;
  const timeAgo = source.latestTimestamp
    ? formatTimeAgo(source.latestTimestamp)
    : "";

  return (
    <SwipeableRow
      onDelete={() => setConfirmDelete(true)}
      confirmDelete
      onArchive={() => markGroupRead(source.sourceId)}
    >
      <AnimatedPressable
        className="mx-4 mb-2.5 p-3.5 rounded-2xl bg-white dark:bg-surface-card border border-slate-100 dark:border-white/[0.06]"
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
          <MessageIcon iconUrl={source.iconUrl} size={44} name={source.name} />

          {/* Content */}
          <View className="flex-1 min-w-0">
            {/* Top row: name + badge + time */}
            <View className="flex-row items-center justify-between mb-0.5">
              <View className="flex-row items-center gap-1.5 flex-shrink">
                {priorityDot && (
                  <View className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot}`} />
                )}
                <Text
                  className="text-body font-semibold text-slate-900 dark:text-white flex-shrink"
                  numberOfLines={1}
                >
                  {source.name}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 ml-2 flex-shrink-0">
                {source.unreadCount > 0 && (
                  <View className="bg-primary rounded-full min-w-[20px] h-5 items-center justify-center px-1.5">
                    <Text className="text-white text-xs font-bold">
                      {source.unreadCount > 99 ? "99+" : source.unreadCount}
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
      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteGroup(source.sourceId)}
        title={`Delete ${source.name}?`}
        message="This deletes every message in this conversation from the server. It cannot be undone."
        confirmLabel="Delete all"
      />
    </SwipeableRow>
  );
});
