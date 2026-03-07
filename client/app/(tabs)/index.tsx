import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import type { ListRenderItemInfo } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MessageCard } from "../../src/components/MessageCard";
import { EmptyState } from "../../src/components/EmptyState";
import { useMessagesStore } from "../../src/store/messages";
import { useUserWebSocket } from "../../src/hooks/useWebSocket";
import { useTheme } from "../../src/store/theme";
import { Colors } from "../../src/theme/colors";
import { getApiClient } from "../../src/api";
import type { Application, MessageResponse } from "../../src/api";
import {
  showMessageNotification,
  getDevicePushToken,
} from "../../src/services/notifications";

export default function MessagesScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  const messages = useMessagesStore((s) => s.messages);
  const isLoading = useMessagesStore((s) => s.isLoading);
  const isLoadingMore = useMessagesStore((s) => s.isLoadingMore);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const fetchOlderMessages = useMessagesStore((s) => s.fetchOlderMessages);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const deleteAllMessages = useMessagesStore((s) => s.deleteAllMessages);

  const [clientToken, setClientToken] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageResponse[] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const api = getApiClient();
        const results = await api.searchMessages({ q: query, limit: 100 });
        setSearchResults(results);
      } catch {
        // silently fail search
      }
    }, 300);
  };

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

  // Get or create a client token for WebSocket + register FCM token
  useEffect(() => {
    const setupClient = async () => {
      try {
        const api = getApiClient();
        const clients = await api.listClients();
        let clientId: number;
        if (clients.length > 0) {
          setClientToken(clients[0].token);
          clientId = clients[0].id;
        } else {
          const client = await api.createClient({ name: "rstify-mobile" });
          setClientToken(client.token);
          clientId = client.id;
        }

        // Register FCM push token for background notifications
        const pushToken = await getDevicePushToken();
        if (pushToken) {
          api.registerFcmToken(clientId, pushToken).catch(() => {
            // FCM registration is best-effort — server may not have FCM configured
          });
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
      showMessageNotification(msg);
    },
    [addMessage],
  );

  const { connectionStatus } = useUserWebSocket({
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: connectionStatus === "connected" ? "#22c55e" : connectionStatus === "reconnecting" ? "#eab308" : "#ef4444",
          }} />
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={handleDeleteAll} hitSlop={8}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface }}>
        <TextInput
          placeholder="Search messages..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          style={{
            backgroundColor: colors.backgroundSecondary,
            color: colors.text,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
          }}
        />
      </View>

      <FlatList
        data={searchResults ?? messages}
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
        onEndReached={fetchOlderMessages}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator style={{ padding: 16 }} color={colors.primary} />
          ) : null
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
