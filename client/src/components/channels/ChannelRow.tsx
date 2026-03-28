import React, { useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as ContextMenu from "zeego/context-menu";
import { useChannelsStore } from "../../store";
import type { Topic } from "../../api/types";

interface ChannelRowProps {
  topic: Topic;
  onEdit?: (topic: Topic) => void;
  onDelete?: (topic: Topic) => void;
  onPublish?: (topic: Topic) => void;
}

export const ChannelRow = React.memo(function ChannelRow({ topic, onEdit, onDelete, onPublish }: ChannelRowProps) {
  const router = useRouter();
  const isPinned = useChannelsStore((s) => s.isPinned);
  const pinTopic = useChannelsStore((s) => s.pinTopic);
  const unpinTopic = useChannelsStore((s) => s.unpinTopic);
  const folders = useChannelsStore((s) => s.folders);
  const moveToFolder = useChannelsStore((s) => s.moveToFolder);

  const pinned = isPinned(topic.name);
  const menuOpenRef = useRef(false);

  const handlePress = () => {
    // Skip navigation if the context menu was just open
    if (menuOpenRef.current) return;
    router.push(`/thread/${encodeURIComponent(`topic:${topic.name}`)}`);
  };

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        menuOpenRef.current = open;
        // Clear flag after a short delay so the next tap navigates normally
        if (!open) {
          setTimeout(() => { menuOpenRef.current = false; }, 300);
        }
      }}
    >
      <ContextMenu.Trigger>
        <Pressable onPress={handlePress}>
          <View className="px-4 py-3 bg-white dark:bg-surface-card rounded-lg mx-4 mb-1.5">
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
          </View>
        </Pressable>
      </ContextMenu.Trigger>

      <ContextMenu.Content>
        {/* Pin / Unpin */}
        <ContextMenu.Item
          key="pin"
          onSelect={() => {
            if (pinned) {
              unpinTopic(topic.name);
            } else {
              pinTopic(topic.name);
            }
          }}
        >
          <ContextMenu.ItemTitle>
            {pinned ? "Unpin" : "Pin to Top"}
          </ContextMenu.ItemTitle>
        </ContextMenu.Item>

        {onPublish ? (
          <ContextMenu.Item key="publish" onSelect={() => onPublish(topic)}>
            <ContextMenu.ItemTitle>Publish Message</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}

        {onEdit ? (
          <ContextMenu.Item key="edit" onSelect={() => onEdit(topic)}>
            <ContextMenu.ItemTitle>Edit Topic</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}

        {/* Move to folder items */}
        {folders.length > 0 ? (
          <ContextMenu.Group>
            {folders.map((folder) => (
              <ContextMenu.Item
                key={`folder-${folder.id}`}
                onSelect={() => moveToFolder(topic.name, folder.id)}
              >
                <ContextMenu.ItemTitle>
                  Move to {folder.name}
                </ContextMenu.ItemTitle>
              </ContextMenu.Item>
            ))}
          </ContextMenu.Group>
        ) : null}

        {/* Remove from folder */}
        <ContextMenu.Item
          key="remove-folder"
          onSelect={() => moveToFolder(topic.name, null)}
        >
          <ContextMenu.ItemTitle>Remove from Folder</ContextMenu.ItemTitle>
        </ContextMenu.Item>

        {onDelete ? (
          <ContextMenu.Item key="delete" destructive onSelect={() => onDelete(topic)}>
            <ContextMenu.ItemTitle>Delete Topic</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
});
