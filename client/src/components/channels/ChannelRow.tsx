import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import * as DropdownMenu from "zeego/dropdown-menu";
import { AnimatedPressable } from "../design/AnimatedPressable";
import { useChannelsStore } from "../../store";
import type { Topic } from "../../api/types";

interface ChannelRowProps {
  topic: Topic;
}

export const ChannelRow = React.memo(function ChannelRow({ topic }: ChannelRowProps) {
  const router = useRouter();
  const isPinned = useChannelsStore((s) => s.isPinned);
  const pinTopic = useChannelsStore((s) => s.pinTopic);
  const unpinTopic = useChannelsStore((s) => s.unpinTopic);
  const folders = useChannelsStore((s) => s.folders);
  const moveToFolder = useChannelsStore((s) => s.moveToFolder);

  const pinned = isPinned(topic.name);

  const handlePress = () => {
    router.push(`/thread/${encodeURIComponent(`topic:${topic.name}`)}`);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <AnimatedPressable
          onPress={handlePress}
          className="px-4 py-3 bg-white dark:bg-surface-card rounded-lg mx-4 mb-1.5"
        >
          <View className="flex-row items-center gap-3">
            {/* Pinned indicator */}
            {pinned ? (
              <View className="w-2 h-2 rounded-full bg-blue-500" />
            ) : (
              <View className="w-2 h-2 rounded-full bg-transparent" />
            )}

            <View className="flex-1 min-w-0">
              <Text
                className="text-body font-medium text-gray-900 dark:text-white"
                numberOfLines={1}
              >
                {topic.name}
              </Text>
              {topic.description ? (
                <Text
                  className="text-caption text-slate-500 dark:text-slate-400 mt-0.5"
                  numberOfLines={1}
                >
                  {topic.description}
                </Text>
              ) : null}
            </View>

            {/* Access indicators */}
            <View className="flex-row gap-1">
              {topic.everyone_read && (
                <View className="bg-green-100 dark:bg-green-900/30 rounded px-1.5 py-0.5">
                  <Text className="text-xs text-green-700 dark:text-green-400">R</Text>
                </View>
              )}
              {topic.everyone_write && (
                <View className="bg-blue-100 dark:bg-blue-900/30 rounded px-1.5 py-0.5">
                  <Text className="text-xs text-blue-700 dark:text-blue-400">W</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedPressable>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content>
        {/* Pin / Unpin */}
        <DropdownMenu.Item
          key="pin"
          onSelect={() => {
            if (pinned) {
              unpinTopic(topic.name);
            } else {
              pinTopic(topic.name);
            }
          }}
        >
          <DropdownMenu.ItemTitle>
            {pinned ? "Unpin" : "Pin to Top"}
          </DropdownMenu.ItemTitle>
        </DropdownMenu.Item>

        {/* Move to folder items */}
        {folders.length > 0 ? (
          <DropdownMenu.Group>
            {folders.map((folder) => (
              <DropdownMenu.Item
                key={`folder-${folder.id}`}
                onSelect={() => moveToFolder(topic.name, folder.id)}
              >
                <DropdownMenu.ItemTitle>
                  Move to {folder.name}
                </DropdownMenu.ItemTitle>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
        ) : null}

        {/* Remove from folder */}
        <DropdownMenu.Item
          key="remove-folder"
          onSelect={() => moveToFolder(topic.name, null)}
        >
          <DropdownMenu.ItemTitle>Remove from Folder</DropdownMenu.ItemTitle>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
