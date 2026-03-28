import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { getApiClient } from "../api";
import type { MessageResponse } from "../api";
import { MessageBubble } from "./inbox/MessageBubble";

const MAX_MESSAGES = 50;

interface LiveTopicViewProps {
  topicName: string;
}

export function LiveTopicView({ topicName }: LiveTopicViewProps) {
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
    ({ item }: { item: MessageResponse }) => <MessageBubble message={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: MessageResponse) => `${item.id}-${item.date}`,
    [],
  );

  const statusColor =
    status === "connected" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444";
  const statusLabel =
    status === "connected" ? "Live" : status === "connecting" ? "Connecting..." : "Disconnected";

  return (
    <View className="flex-1">
      <View className="flex-row items-center px-4 py-2 gap-1.5 bg-white dark:bg-surface-card">
        <View
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <Text className="text-caption font-semibold text-slate-600 dark:text-slate-300">
          {statusLabel}
        </Text>
        <Text className="text-caption text-slate-400 dark:text-slate-500 ml-auto">
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
        contentContainerStyle={
          messages.length === 0
            ? { flex: 1 }
            : { paddingVertical: 8 }
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-10">
            <Text className="text-sm text-slate-400 dark:text-slate-500">
              Waiting for messages...
            </Text>
          </View>
        }
      />
    </View>
  );
}
