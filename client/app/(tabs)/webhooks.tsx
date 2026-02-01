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
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { getApiClient } from "../../src/api";
import type { WebhookConfig, Topic } from "../../src/api";
import * as Clipboard from "expo-clipboard";

type Direction = "incoming" | "outgoing";

export default function WebhooksScreen() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [direction, setDirection] = useState<Direction>("incoming");
  const [name, setName] = useState("");
  const [webhookType, setWebhookType] = useState("json");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [httpMethod, setHttpMethod] = useState("POST");
  const [bodyTemplate, setBodyTemplate] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const [wh, tp] = await Promise.all([
        api.listWebhooks(),
        api.listTopics(),
      ]);
      setWebhooks(wh);
      setTopics(tp);
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to load webhooks",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setDirection("incoming");
    setName("");
    setWebhookType("json");
    setSelectedTopicId(null);
    setTargetUrl("");
    setHttpMethod("POST");
    setBodyTemplate("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    if (direction === "outgoing" && !targetUrl.trim()) {
      Alert.alert("Error", "Target URL is required for outgoing webhooks");
      return;
    }

    try {
      const api = getApiClient();
      await api.createWebhook({
        name: name.trim(),
        webhook_type: webhookType,
        template: {},
        direction,
        target_topic_id: selectedTopicId ?? undefined,
        target_url: direction === "outgoing" ? targetUrl.trim() : undefined,
        http_method: direction === "outgoing" ? httpMethod : undefined,
        body_template:
          direction === "outgoing" && bodyTemplate.trim()
            ? bodyTemplate.trim()
            : undefined,
      });
      resetForm();
      setShowCreate(false);
      fetchData();
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to create webhook",
      );
    }
  };

  const handleToggleEnabled = async (webhook: WebhookConfig) => {
    try {
      const api = getApiClient();
      await api.updateWebhook(webhook.id, { enabled: !webhook.enabled });
      fetchData();
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to update webhook",
      );
    }
  };

  const handleDelete = (webhook: WebhookConfig) => {
    Alert.alert("Delete Webhook", `Delete "${webhook.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteWebhook(webhook.id);
            fetchData();
          } catch (e) {
            Alert.alert(
              "Error",
              e instanceof Error ? e.message : "Delete failed",
            );
          }
        },
      },
    ]);
  };

  const handleCopyToken = async (token: string) => {
    try {
      await Clipboard.setStringAsync(token);
      Alert.alert("Copied", "Webhook token copied to clipboard");
    } catch {
      Alert.alert("Token", token);
    }
  };

  const keyExtractor = useCallback(
    (item: WebhookConfig) => item.id.toString(),
    [],
  );

  const getDirectionBadge = (dir: string) => {
    const isOutgoing = dir === "outgoing";
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: isOutgoing ? "#fef3c7" : "#dbeafe" },
        ]}
      >
        <Ionicons
          name={isOutgoing ? "arrow-forward-outline" : "arrow-back-outline"}
          size={10}
          color={isOutgoing ? "#92400e" : "#1e40af"}
        />
        <Text
          style={[
            styles.badgeText,
            { color: isOutgoing ? "#92400e" : "#1e40af" },
          ]}
        >
          {isOutgoing ? "Outgoing" : "Incoming"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Webhooks</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        </Pressable>
      </View>

      <FlatList
        data={webhooks}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={styles.webhookItem}>
            <View style={styles.webhookTop}>
              <View style={styles.webhookInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.webhookName}>{item.name}</Text>
                  {getDirectionBadge(item.direction)}
                </View>
                <Text style={styles.webhookType}>{item.webhook_type}</Text>
                {item.target_url ? (
                  <Text style={styles.webhookUrl} numberOfLines={1}>
                    {item.http_method} {item.target_url}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.tokenRow}
                  onPress={() => handleCopyToken(item.token)}
                >
                  <Text style={styles.tokenText} numberOfLines={1}>
                    {item.token}
                  </Text>
                  <Ionicons name="copy-outline" size={14} color="#9ca3af" />
                </Pressable>
              </View>
              <View style={styles.webhookActions}>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleEnabled(item)}
                  trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                  thumbColor={item.enabled ? "#3b82f6" : "#9ca3af"}
                />
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchData} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="link-outline"
              title="No webhooks"
              subtitle="Create a webhook to integrate with external services"
            />
          )
        }
        contentContainerStyle={
          webhooks.length === 0 ? styles.emptyList : undefined
        }
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Webhook</Text>

            {/* Direction toggle */}
            <View style={styles.directionRow}>
              <Pressable
                style={[
                  styles.directionBtn,
                  direction === "incoming" && styles.directionBtnActive,
                ]}
                onPress={() => setDirection("incoming")}
              >
                <Text
                  style={[
                    styles.directionBtnText,
                    direction === "incoming" && styles.directionBtnTextActive,
                  ]}
                >
                  Incoming
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.directionBtn,
                  direction === "outgoing" && styles.directionBtnActive,
                ]}
                onPress={() => setDirection("outgoing")}
              >
                <Text
                  style={[
                    styles.directionBtnText,
                    direction === "outgoing" && styles.directionBtnTextActive,
                  ]}
                >
                  Outgoing
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Webhook name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />

            {/* Topic selector */}
            {topics.length > 0 ? (
              <View>
                <Text style={styles.fieldLabel}>Target Topic (optional)</Text>
                <View style={styles.topicList}>
                  <Pressable
                    style={[
                      styles.topicChip,
                      selectedTopicId === null && styles.topicChipActive,
                    ]}
                    onPress={() => setSelectedTopicId(null)}
                  >
                    <Text
                      style={[
                        styles.topicChipText,
                        selectedTopicId === null && styles.topicChipTextActive,
                      ]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {topics.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.topicChip,
                        selectedTopicId === t.id && styles.topicChipActive,
                      ]}
                      onPress={() => setSelectedTopicId(t.id)}
                    >
                      <Text
                        style={[
                          styles.topicChipText,
                          selectedTopicId === t.id &&
                            styles.topicChipTextActive,
                        ]}
                      >
                        {t.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Outgoing-specific fields */}
            {direction === "outgoing" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Target URL"
                  placeholderTextColor="#9ca3af"
                  value={targetUrl}
                  onChangeText={setTargetUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={styles.methodRow}>
                  {["GET", "POST", "PUT"].map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.methodBtn,
                        httpMethod === m && styles.methodBtnActive,
                      ]}
                      onPress={() => setHttpMethod(m)}
                    >
                      <Text
                        style={[
                          styles.methodBtnText,
                          httpMethod === m && styles.methodBtnTextActive,
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Body template (optional, use {{message}}, {{title}})"
                  placeholderTextColor="#9ca3af"
                  value={bodyTemplate}
                  onChangeText={setBodyTemplate}
                  multiline
                  numberOfLines={3}
                />
              </>
            ) : null}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  resetForm();
                  setShowCreate(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={handleCreate}>
                <Text style={styles.submitText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  emptyList: { flex: 1 },
  webhookItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  webhookTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  webhookInfo: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  webhookName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  webhookType: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  webhookUrl: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  webhookActions: { alignItems: "center", gap: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  tokenText: { fontSize: 12, color: "#9ca3af", fontFamily: "monospace" },
  // Modal
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
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  directionRow: { flexDirection: "row", gap: 8 },
  directionBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  directionBtnActive: { backgroundColor: "#3b82f6" },
  directionBtnText: { fontWeight: "600", color: "#6b7280" },
  directionBtnTextActive: { color: "#fff" },
  fieldLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  topicList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  topicChipActive: { backgroundColor: "#dbeafe" },
  topicChipText: { fontSize: 13, color: "#6b7280" },
  topicChipTextActive: { color: "#1e40af" },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  methodBtnActive: { backgroundColor: "#3b82f6" },
  methodBtnText: { fontWeight: "600", color: "#6b7280", fontSize: 13 },
  methodBtnTextActive: { color: "#fff" },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#111827",
  },
  multilineInput: { minHeight: 72, textAlignVertical: "top" },
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
