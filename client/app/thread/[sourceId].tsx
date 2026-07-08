import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { MessageBubble } from "../../src/components/inbox/MessageBubble";
import { MessageIcon } from "../../src/components/MessageIcon";
import { EmptyState } from "../../src/components/EmptyState";
import { MessageCardSkeleton } from "../../src/components/design/SkeletonShimmer";
import { ConnectionStatus } from "../../src/components/design/ConnectionStatus";
import { SwipeableRow } from "../../src/components/design/SwipeableRow";
import { useMessagesStore, useApplicationsStore } from "../../src/store";
import { useConnectionStore } from "../../src/store/connection";
import { getApiClient } from "../../src/api";
import type { MessageResponse } from "../../src/api";

export default function ThreadScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const router = useRouter();
  const connectionStatus = useConnectionStore((s) => s.status);

  const decodedSourceId = decodeURIComponent(sourceId ?? "");

  const sourceMeta = useMessagesStore((s) => s.sourceMeta);
  const groupedMessages = useMessagesStore((s) => s.groupedMessages);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
  const removeAttachment = useMessagesStore((s) => s.removeAttachment);
  const getApp = useApplicationsStore((s) => s.getApp);
  const getIconUrl = useApplicationsStore((s) => s.getIconUrl);
  const meta = sourceMeta.get(decodedSourceId);

  const [serverMessages, setServerMessages] = useState<MessageResponse[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const storeMessages = groupedMessages.get(decodedSourceId);
    if (storeMessages && storeMessages.length > 0) return;
    if (decodedSourceId.startsWith("topic:")) {
      const topicName = decodedSourceId.replace("topic:", "");
      setIsFetching(true);
      getApiClient()
        .getTopicMessages(topicName, 100, 0)
        .then(setServerMessages)
        .catch(e => console.warn('Failed to load topic messages', e))
        .finally(() => setIsFetching(false));
    } else if (decodedSourceId.startsWith("app:")) {
      // App threads get the same server fallback as topics — a cleared cache
      // must not read as "No messages" when history exists server-side.
      const appId = parseInt(decodedSourceId.slice("app:".length), 10);
      if (Number.isFinite(appId)) {
        setIsFetching(true);
        getApiClient()
          .listApplicationMessages(appId, 100, 0)
          .then((res) => setServerMessages(res.messages))
          .catch(e => console.warn('Failed to load app messages', e))
          .finally(() => setIsFetching(false));
      }
    }
  }, [decodedSourceId, groupedMessages]);

  const storeMessages = groupedMessages.get(decodedSourceId);
  const messages = storeMessages && storeMessages.length > 0 ? storeMessages : serverMessages;

  // Resolve source info from meta or by parsing the sourceId
  let sourceName = meta?.name ?? decodedSourceId;
  let iconUrl = meta?.iconUrl ?? null;

  if (!meta) {
    // Fallback: parse sourceId directly
    const isTopic = decodedSourceId.startsWith("topic:");
    if (isTopic) {
      sourceName = decodedSourceId.slice("topic:".length);
    } else {
      const appId = parseInt(
        decodedSourceId.slice("app:".length),
        10,
      );
      const app = getApp(appId);
      sourceName = app?.name ?? `App ${appId}`;
      iconUrl = getIconUrl(appId);
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (decodedSourceId.startsWith("topic:")) {
        const topicName = decodedSourceId.replace("topic:", "");
        setServerMessages(await getApiClient().getTopicMessages(topicName, 100, 0));
      } else if (decodedSourceId.startsWith("app:")) {
        const appId = parseInt(decodedSourceId.slice("app:".length), 10);
        if (Number.isFinite(appId)) {
          const res = await getApiClient().listApplicationMessages(appId, 100, 0);
          setServerMessages(res.messages);
        }
      }
    } catch {}
    setRefreshing(false);
  };

  const handleAttachmentDeleted = (messageId: number, attachmentId: number) => {
    removeAttachment(messageId, attachmentId);
    setServerMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, attachments: (m.attachments ?? []).filter((a) => a.id !== attachmentId) }
          : m,
      ),
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-surface-bg"
      edges={["top"]}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#64748b" />
        </Pressable>

        <MessageIcon iconUrl={iconUrl} size={32} name={sourceName} />

        <View className="flex-1 min-w-0">
          <Text
            className="text-body font-semibold text-slate-900 dark:text-white"
            numberOfLines={1}
          >
            {sourceName}
          </Text>
          <Text className="text-caption text-slate-400 dark:text-slate-500">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </Text>
        </View>

        <ConnectionStatus status={connectionStatus} />
      </View>

      {/* Message list */}
      <LegendList
        data={messages}
        keyExtractor={(item: MessageResponse) => String(item.id)}
        renderItem={({ item }: { item: MessageResponse }) => (
          <SwipeableRow onDelete={() => deleteMessage(item.id)}>
            <MessageBubble
              message={item}
              onAttachmentDeleted={(attId) => handleAttachmentDeleted(item.id, attId)}
            />
          </SwipeableRow>
        )}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          isFetching ? (
            <View className="gap-2 mt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <MessageCardSkeleton key={i} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="chatbubble-outline"
              title="No messages"
              subtitle="Messages from this source will appear here"
            />
          )
        }
      />
    </SafeAreaView>
  );
}
