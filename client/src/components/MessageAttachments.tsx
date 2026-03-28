import React from "react";
import { View, Text, Alert, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "./design/AnimatedPressable";
import { useAuthStore } from "../store";
import { getApiClient } from "../api";
import type { MessageResponse, AttachmentInfo } from "../api/types";

interface MessageAttachmentsProps {
  message: MessageResponse;
  onDeleteAttachment?: (id: number) => void;
}

function isImage(type?: string): boolean {
  return !!type && type.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveAttachments(message: MessageResponse): AttachmentInfo[] {
  // Check direct attachments array first
  if (message.attachments && message.attachments.length > 0) {
    return message.attachments;
  }

  // Check extras["client::attachment"] for Gotify compat
  const attachmentExtra = message.extras?.["client::attachment"] as
    | { url?: string; name?: string; type?: string; size?: number }
    | undefined;

  if (attachmentExtra?.url) {
    return [
      {
        id: 0,
        name: attachmentExtra.name ?? "attachment",
        type: attachmentExtra.type,
        size: attachmentExtra.size ?? 0,
        url: attachmentExtra.url,
      },
    ];
  }

  return [];
}

export const MessageAttachments = React.memo(function MessageAttachments({
  message,
  onDeleteAttachment,
}: MessageAttachmentsProps) {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.token);

  const attachments = resolveAttachments(message);
  if (attachments.length === 0) return null;

  const getFullUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${serverUrl}${url}`;
  };

  const handleLongPress = (att: AttachmentInfo) => {
    if (!onDeleteAttachment) return;
    Alert.alert("Delete Attachment", `Delete "${att.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const client = getApiClient();
            await client.deleteAttachment(att.id);
            onDeleteAttachment(att.id);
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Delete failed");
          }
        },
      },
    ]);
  };

  const handlePress = async (att: AttachmentInfo) => {
    try {
      await Linking.openURL(getFullUrl(att.url));
    } catch (error) {
      console.error("Failed to open attachment:", error);
    }
  };

  return (
    <View className="mt-2 gap-1.5">
      {attachments.map((att) => (
        <AnimatedPressable
          key={att.id}
          className="rounded-md overflow-hidden bg-surface-light-card dark:bg-surface-card"
          onPress={() => handlePress(att)}
          onLongPress={() => handleLongPress(att)}
          haptic={false}
        >
          {isImage(att.type) ? (
            <Image
              source={{
                uri: getFullUrl(att.url),
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              }}
              style={{ width: "100%", height: 160 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View className="flex-row items-center gap-1.5 px-2.5 py-2">
              <Ionicons name="attach" size={16} color="#3b82f6" />
              <Text
                className="text-primary text-sm flex-1"
                numberOfLines={1}
              >
                {att.name}
              </Text>
              <Text className="text-slate-400 text-xs">
                ({formatSize(att.size)})
              </Text>
            </View>
          )}
        </AnimatedPressable>
      ))}
    </View>
  );
});
