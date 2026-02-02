import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MessageResponse } from "../api";

interface MessageCardProps {
  message: MessageResponse;
  onDelete?: (id: number) => void;
  appIconUrl?: string;
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

export const MessageCard = React.memo(function MessageCard({ message, onDelete, appIconUrl }: MessageCardProps) {
  const borderColor = priorityColors[message.priority] ?? "#10b981";
  const timeStr = new Date(message.date).toLocaleString();
  const source = message.topic ?? (message.appid ? `App #${message.appid}` : "Unknown");

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.sourceRow}>
            {appIconUrl ? (
              <Image source={{ uri: appIconUrl }} style={styles.appIcon} />
            ) : null}
            <View>
              {message.title ? (
                <Text style={styles.title}>{message.title}</Text>
              ) : null}
              <Text style={styles.source}>{source}</Text>
            </View>
          </View>
        </View>
        {onDelete ? (
          <Pressable onPress={() => onDelete(message.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.body}>{message.message}</Text>

      <View style={styles.footer}>
        <Text style={styles.time}>{timeStr}</Text>
        {message.tags?.length ? (
          <View style={styles.tags}>
            {message.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
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
    gap: 8,
  },
  appIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  source: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
  },
  body: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginVertical: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    color: "#9ca3af",
  },
  tags: {
    flexDirection: "row",
    gap: 4,
  },
  tag: {
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: "#6b7280",
  },
});
