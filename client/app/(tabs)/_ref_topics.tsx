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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { MessageCard } from "../../src/components/MessageCard";
import { LiveTopicView } from "../../src/components/LiveTopicView";
import { getApiClient } from "../../src/api";
import type { Topic, MessageResponse } from "../../src/api";
import { useTheme } from "../../src/store/theme";
import { Colors } from "../../src/theme/colors";

export default function TopicsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicMessages, setTopicMessages] = useState<MessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicEveryoneRead, setNewTopicEveryoneRead] = useState(false);
  const [newTopicEveryoneWrite, setNewTopicEveryoneWrite] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editEveryoneRead, setEditEveryoneRead] = useState(false);
  const [editEveryoneWrite, setEditEveryoneWrite] = useState(false);
  const [editNotifyPolicy, setEditNotifyPolicy] = useState("always");
  const [editNotifyPriorityMin, setEditNotifyPriorityMin] = useState("0");
  const [editNotifyCondition, setEditNotifyCondition] = useState("");
  const [editNotifyDigestInterval, setEditNotifyDigestInterval] = useState("300");
  const [editStorePolicy, setEditStorePolicy] = useState("all");
  const [editStoreInterval, setEditStoreInterval] = useState("60");
  const [viewMode, setViewMode] = useState<"history" | "live">("history");

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
      await api.createTopic({
        name: newTopicName.trim(),
        everyone_read: newTopicEveryoneRead,
        everyone_write: newTopicEveryoneWrite,
      });
      setNewTopicName("");
      setNewTopicEveryoneRead(false);
      setNewTopicEveryoneWrite(false);
      setShowCreate(false);
      fetchTopics();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create topic");
    }
  };

  const handleEditTopic = async () => {
    if (!editTopic) return;
    try {
      const api = getApiClient();
      await api.updateTopic(editTopic.name, {
        description: editDesc || undefined,
        everyone_read: editEveryoneRead,
        everyone_write: editEveryoneWrite,
        notify_policy: editNotifyPolicy,
        notify_priority_min: editNotifyPolicy === "threshold" ? Number(editNotifyPriorityMin) : undefined,
        notify_condition: editNotifyPolicy === "on_change" ? editNotifyCondition || undefined : undefined,
        notify_digest_interval: editNotifyPolicy === "digest" ? Number(editNotifyDigestInterval) : undefined,
        store_policy: editStorePolicy,
        store_interval: editStorePolicy === "interval" ? Number(editStoreInterval) : undefined,
      });
      setShowEdit(false);
      setEditTopic(null);
      fetchTopics();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update topic");
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => { setSelectedTopic(null); setViewMode("history"); }} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{selectedTopic.name}</Text>
          <Pressable onPress={() => setShowPublish(true)} hitSlop={8}>
            <Ionicons name="send-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.segmentRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable
            style={[styles.segmentButton, viewMode === "history" && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode("history")}
          >
            <Text style={[styles.segmentText, { color: colors.textSecondary }, viewMode === "history" && { color: "#fff" }]}>
              History
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, viewMode === "live" && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode("live")}
          >
            <Text style={[styles.segmentText, { color: colors.textSecondary }, viewMode === "live" && { color: "#fff" }]}>
              Live
            </Text>
          </Pressable>
        </View>

        {viewMode === "history" ? (
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
        ) : (
          <LiveTopicView topicName={selectedTopic.name} />
        )}

        <Modal visible={showPublish} animationType="fade" transparent>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowPublish(false)}
          >
            <Pressable style={styles.modalOuter} onPress={() => {}}>
              <KeyboardAwareScrollView
                bottomOffset={20}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Publish to {selectedTopic.name}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Title (optional)"
                    placeholderTextColor={colors.textTertiary}
                    value={publishTitle}
                    onChangeText={setPublishTitle}
                    returnKeyType="next"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Message"
                    placeholderTextColor={colors.textTertiary}
                    value={publishMessage}
                    onChangeText={setPublishMessage}
                    multiline
                  />
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                      onPress={() => setShowPublish(false)}
                    >
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                    <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handlePublish}>
                      <Text style={styles.submitText}>Publish</Text>
                    </Pressable>
                  </View>
                </View>
              </KeyboardAwareScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  // Topics list view
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Topics</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={topics}
        keyExtractor={topicKeyExtractor}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.topicItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
            onPress={() => handleSelectTopic(item)}
            onLongPress={() => {
              Alert.alert(item.name, "Choose an action", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Edit",
                  onPress: () => {
                    setEditTopic(item);
                    setEditDesc(item.description || "");
                    setEditEveryoneRead(item.everyone_read);
                    setEditEveryoneWrite(item.everyone_write);
                    setEditNotifyPolicy(item.notify_policy || "always");
                    setEditNotifyPriorityMin(String(item.notify_priority_min ?? 0));
                    setEditNotifyCondition(item.notify_condition || "");
                    setEditNotifyDigestInterval(String(item.notify_digest_interval ?? 300));
                    setEditStorePolicy(item.store_policy || "all");
                    setEditStoreInterval(String(item.store_interval ?? 60));
                    setShowEdit(true);
                  },
                },
                { text: "Delete", style: "destructive", onPress: () => handleDeleteTopic(item) },
              ]);
            }}
          >
            <View style={styles.topicInfo}>
              <Text style={[styles.topicName, { color: colors.text }]}>{item.name}</Text>
              {item.description ? (
                <Text style={[styles.topicDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.topicBadges}>
              {item.everyone_read ? (
                <View style={[styles.badge, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }]}>
                  <Text style={[styles.badgeText, { color: isDark ? "#93c5fd" : "#3b82f6" }]}>public</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.privateBadge, { backgroundColor: isDark ? "#713f12" : "#fef3c7" }]}>
                  <Text style={[styles.badgeText, styles.privateBadgeText, { color: isDark ? "#fcd34d" : "#d97706" }]}>
                    private
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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

      <Modal visible={showCreate} animationType="fade" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreate(false)}
        >
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <KeyboardAwareScrollView
              bottomOffset={20}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create Topic</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Topic name (e.g. alerts.production)"
                  placeholderTextColor={colors.textTertiary}
                  value={newTopicName}
                  onChangeText={setNewTopicName}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleCreateTopic}
                />
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Public Read</Text>
                  <Switch value={newTopicEveryoneRead} onValueChange={setNewTopicEveryoneRead} />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Public Write</Text>
                  <Switch value={newTopicEveryoneWrite} onValueChange={setNewTopicEveryoneWrite} />
                </View>
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={() => setShowCreate(false)}
                  >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateTopic}
                  >
                    <Text style={styles.submitText}>Create</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showEdit} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEdit(false)}>
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <KeyboardAwareScrollView
              bottomOffset={20}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Edit {editTopic?.name}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Description"
                  placeholderTextColor={colors.textTertiary}
                  value={editDesc}
                  onChangeText={setEditDesc}
                />
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Public Read</Text>
                  <Switch value={editEveryoneRead} onValueChange={setEditEveryoneRead} />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Public Write</Text>
                  <Switch value={editEveryoneWrite} onValueChange={setEditEveryoneWrite} />
                </View>

                <View style={[styles.sectionHeader, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Policy</Text>
                </View>
                <View style={styles.policyRow}>
                  {(["always", "never", "threshold", "on_change", "digest"] as const).map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.policyChip,
                        { borderColor: colors.border },
                        editNotifyPolicy === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setEditNotifyPolicy(p)}
                    >
                      <Text
                        style={[
                          styles.policyChipText,
                          { color: colors.textSecondary },
                          editNotifyPolicy === p && { color: "#fff" },
                        ]}
                      >
                        {p === "on_change" ? "Change" : p === "threshold" ? "Threshold" : p === "digest" ? "Digest" : p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {editNotifyPolicy === "threshold" && (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Min priority (0-10)"
                    placeholderTextColor={colors.textTertiary}
                    value={editNotifyPriorityMin}
                    onChangeText={setEditNotifyPriorityMin}
                    keyboardType="numeric"
                  />
                )}
                {editNotifyPolicy === "on_change" && (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Field to watch (e.g. message)"
                    placeholderTextColor={colors.textTertiary}
                    value={editNotifyCondition}
                    onChangeText={setEditNotifyCondition}
                  />
                )}
                {editNotifyPolicy === "digest" && (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Digest interval (seconds)"
                    placeholderTextColor={colors.textTertiary}
                    value={editNotifyDigestInterval}
                    onChangeText={setEditNotifyDigestInterval}
                    keyboardType="numeric"
                  />
                )}

                <View style={[styles.sectionHeader, { borderTopColor: colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Storage Policy</Text>
                </View>
                <View style={styles.policyRow}>
                  {(["all", "interval", "on_change"] as const).map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.policyChip,
                        { borderColor: colors.border },
                        editStorePolicy === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setEditStorePolicy(p)}
                    >
                      <Text
                        style={[
                          styles.policyChipText,
                          { color: colors.textSecondary },
                          editStorePolicy === p && { color: "#fff" },
                        ]}
                      >
                        {p === "on_change" ? "Change" : p === "interval" ? "Interval" : "All"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {editStorePolicy === "interval" && (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                    placeholder="Store interval (seconds)"
                    placeholderTextColor={colors.textTertiary}
                    value={editStoreInterval}
                    onChangeText={setEditStoreInterval}
                    keyboardType="numeric"
                  />
                )}

                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={() => setShowEdit(false)}
                  >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleEditTopic}
                  >
                    <Text style={styles.submitText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  list: { paddingVertical: 8 },
  emptyList: { flex: 1 },
  topicItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  topicInfo: { flex: 1 },
  topicName: { fontSize: 15, fontWeight: "600" },
  topicDesc: { fontSize: 13, marginTop: 2 },
  topicBadges: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: "500" },
  privateBadge: {},
  privateBadgeText: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalOuter: {
    maxHeight: "80%",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modal: {
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelText: { fontWeight: "600" },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  toggleLabel: { fontSize: 15 },
  sectionHeader: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  policyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  policyChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  policyChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
