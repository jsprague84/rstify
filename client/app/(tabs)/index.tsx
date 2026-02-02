import React, { useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
  Text,
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MessageCard } from "../../src/components/MessageCard";
import { EmptyState } from "../../src/components/EmptyState";
import { useMessagesStore } from "../../src/store/messages";
import { useUserWebSocket } from "../../src/hooks/useWebSocket";
import { getApiClient } from "../../src/api";
import type { Application, MessageResponse } from "../../src/api";

export default function MessagesScreen() {
  const messages = useMessagesStore((s) => s.messages);
  const isLoading = useMessagesStore((s) => s.isLoading);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const deleteAllMessages = useMessagesStore((s) => s.deleteAllMessages);

  const [clientToken, setClientToken] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);

  // Load apps for icon URLs
  useEffect(() => {
    const loadApps = async () => {
      try {
        const api = getApiClient();
        const result = await api.listApplications();
        setApps(result);
      } catch {
        // non-critical
      }
    };
    loadApps();
  }, []);

  const appIconMap = useMemo(() => {
    const api = getApiClient();
    const map: Record<number, string> = {};
    for (const app of apps) {
      if (app.image) {
        map[app.id] = api.applicationIconUrl(app.id);
      }
    }
    return map;
  }, [apps]);

  // Get or create a client token for WebSocket
  useEffect(() => {
    const setupClient = async () => {
      try {
        const api = getApiClient();
        const clients = await api.listClients();
        if (clients.length > 0) {
          setClientToken(clients[0].token);
        } else {
          const client = await api.createClient({ name: "rstify-mobile" });
          setClientToken(client.token);
        }
      } catch {
        // Will retry on next render
      }
    };
    setupClient();
  }, []);

  // WebSocket for real-time messages
  const onMessage = useCallback(
    (msg: MessageResponse) => {
      addMessage(msg);
    },
    [addMessage],
  );

  useUserWebSocket({
    clientToken,
    onMessage,
    enabled: !!clientToken,
  });

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleDelete = async (id: number) => {
    try {
      await deleteMessage(id);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
    }
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MessageResponse>) => (
      <MessageCard
        message={item}
        onDelete={handleDelete}
        appIconUrl={item.appid ? appIconMap[item.appid] : undefined}
      />
    ),
    [appIconMap],
  );

  const keyExtractor = useCallback(
    (item: MessageResponse) => item.id.toString(),
    [],
  );

  const handleDeleteAll = () => {
    Alert.alert(
      "Delete All Messages",
      "Are you sure you want to delete all messages?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAllMessages();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to delete",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {messages.length > 0 ? (
          <Pressable onPress={handleDeleteAll} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={11}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchMessages()}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages"
              subtitle="Messages from your apps will appear here"
            />
          )
        }
        contentContainerStyle={
          messages.length === 0 ? styles.emptyList : styles.list
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flex: 1,
  },
});
