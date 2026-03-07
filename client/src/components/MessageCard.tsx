import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { MessageResponse } from "../api";
import { MessageContent } from "./MessageContent";
import { MessageActions } from "./MessageActions";
import { MessageAttachments } from "./MessageAttachments";
import { MessageIcon } from "./MessageIcon";
import { useTheme } from "../store/theme";
import { Colors } from "../theme/colors";

interface MessageCardProps {
  message: MessageResponse;
  onDelete?: (id: number) => void;
}

const priorityColors: Record<number, string> = {
  1: "#6b7280",
  2: "#6b7280",
  3: "#3b82f6",
  4: "#3b82f6",
  5: "#10b981",
  6: "#f59e0b",
  7: "#f59e0b",
  8: "#ef4444",
  9: "#ef4444",
  10: "#dc2626",
};

export const MessageCard = React.memo(function MessageCard({ message, onDelete }: MessageCardProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const borderColor = priorityColors[message.priority] ?? "#10b981";
  const timeStr = new Date(message.date).toLocaleString();
  const source = message.topic ?? (message.appid ? `App #${message.appid}` : "Unknown");

  // Determine click URL from message or extras
  const clickUrl = message.click_url || message.extras?.["client::notification"]?.click?.url;

  const handleCardPress = async () => {
    if (clickUrl) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const supported = await Linking.canOpenURL(clickUrl);
        if (supported) {
          await Linking.openURL(clickUrl);
        }
      } catch (error) {
        console.error("Failed to open URL:", error);
      }
    }
  };

  const CardWrapper = clickUrl ? Pressable : View;
  const cardWrapperProps = clickUrl
    ? {
        onPress: handleCardPress,
        style: ({ pressed }: { pressed: boolean }) => [
          styles.card,
          { borderLeftColor: borderColor },
          isDark && styles.cardDark,
          pressed && styles.cardPressed,
        ],
      }
    : {
        style: [
          styles.card,
          { borderLeftColor: borderColor },
          isDark && styles.cardDark,
        ],
      };

  return (
    <CardWrapper {...cardWrapperProps}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.sourceRow}>
            {/* Show custom icon or default */}
            <MessageIcon iconUrl={message.icon_url} size={32} />

            <View style={styles.headerText}>
              {message.title ? (
                <View style={styles.titleRow}>
                  <Text style={[styles.title, isDark && styles.titleDark]}>
                    {message.title}
                  </Text>
                  {clickUrl && (
                    <Ionicons
                      name="open-outline"
                      size={14}
                      color={isDark ? "#60A5FA" : "#2563EB"}
                      style={styles.linkIcon}
                    />
                  )}
                </View>
              ) : null}
              <Text style={[styles.source, isDark && styles.sourceDark]}>
                {source}
              </Text>
            </View>
          </View>
        </View>
        {onDelete ? (
          <Pressable
            onPress={() => onDelete(message.id)}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.deletePressed}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </Pressable>
        ) : null}
      </View>

      <MessageContent message={message} />

      {/* Attachments */}
      <MessageAttachments messageId={message.id} attachments={message.attachments} />

      {/* Action buttons */}
      <MessageActions message={message} />

      <View style={styles.footer}>
        <Text style={[styles.time, isDark && styles.timeDark]}>
          {timeStr}
        </Text>
        {message.tags?.length ? (
          <View style={styles.tags}>
            {message.tags.map((tag) => (
              <View key={tag} style={[styles.tag, isDark && styles.tagDark]}>
                <Text style={[styles.tagText, isDark && styles.tagTextDark]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </CardWrapper>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDark: {
    backgroundColor: Colors.dark.surface,
    shadowOpacity: 0.3,
  },
  cardPressed: {
    opacity: 0.8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  titleDark: {
    color: "#F9FAFB",
  },
  linkIcon: {
    marginLeft: 2,
  },
  source: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  sourceDark: {
    color: "#9CA3AF",
  },
  deletePressed: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  time: {
    fontSize: 11,
    color: "#9ca3af",
  },
  timeDark: {
    color: "#6B7280",
  },
  tags: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagDark: {
    backgroundColor: "#374151",
  },
  tagText: {
    fontSize: 11,
    color: "#6b7280",
  },
  tagTextDark: {
    color: "#D1D5DB",
  },
});
