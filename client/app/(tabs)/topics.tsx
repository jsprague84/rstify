import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { MessageCard } from "../../src/components/MessageCard";
import { getApiClient } from "../../src/api";
import type { Topic, MessageResponse } from "../../src/api";

export default function TopicsScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicMessages, setTopicMessages] = useState<MessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishMessage, setPublishMessage] = useState("");

  const fetchTopics = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const result = await api.listTopics();
      setTopics(result);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load topics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleSelectTopic = async (topic: Topic) => {
    setSelectedTopic(topic);
    try {
      const api = getApiClient();
      const msgs = await api.getTopicMessages(topic.name);
      setTopicMessages(msgs);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load messages");
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) return;
    try {
      const api = getApiClient();
      await api.createTopic({ name: newTopicName.trim() });
      setNewTopicName("");
      setShowCreate(false);
      fetchTopics();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create topic");
    }
  };

  const handlePublish = async () => {
    if (!selectedTopic || !publishMessage.trim()) return;
    try {
      const api = getApiClient();
      const msg = await api.publishToTopic(selectedTopic.name, {
        title: publishTitle.trim() || undefined,
        message: publishMessage.trim(),
      });
      setTopicMessages((prev) => [msg, ...prev]);
      setPublishTitle("");
      setPublishMessage("");
      setShowPublish(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to publish");
    }
  };

  const handleDeleteTopic = (topic: Topic) => {
    Alert.alert("Delete Topic", `Delete "${topic.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteTopic(topic.name);
            if (selectedTopic?.id === topic.id) {
              setSelectedTopic(null);
              setTopicMessages([]);
            }
            fetchTopics();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  };

  const messageKeyExtractor = useCallback(
    (item: MessageResponse) => item.id.toString(),
    [],
  );

  const topicKeyExtractor = useCallback(
    (item: Topic) => item.id.toString(),
    [],
  );

  const renderTopicMessage = useCallback(
    ({ item }: { item: MessageResponse }) => <MessageCard message={item} />,
    [],
  );

  // Topic detail view
  if (selectedTopic) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedTopic(null)} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>{selectedTopic.name}</Text>
          <Pressable onPress={() => setShowPublish(true)} hitSlop={8}>
            <Ionicons name="send-outline" size={20} color="#3b82f6" />
          </Pressable>
        </View>

        <FlatList
          data={topicMessages}
          keyExtractor={messageKeyExtractor}
          renderItem={renderTopicMessage}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={11}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="No messages"
              subtitle="Publish a message to this topic"
            />
          }
          contentContainerStyle={
            topicMessages.length === 0 ? styles.emptyList : styles.list
          }
        />

        <Modal visible={showPublish} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Publish to {selectedTopic.name}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Title (optional)"
                placeholderTextColor="#9ca3af"
                value={publishTitle}
                onChangeText={setPublishTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Message"
                placeholderTextColor="#9ca3af"
                value={publishMessage}
                onChangeText={setPublishMessage}
                multiline
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowPublish(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.submitButton} onPress={handlePublish}>
                  <Text style={styles.submitText}>Publish</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  // Topics list view
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Topics</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        </Pressable>
      </View>

      <FlatList
        data={topics}
        keyExtractor={topicKeyExtractor}
        renderItem={({ item }) => (
          <Pressable
            style={styles.topicItem}
            onPress={() => handleSelectTopic(item)}
            onLongPress={() => handleDeleteTopic(item)}
          >
            <View style={styles.topicInfo}>
              <Text style={styles.topicName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.topicDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.topicBadges}>
              {item.everyone_read ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>public</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.privateBadge]}>
                  <Text style={[styles.badgeText, styles.privateBadgeText]}>
                    private
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </View>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchTopics} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="megaphone-outline"
              title="No topics"
              subtitle="Create a topic to start publishing messages"
            />
          )
        }
        contentContainerStyle={
          topics.length === 0 ? styles.emptyList : undefined
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Topic</Text>
            <TextInput
              style={styles.input}
              placeholder="Topic name (e.g. alerts.production)"
              placeholderTextColor="#9ca3af"
              value={newTopicName}
              onChangeText={setNewTopicName}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowCreate(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.submitButton}
                onPress={handleCreateTopic}
              >
                <Text style={styles.submitText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  list: { paddingVertical: 8 },
  emptyList: { flex: 1 },
  topicItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  topicInfo: { flex: 1 },
  topicName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  topicDesc: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  topicBadges: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    backgroundColor: "#dbeafe",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: "#3b82f6", fontWeight: "500" },
  privateBadge: { backgroundColor: "#fef3c7" },
  privateBadgeText: { color: "#d97706" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelText: { color: "#6b7280", fontWeight: "600" },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "600" },
});
