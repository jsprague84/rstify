import React from "react";
import { View, Text, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { MessageContent } from "../MessageContent";
import { MessageActions } from "../MessageActions";
import { MessageAttachments } from "../MessageAttachments";
import { PRIORITY_BORDER_COLORS, getPriorityLevel } from "../../utils/priority";
import type { MessageResponse } from "../../api/types";

interface MessageBubbleProps {
  message: MessageResponse;
}

const PRIORITY_LABELS: Record<string, { text: string; className: string }> = {
  high: {
    text: "High Priority",
    className: "text-warning",
  },
  critical: {
    text: "Critical",
    className: "text-error",
  },
};

export const MessageBubble = React.memo(function MessageBubble({
  message,
}: MessageBubbleProps) {
  const level = getPriorityLevel(message.priority);
  const borderColor = PRIORITY_BORDER_COLORS[level];
  const priorityLabel = PRIORITY_LABELS[level];

  // Big image from extras
  const notification = message.extras?.["client::notification"] as
    | { bigImageUrl?: string }
    | undefined;
  const bigImageUrl = notification?.bigImageUrl;

  // Click URL
  const clickUrl = message.click_url;

  const timeStr = new Date(message.date).toLocaleString();

  const handleTitlePress = async () => {
    if (!clickUrl) return;
    try {
      const supported = await Linking.canOpenURL(clickUrl);
      if (supported) {
        await Linking.openURL(clickUrl);
      }
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <View
      className="mx-4 mb-3 rounded-xl bg-white dark:bg-surface-card overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      {/* Big image hero */}
      {bigImageUrl ? (
        <Image
          source={{ uri: bigImageUrl }}
          style={{ width: "100%", height: 180 }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}

      <View className="p-3">
        {/* Priority label */}
        {priorityLabel ? (
          <Text
            className={`text-xs font-bold mb-1 ${priorityLabel.className}`}
          >
            {priorityLabel.text}
          </Text>
        ) : null}

        {/* Title with click_url indicator */}
        {message.title ? (
          clickUrl ? (
            <AnimatedPressable
              onPress={handleTitlePress}
              haptic={false}
              className="flex-row items-center gap-1 mb-1"
            >
              <Text className="text-lg font-bold text-gray-900 dark:text-white flex-shrink">
                {message.title}
              </Text>
              <Ionicons name="open-outline" size={14} color="#2563eb" />
            </AnimatedPressable>
          ) : (
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {message.title}
            </Text>
          )
        ) : null}

        {/* Message body */}
        <MessageContent message={message} />

        {/* Attachments */}
        <MessageAttachments message={message} />

        {/* Action buttons */}
        <MessageActions message={message} />

        {/* Tags */}
        {message.tags && message.tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {message.tags.map((tag) => (
              <View
                key={tag}
                className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5"
              >
                <Text className="text-xs text-slate-600 dark:text-slate-300">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Timestamp */}
        <Text className="text-caption text-slate-400 dark:text-slate-500 mt-2">
          {timeStr}
        </Text>
      </View>
    </View>
  );
});
