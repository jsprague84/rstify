import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LegendList } from "@legendapp/list";
import { MessageBubble } from "../../src/components/inbox/MessageBubble";
import { MessageIcon } from "../../src/components/MessageIcon";
import { EmptyState } from "../../src/components/EmptyState";
import { SwipeableRow } from "../../src/components/design/SwipeableRow";
import { useMessagesStore, useApplicationsStore } from "../../src/store";
import { getApiClient } from "../../src/api";
import type { MessageResponse } from "../../src/api";

export default function ThreadScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const router = useRouter();

  const decodedSourceId = decodeURIComponent(sourceId ?? "");

  const sourceMeta = useMessagesStore((s) => s.sourceMeta);
  const groupedMessages = useMessagesStore((s) => s.groupedMessages);
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
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
        .catch(() => {})
        .finally(() => setIsFetching(false));
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
    if (!decodedSourceId.startsWith("topic:")) return;
    const topicName = decodedSourceId.replace("topic:", "");
    setRefreshing(true);
    try {
      const msgs = await getApiClient().getTopicMessages(topicName, 100, 0);
      setServerMessages(msgs);
    } catch {}
    setRefreshing(false);
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
            className="text-body font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {sourceName}
          </Text>
          <Text className="text-caption text-slate-400 dark:text-slate-500">
            {messages.length} {messages.length === 1 ? "message" : "messages"}
          </Text>
        </View>
      </View>

      {/* Message list */}
      <LegendList
        data={messages}
        keyExtractor={(item: MessageResponse) => String(item.id)}
        renderItem={({ item }: { item: MessageResponse }) => (
          <SwipeableRow onDelete={() => deleteMessage(item.id)}>
            <MessageBubble message={item} />
          </SwipeableRow>
        )}
        recycleItems
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-outline"
            title="No messages"
            subtitle="Messages from this source will appear here"
          />
        }
      />
    </SafeAreaView>
  );
}
