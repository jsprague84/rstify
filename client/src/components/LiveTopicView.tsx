import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, FlatList, Text, StyleSheet } from "react-native";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";
import { MessageCard } from "./MessageCard";
import { useTheme } from "../store/theme";
import { Colors } from "../theme/colors";

const MAX_MESSAGES = 50;

interface LiveTopicViewProps {
  topicName: string;
}

export function LiveTopicView({ topicName }: LiveTopicViewProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleMessage = useCallback((msg: MessageResponse) => {
    setMessages((prev) => {
      const next = [msg, ...prev];
      return next.length > MAX_MESSAGES ? next.slice(0, MAX_MESSAGES) : next;
    });
  }, []);

  useEffect(() => {
    const api = getApiClient();
    setStatus("connecting");

    const ws = api.connectTopicStream(
      topicName,
      handleMessage,
      () => setStatus("disconnected"),
      () => setStatus("disconnected"),
    );

    ws.onopen = () => setStatus("connected");
    wsRef.current = ws;

    return () => {
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      wsRef.current = null;
    };
  }, [topicName, handleMessage]);

  const renderItem = useCallback(
    ({ item }: { item: MessageResponse }) => <MessageCard message={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: MessageResponse) => `${item.id}-${item.date}`,
    [],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.statusBar, { backgroundColor: colors.surface }]}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                status === "connected" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444",
            },
          ]}
        />
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          {status === "connected"
            ? "Live"
            : status === "connecting"
              ? "Connecting..."
              : "Disconnected"}
        </Text>
        <Text style={[styles.countText, { color: colors.textTertiary }]}>
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={11}
        contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Waiting for messages...
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  countText: {
    fontSize: 12,
    marginLeft: "auto",
  },
  list: { paddingVertical: 8 },
  emptyList: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
  },
});
