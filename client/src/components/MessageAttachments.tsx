import React from "react";
import { View, Text, Image, Pressable, StyleSheet, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../store/theme";
import { Colors } from "../theme/colors";
import type { AttachmentInfo } from "../api";
import { getApiClient } from "../api";

interface Props {
  attachments?: AttachmentInfo[];
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

export const MessageAttachments = React.memo(function MessageAttachments({ attachments, onDeleteAttachment }: Props) {
  const { isDark } = useTheme();

  if (!attachments || attachments.length === 0) return null;

  const handleLongPress = (att: AttachmentInfo) => {
    Alert.alert("Delete Attachment", `Delete "${att.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const client = getApiClient();
            await client.deleteAttachment(att.id);
            onDeleteAttachment?.(att.id);
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Delete failed");
          }
        },
      },
    ]);
  };

  const handleDownload = async (att: AttachmentInfo) => {
    try {
      const client = getApiClient();
      const fullUrl = `${client.getBaseUrl()}${att.url}`;
      await Linking.openURL(fullUrl);
    } catch (error) {
      console.error("Failed to open attachment:", error);
    }
  };

  return (
    <View style={styles.container}>
      {attachments.map((att) => (
        <Pressable
          key={att.id}
          onPress={() => handleDownload(att)}
          onLongPress={() => handleLongPress(att)}
          style={({ pressed }) => [
            styles.attachment,
            isDark && styles.attachmentDark,
            pressed && styles.pressed,
          ]}
        >
          {isImage(att.type) ? (
            <Image
              source={{ uri: `${getApiClient().getBaseUrl()}${att.url}` }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.fileRow}>
              <Ionicons
                name="attach"
                size={16}
                color={isDark ? "#60A5FA" : "#4F46E5"}
              />
              <Text
                style={[styles.fileName, isDark && styles.fileNameDark]}
                numberOfLines={1}
              >
                {att.name}
              </Text>
              <Text style={styles.fileSize}>({formatSize(att.size)})</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 6,
  },
  attachment: {
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: Colors.light.background,
  },
  attachmentDark: {
    backgroundColor: Colors.dark.background,
  },
  pressed: {
    opacity: 0.7,
  },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: 6,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileName: {
    fontSize: 13,
    color: "#4F46E5",
    flex: 1,
  },
  fileNameDark: {
    color: "#60A5FA",
  },
  fileSize: {
    fontSize: 11,
    color: "#9CA3AF",
  },
});
