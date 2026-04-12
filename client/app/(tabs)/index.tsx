import React, { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { View, Text, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list";
import { SegmentedControl } from "../../src/components/design/SegmentedControl";
import { ConnectionStatus } from "../../src/components/design/ConnectionStatus";
import { MessageCardSkeleton } from "../../src/components/design/SkeletonShimmer";
import { SourceGroupCard } from "../../src/components/inbox/SourceGroupCard";
import { StreamMessageCard } from "../../src/components/inbox/StreamMessageCard";
import { EmptyState } from "../../src/components/EmptyState";
import {
  useMessagesStore,
  useAuthStore,
  useApplicationsStore,
} from "../../src/store";
import { useUserWebSocket } from "../../src/hooks/useWebSocket";
import { showMessageNotification } from "../../src/services/notifications";
import { getApiClient } from "../../src/api";
import { getDevicePushToken } from "../../src/services/notifications";
import type { MessageResponse } from "../../src/api";
import type { SourceMeta } from "../../src/store/messages";

const SEGMENTS = ["Grouped", "Stream"];

export default function InboxScreen() {
  const token = useAuthStore((s) => s.token);

  const viewMode = useMessagesStore((s) => s.viewMode);
  const setViewMode = useMessagesStore((s) => s.setViewMode);
  const isLoading = useMessagesStore((s) => s.isLoading);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const fetchOlderMessages = useMessagesStore((s) => s.fetchOlderMessages);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const sourceMeta = useMessagesStore((s) => s.sourceMeta);
  const groupedMessages = useMessagesStore((s) => s.groupedMessages);
  const hasMore = useMessagesStore((s) => s.hasMore);
  const isLoadingMore = useMessagesStore((s) => s.isLoadingMore);

  const groupedSources = useMemo(() => {
    return Array.from(sourceMeta.values()).sort(
      (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime(),
    );
  }, [sourceMeta]);

  const streamMessages = useMemo(() => {
    const all: MessageResponse[] = [];
    for (const msgs of groupedMessages.values()) {
      all.push(...msgs);
    }
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groupedMessages]);

  const fetchApplications = useApplicationsStore((s) => s.fetchApplications);

  const [searchQuery, setSearchQuery] = useState("");
  const [clientToken, setClientToken] = useState<string | null>(null);

  // --- Client token setup for WebSocket ---
  useEffect(() => {
    const setupClient = async () => {
      try {
        const api = getApiClient();
        const clients = await api.listClients();
        if (clients.length > 0) {
          setClientToken(clients[0].token);
          // Register FCM token for background notifications
          const pushToken = await getDevicePushToken();
          if (pushToken) {
            api
              .registerFcmToken(clients[0].id, pushToken)
              .catch(() => undefined);
          }
        } else {
          const client = await api.createClient({ name: "rstify-mobile", scopes: null });
          setClientToken(client.token);
          const pushToken = await getDevicePushToken();
          if (pushToken) {
            api
              .registerFcmToken(client.id, pushToken)
              .catch(() => undefined);
          }
        }
      } catch {
        // Will retry on next mount
      }
    };
    setupClient();
  }, []);

  // --- WebSocket ---
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

  // --- Initial fetch ---
  useEffect(() => {
    fetchMessages();
    fetchApplications();
  }, [fetchMessages, fetchApplications]);

  // --- Search filtering ---

  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return groupedSources;
    const q = searchQuery.toLowerCase();
    return groupedSources.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.latestPreview.toLowerCase().includes(q),
    );
  }, [groupedSources, searchQuery]);

  const filteredStream = useMemo(() => {
    if (!searchQuery.trim()) return streamMessages;
    const q = searchQuery.toLowerCase();
    return streamMessages.filter(
      (m) =>
        (m.title?.toLowerCase().includes(q) ?? false) ||
        m.message.toLowerCase().includes(q),
    );
  }, [streamMessages, searchQuery]);

  // --- Segment control ---
  const selectedIndex = viewMode === "grouped" ? 0 : 1;
  const handleSegmentChange = useCallback(
    (index: number) => {
      setViewMode(index === 0 ? "grouped" : "stream");
    },
    [setViewMode],
  );

  // --- Skeleton loading ---
  if (isLoading && groupedSources.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-slate-50 dark:bg-surface-bg"
        edges={["top"]}
      >
        {/* Header */}
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-display font-bold text-gray-900 dark:text-white">
              Inbox
            </Text>
            <ConnectionStatus status={connectionStatus} />
          </View>
        </View>
        {/* Skeletons */}
        <View className="gap-2 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <MessageCardSkeleton key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-surface-bg"
      edges={["top"]}
    >
      {/* Header */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-display font-bold text-gray-900 dark:text-white">
            Inbox
          </Text>
          <ConnectionStatus status={connectionStatus} />
        </View>

        {/* Search */}
        <TextInput
          className="bg-white dark:bg-surface-card rounded-lg px-3 py-2 text-body text-gray-900 dark:text-white mb-3"
          placeholder="Search messages..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {/* Segmented Control */}
        <SegmentedControl
          segments={SEGMENTS}
          selectedIndex={selectedIndex}
          onChange={handleSegmentChange}
        />
      </View>

      {/* Content */}
      {viewMode === "grouped" ? (
        <LegendList
          data={filteredGrouped}
          keyExtractor={(item: SourceMeta) => item.sourceId}
          renderItem={({ item, index }: { item: SourceMeta; index: number }) => (
            <SourceGroupCard source={item} index={index} />
          )}
          recycleItems
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchMessages}
            />
          }
          onEndReached={fetchOlderMessages}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No messages yet"
              subtitle="Messages from your apps and topics will appear here"
            />
          }
        />
      ) : (
        <LegendList
          data={filteredStream}
          keyExtractor={(item: MessageResponse) => String(item.id)}
          renderItem={({ item }: { item: MessageResponse }) => (
            <StreamMessageCard message={item} />
          )}
          recycleItems
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchMessages}
            />
          }
          onEndReached={fetchOlderMessages}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title="No messages yet"
              subtitle="Messages from your apps and topics will appear here"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
