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
import { useConnectionStore } from "../../src/store/connection";
import { useUserWebSocket } from "../../src/hooks/useWebSocket";
import { showMessageNotification } from "../../src/services/notifications";
import { getApiClient } from "../../src/api";
import { getDevicePushToken } from "../../src/services/notifications";
import { ensureMobileClient } from "../../src/services/mobileClient";
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

  // Server-side search over FULL message history (the local cache only holds
  // the most recent window). Debounced; out-of-order responses are dropped.
  const [serverResults, setServerResults] = useState<MessageResponse[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = searchQuery.trim();
    const seq = ++searchSeq.current;
    if (!q) {
      setServerResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      getApiClient()
        .searchMessages({ q, limit: 100 })
        .then((res) => { if (seq === searchSeq.current) setServerResults(res); })
        .catch(() => { if (seq === searchSeq.current) setServerResults([]); })
        .finally(() => { if (seq === searchSeq.current) setSearching(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // --- Client token setup for WebSocket ---
  useEffect(() => {
    const setupClient = async () => {
      try {
        const api = getApiClient();
        const client = await ensureMobileClient();

        setClientToken(client.token);

        // Register this device's push token under our own client.
        const pushToken = await getDevicePushToken();
        if (pushToken) {
          api
            .registerFcmToken(client.id, pushToken)
            .catch((e) => console.warn("[inbox] FCM register failed:", e));
        }
      } catch (e) {
        console.warn("[inbox] client setup failed; will retry on next mount:", e);
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
    // Refetch on reconnect so messages that arrived during a drop aren't lost.
    onReconnect: fetchMessages,
    enabled: !!clientToken,
  });

  // Publish the socket state app-wide so other screens can surface drops.
  const setConnectionStatus = useConnectionStore((s) => s.setStatus);
  useEffect(() => {
    setConnectionStatus(connectionStatus);
  }, [connectionStatus, setConnectionStatus]);

  // --- Initial fetch ---
  useEffect(() => {
    fetchMessages();
    fetchApplications();
  }, [fetchMessages, fetchApplications]);

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
            <Text className="text-display font-bold text-slate-900 dark:text-white">
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
          <Text className="text-display font-bold text-slate-900 dark:text-white">
            Inbox
          </Text>
          <ConnectionStatus status={connectionStatus} />
        </View>

        {/* Search */}
        <TextInput
          className="bg-white dark:bg-surface-card rounded-lg px-3 py-2 text-body text-slate-900 dark:text-white mb-3"
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
      {searchQuery.trim() ? (
        // Search results: flat list over the server's full-history search.
        <LegendList
          data={serverResults ?? []}
          keyExtractor={(item: MessageResponse) => String(item.id)}
          renderItem={({ item }: { item: MessageResponse }) => (
            <StreamMessageCard message={item} />
          )}
          recycleItems
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
          ListEmptyComponent={
            searching || serverResults === null ? (
              <View className="gap-2 mt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <MessageCardSkeleton key={i} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="search-outline"
                title={`No results for “${searchQuery.trim()}”`}
                subtitle="Search covers your full message history on the server"
              />
            )
          }
        />
      ) : viewMode === "grouped" ? (
        <LegendList
          data={groupedSources}
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
          data={streamMessages}
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
