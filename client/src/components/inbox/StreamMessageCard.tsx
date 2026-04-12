import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SwipeableRow } from "../design/SwipeableRow";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { MessageIcon } from "../MessageIcon";
import { useMessagesStore, useApplicationsStore } from "../../store";
import { formatTimeAgoCompact as formatTimeAgo } from "shared";
import type { MessageResponse } from "shared";
import { getSourceId } from "../../utils/source";

interface StreamMessageCardProps {
  message: MessageResponse;
}

export const StreamMessageCard = React.memo(function StreamMessageCard({
  message,
}: StreamMessageCardProps) {
  const router = useRouter();
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const getApp = useApplicationsStore((s) => s.getApp);
  const getIconUrl = useApplicationsStore((s) => s.getIconUrl);

  const sourceId = getSourceId(message);
  const timeAgo = formatTimeAgo(message.date);

  // Resolve source name and icon
  let sourceName: string;
  let iconUrl: string | null = message.icon_url;

  if (message.topic) {
    sourceName = message.topic;
  } else if (message.appid) {
    const app = getApp(message.appid);
    sourceName = app?.name ?? `App ${message.appid}`;
    if (!iconUrl) {
      iconUrl = getIconUrl(message.appid);
    }
  } else {
    sourceName = "Unknown";
  }

  const preview = message.message?.slice(0, 120) ?? "";

  return (
    <SwipeableRow onDelete={() => deleteMessage(message.id)}>
      <AnimatedPressable
        className="mx-4 mb-2 p-3 rounded-xl bg-white dark:bg-surface-card"
        onPress={() =>
          router.push(`/thread/${encodeURIComponent(sourceId)}`)
        }
        haptic={false}
      >
        <View className="flex-row items-start gap-3">
          {/* Small icon */}
          <MessageIcon iconUrl={iconUrl} size={32} name={sourceName} />

          {/* Content */}
          <View className="flex-1 min-w-0">
            {/* Top row: source name + time */}
            <View className="flex-row items-center justify-between mb-0.5">
              <Text
                className="text-caption font-medium text-slate-500 dark:text-slate-400 flex-shrink"
                numberOfLines={1}
              >
                {sourceName}
              </Text>
              <Text className="text-caption text-slate-400 dark:text-slate-500 ml-2">
                {timeAgo}
              </Text>
            </View>

            {/* Title if present */}
            {message.title ? (
              <Text
                className="text-body font-semibold text-gray-900 dark:text-white mb-0.5"
                numberOfLines={1}
              >
                {message.title}
              </Text>
            ) : null}

            {/* Message preview */}
            <Text
              className="text-sm text-slate-500 dark:text-slate-400"
              numberOfLines={2}
            >
              {preview}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </SwipeableRow>
  );
});
