import React, { useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as ContextMenu from "zeego/context-menu";
import * as DropdownMenu from "zeego/dropdown-menu";
import { Ionicons } from "@expo/vector-icons";
import { useChannelsStore } from "../../store";
import type { Topic } from "shared";

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
          <View className="px-4 py-3.5 bg-white dark:bg-surface-card rounded-xl border border-slate-100 dark:border-white/[0.06] mx-4 mb-2">
            <View className="flex-row items-center gap-3">
              {/* Pinned indicator */}
              {pinned ? (
                <View className="w-2 h-2 rounded-full bg-primary" />
              ) : (
                <View className="w-2 h-2 rounded-full bg-transparent" />
              )}

              <View className="flex-1 min-w-0">
                <Text
                  className="text-body font-semibold text-slate-900 dark:text-white"
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
                  <View className="bg-slate-100 dark:bg-surface-elevated rounded-md px-1.5 py-0.5">
                    <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">R</Text>
                  </View>
                )}
                {topic.everyone_write && (
                  <View className="bg-slate-100 dark:bg-surface-elevated rounded-md px-1.5 py-0.5">
                    <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">W</Text>
                  </View>
                )}
              </View>

              {/* Visible affordance for the actions menu — the long-press
                  context menu is undiscoverable on its own. */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Pressable hitSlop={8} accessibilityLabel={`Actions for ${topic.name}`}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#94a3b8" />
                  </Pressable>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    key="pin"
                    onSelect={() => (pinned ? unpinTopic(topic.name) : pinTopic(topic.name))}
                  >
                    <DropdownMenu.ItemTitle>{pinned ? "Unpin" : "Pin to Top"}</DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                  {onPublish ? (
                    <DropdownMenu.Item key="publish" onSelect={() => onPublish(topic)}>
                      <DropdownMenu.ItemTitle>Publish Message</DropdownMenu.ItemTitle>
                    </DropdownMenu.Item>
                  ) : null}
                  {onEdit ? (
                    <DropdownMenu.Item key="edit" onSelect={() => onEdit(topic)}>
                      <DropdownMenu.ItemTitle>Edit Topic</DropdownMenu.ItemTitle>
                    </DropdownMenu.Item>
                  ) : null}
                  {folders.length > 0 ? (
                    <DropdownMenu.Group>
                      {folders.map((folder) => (
                        <DropdownMenu.Item
                          key={`folder-${folder.id}`}
                          onSelect={() => moveToFolder(topic.name, folder.id)}
                        >
                          <DropdownMenu.ItemTitle>Move to {folder.name}</DropdownMenu.ItemTitle>
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Group>
                  ) : null}
                  <DropdownMenu.Item key="remove-folder" onSelect={() => moveToFolder(topic.name, null)}>
                    <DropdownMenu.ItemTitle>Remove from Folder</DropdownMenu.ItemTitle>
                  </DropdownMenu.Item>
                  {onDelete ? (
                    <DropdownMenu.Item key="delete" destructive onSelect={() => onDelete(topic)}>
                      <DropdownMenu.ItemTitle>Delete Topic</DropdownMenu.ItemTitle>
                    </DropdownMenu.Item>
                  ) : null}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
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
