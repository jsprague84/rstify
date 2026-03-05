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
import { getApiClient } from "../../src/api";
import type { WebhookConfig, Topic } from "../../src/api";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../src/store/theme";
import { Colors } from "../../src/theme/colors";

type Direction = "incoming" | "outgoing";

export default function WebhooksScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
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
    const bgColor = isOutgoing
      ? (isDark ? "#713f12" : "#fef3c7")
      : (isDark ? "#1e3a8a" : "#dbeafe");
    const textColor = isOutgoing
      ? (isDark ? "#fcd34d" : "#92400e")
      : (isDark ? "#93c5fd" : "#1e40af");
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: bgColor },
        ]}
      >
        <Ionicons
          name={isOutgoing ? "arrow-forward-outline" : "arrow-back-outline"}
          size={10}
          color={textColor}
        />
        <Text
          style={[
            styles.badgeText,
            { color: textColor },
          ]}
        >
          {isOutgoing ? "Outgoing" : "Incoming"}
        </Text>
      </View>
    );
  };

  const closeModal = () => {
    resetForm();
    setShowCreate(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Webhooks</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={webhooks}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={[styles.webhookItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.webhookTop}>
              <View style={styles.webhookInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.webhookName, { color: colors.text }]}>{item.name}</Text>
                  {getDirectionBadge(item.direction)}
                </View>
                <Text style={[styles.webhookType, { color: colors.textTertiary }]}>{item.webhook_type}</Text>
                {item.target_url ? (
                  <Text style={[styles.webhookUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.http_method} {item.target_url}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.tokenRow}
                  onPress={() => handleCopyToken(item.token)}
                >
                  <Text style={[styles.tokenText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {item.token}
                  </Text>
                  <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
                </Pressable>
              </View>
              <View style={styles.webhookActions}>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleEnabled(item)}
                  trackColor={{ false: colors.textTertiary, true: isDark ? "#3b82f6" : "#93c5fd" }}
                  thumbColor={item.enabled ? colors.primary : colors.textTertiary}
                />
                <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
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

      <Modal visible={showCreate} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <KeyboardAwareScrollView
              bottomOffset={20}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create Webhook</Text>

                {/* Direction toggle */}
                <View style={styles.directionRow}>
                  <Pressable
                    style={[
                      styles.directionBtn,
                      { backgroundColor: colors.backgroundTertiary },
                      direction === "incoming" && [styles.directionBtnActive, { backgroundColor: colors.primary }],
                    ]}
                    onPress={() => setDirection("incoming")}
                  >
                    <Text
                      style={[
                        styles.directionBtnText,
                        { color: colors.textSecondary },
                        direction === "incoming" && styles.directionBtnTextActive,
                      ]}
                    >
                      Incoming
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.directionBtn,
                      { backgroundColor: colors.backgroundTertiary },
                      direction === "outgoing" && [styles.directionBtnActive, { backgroundColor: colors.primary }],
                    ]}
                    onPress={() => setDirection("outgoing")}
                  >
                    <Text
                      style={[
                        styles.directionBtnText,
                        { color: colors.textSecondary },
                        direction === "outgoing" && styles.directionBtnTextActive,
                      ]}
                    >
                      Outgoing
                    </Text>
                  </Pressable>
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Webhook name"
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />

                {/* Topic selector */}
                {topics.length > 0 ? (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Target Topic (optional)</Text>
                    <View style={styles.topicList}>
                      <Pressable
                        style={[
                          styles.topicChip,
                          { backgroundColor: colors.backgroundTertiary },
                          selectedTopicId === null && [styles.topicChipActive, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }],
                        ]}
                        onPress={() => setSelectedTopicId(null)}
                      >
                        <Text
                          style={[
                            styles.topicChipText,
                            { color: colors.textSecondary },
                            selectedTopicId === null && [styles.topicChipTextActive, { color: isDark ? "#93c5fd" : "#1e40af" }],
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
                            { backgroundColor: colors.backgroundTertiary },
                            selectedTopicId === t.id && [styles.topicChipActive, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }],
                          ]}
                          onPress={() => setSelectedTopicId(t.id)}
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              { color: colors.textSecondary },
                              selectedTopicId === t.id &&
                                [styles.topicChipTextActive, { color: isDark ? "#93c5fd" : "#1e40af" }],
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
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      placeholder="Target URL"
                      placeholderTextColor={colors.textTertiary}
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
                            { backgroundColor: colors.backgroundTertiary },
                            httpMethod === m && [styles.methodBtnActive, { backgroundColor: colors.primary }],
                          ]}
                          onPress={() => setHttpMethod(m)}
                        >
                          <Text
                            style={[
                              styles.methodBtnText,
                              { color: colors.textSecondary },
                              httpMethod === m && styles.methodBtnTextActive,
                            ]}
                          >
                            {m}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, styles.multilineInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      placeholder="Body template (optional, use {{message}}, {{title}})"
                      placeholderTextColor={colors.textTertiary}
                      value={bodyTemplate}
                      onChangeText={setBodyTemplate}
                      multiline
                      numberOfLines={3}
                    />
                  </>
                ) : null}

                <View style={styles.modalButtons}>
                  <Pressable style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]} onPress={closeModal}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleCreate}>
                    <Text style={styles.submitText}>Create</Text>
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
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  emptyList: { flex: 1 },
  webhookItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  webhookTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  webhookInfo: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  webhookName: { fontSize: 15, fontWeight: "600" },
  webhookType: { fontSize: 12, marginTop: 2 },
  webhookUrl: { fontSize: 12, marginTop: 2 },
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
  tokenText: { fontSize: 12, fontFamily: "monospace" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalOuter: {
    maxHeight: "85%",
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
  directionRow: { flexDirection: "row", gap: 8 },
  directionBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  directionBtnActive: {},
  directionBtnText: { fontWeight: "600" },
  directionBtnTextActive: { color: "#fff" },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  topicList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  topicChipActive: {},
  topicChipText: { fontSize: 13 },
  topicChipTextActive: {},
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  methodBtnActive: {},
  methodBtnText: { fontWeight: "600", fontSize: 13 },
  methodBtnTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  multilineInput: { minHeight: 72, textAlignVertical: "top" },
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
});
