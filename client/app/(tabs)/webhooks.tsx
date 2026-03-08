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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { getApiClient } from "../../src/api";
import type { WebhookConfig, Topic, UpdateWebhookConfig, WebhookDeliveryLog, WebhookTestResult } from "../../src/api";
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

  const [editWebhook, setEditWebhook] = useState<WebhookConfig | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTargetUrl, setEditTargetUrl] = useState("");
  const [editHttpMethod, setEditHttpMethod] = useState("POST");
  const [editHeaders, setEditHeaders] = useState("");
  const [editBodyTemplate, setEditBodyTemplate] = useState("");
  const [editMaxRetries, setEditMaxRetries] = useState("3");
  const [editRetryDelay, setEditRetryDelay] = useState("60");
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLog[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Create form state
  const [direction, setDirection] = useState<Direction>("incoming");
  const [name, setName] = useState("");
  const [webhookType, setWebhookType] = useState("custom");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [httpMethod, setHttpMethod] = useState("POST");
  const [createHeaders, setCreateHeaders] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");

  // Server base URL for webhook URL display
  const [serverBase, setServerBase] = useState("");

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
      // Derive server base from API client
      if (!serverBase) {
        try {
          setServerBase(api.getBaseUrl() || "");
        } catch {
          // ignore
        }
      }
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to load webhooks",
      );
    } finally {
      setIsLoading(false);
    }
  }, [serverBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const parseHeadersToText = (headers?: string | null): string => {
    if (!headers) return "";
    try {
      const obj = JSON.parse(headers);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join("\n");
    } catch {
      return headers;
    }
  };

  const parseTextToHeaders = (text: string): Record<string, string> | undefined => {
    const headers: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  const resetForm = () => {
    setDirection("incoming");
    setName("");
    setWebhookType("custom");
    setSelectedTopicId(null);
    setTargetUrl("");
    setHttpMethod("POST");
    setCreateHeaders("");
    setBodyTemplate("");
  };

  const getWebhookUrl = (wh: WebhookConfig) => {
    const base = serverBase || "https://your-server";
    return `${base}/api/wh/${wh.token}`;
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
        headers: direction === "outgoing" ? parseTextToHeaders(createHeaders) : undefined,
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

  const handleTest = async (webhook: WebhookConfig) => {
    setTestingId(webhook.id);
    try {
      const api = getApiClient();
      const result: WebhookTestResult = await api.testWebhook(webhook.id);
      if (webhook.direction === "incoming") {
        const url = result.webhook_url || getWebhookUrl(webhook);
        Alert.alert(
          "Incoming Webhook URL",
          `Send POST requests to:\n\n${url}`,
          [
            { text: "Copy URL", onPress: () => Clipboard.setStringAsync(url) },
            { text: "Copy curl", onPress: () => Clipboard.setStringAsync(result.curl_example || "") },
            { text: "OK" },
          ],
        );
      } else {
        Alert.alert(
          result.success ? "Test Successful" : "Test Failed",
          result.success
            ? `HTTP ${result.status_code}\n${result.response_preview?.slice(0, 200) || ""}`
            : result.error || "Unknown error",
        );
      }
    } catch (e) {
      Alert.alert("Test Failed", e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const openEdit = (wh: WebhookConfig) => {
    setEditWebhook(wh);
    setEditName(wh.name);
    setEditEnabled(wh.enabled);
    setEditTargetUrl(wh.target_url || "");
    setEditHttpMethod(wh.http_method || "POST");
    setEditHeaders(parseHeadersToText(wh.headers));
    setEditBodyTemplate(wh.body_template || "");
    setEditMaxRetries(String(wh.max_retries ?? 3));
    setEditRetryDelay(String(wh.retry_delay_secs ?? 60));
  };

  const handleEdit = async () => {
    if (!editWebhook) return;
    const isOutgoing = editWebhook.direction === "outgoing";
    try {
      const api = getApiClient();
      await api.updateWebhook(editWebhook.id, {
        name: editName.trim() || undefined,
        enabled: editEnabled,
        ...(isOutgoing ? {
          target_url: editTargetUrl.trim() || undefined,
          http_method: editHttpMethod,
          headers: parseTextToHeaders(editHeaders),
          body_template: editBodyTemplate.trim() || undefined,
          max_retries: parseInt(editMaxRetries, 10) || 3,
          retry_delay_secs: parseInt(editRetryDelay, 10) || 60,
        } : {}),
      });
      setEditWebhook(null);
      fetchData();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Update failed");
    }
  };

  const openDeliveries = async (wh: WebhookConfig) => {
    setDeliveriesWebhook(wh);
    setDeliveriesLoading(true);
    try {
      const api = getApiClient();
      const logs = await api.listWebhookDeliveries(wh.id);
      setDeliveries(logs);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load deliveries");
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const handleCopyUrl = async (wh: WebhookConfig) => {
    const url = getWebhookUrl(wh);
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert("Copied", "Webhook URL copied to clipboard");
    } catch {
      Alert.alert("Webhook URL", url);
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
                {item.direction === "outgoing" && item.target_url ? (
                  <Text style={[styles.webhookUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.http_method} {item.target_url}
                  </Text>
                ) : (
                  <Pressable style={styles.urlRow} onPress={() => handleCopyUrl(item)}>
                    <Text style={[styles.urlText, { color: colors.primary }]} numberOfLines={1}>
                      {getWebhookUrl(item)}
                    </Text>
                    <Ionicons name="copy-outline" size={12} color={colors.primary} />
                  </Pressable>
                )}
              </View>
              <View style={styles.webhookActions}>
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleEnabled(item)}
                  trackColor={{ false: colors.textTertiary, true: isDark ? "#3b82f6" : "#93c5fd" }}
                  thumbColor={item.enabled ? colors.primary : colors.textTertiary}
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable onPress={() => handleTest(item)} hitSlop={8}>
                    <Ionicons
                      name="play-outline"
                      size={18}
                      color={testingId === item.id ? colors.textTertiary : colors.success}
                    />
                  </Pressable>
                  <Pressable onPress={() => openDeliveries(item)} hitSlop={8}>
                    <Ionicons name="list-outline" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
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

                {/* Webhook type selector */}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Webhook Type</Text>
                  <View style={styles.methodRow}>
                    {["custom", "json", "github", "grafana"].map((t) => (
                      <Pressable
                        key={t}
                        style={[
                          styles.typeChip,
                          { backgroundColor: colors.backgroundTertiary },
                          webhookType === t && [styles.typeChipActive, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }],
                        ]}
                        onPress={() => setWebhookType(t)}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            { color: colors.textSecondary },
                            webhookType === t && [styles.typeChipTextActive, { color: isDark ? "#93c5fd" : "#1e40af" }],
                          ]}
                        >
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Topic selector */}
                {topics.length > 0 ? (
                  <View>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Target Topic {direction === "incoming" ? "(required)" : "(triggers outgoing)"}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                    </ScrollView>
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
                      placeholder="Headers (one per line: Key: Value)"
                      placeholderTextColor={colors.textTertiary}
                      value={createHeaders}
                      onChangeText={setCreateHeaders}
                      multiline
                      numberOfLines={2}
                    />
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

      {/* Edit Modal */}
      <Modal visible={!!editWebhook} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setEditWebhook(null)}>
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScrollContent}>
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Webhook</Text>

                {/* Show webhook URL for incoming */}
                {editWebhook && editWebhook.direction !== "outgoing" && (
                  <Pressable
                    style={[styles.urlBox, { backgroundColor: isDark ? "#1e3a5a" : "#eff6ff" }]}
                    onPress={() => {
                      const url = getWebhookUrl(editWebhook);
                      Clipboard.setStringAsync(url);
                      Alert.alert("Copied", "Webhook URL copied");
                    }}
                  >
                    <Text style={[styles.urlBoxLabel, { color: isDark ? "#93c5fd" : "#1e40af" }]}>Webhook URL (tap to copy)</Text>
                    <Text style={[styles.urlBoxText, { color: isDark ? "#bfdbfe" : "#1e3a8a" }]} numberOfLines={2}>
                      {getWebhookUrl(editWebhook)}
                    </Text>
                  </Pressable>
                )}

                {/* Type and direction info */}
                {editWebhook && (
                  <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                    Type: {editWebhook.webhook_type} | Direction: {editWebhook.direction}
                  </Text>
                )}

                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Name"
                  placeholderTextColor={colors.textTertiary}
                  value={editName}
                  onChangeText={setEditName}
                />
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Enabled</Text>
                  <Switch value={editEnabled} onValueChange={setEditEnabled} />
                </View>
                {editWebhook?.direction === "outgoing" && (
                  <>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      placeholder="Target URL"
                      placeholderTextColor={colors.textTertiary}
                      value={editTargetUrl}
                      onChangeText={setEditTargetUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    <View style={styles.methodRow}>
                      {["GET", "POST", "PUT"].map((m) => (
                        <Pressable
                          key={m}
                          style={[styles.methodBtn, { backgroundColor: colors.backgroundTertiary }, editHttpMethod === m && [styles.methodBtnActive, { backgroundColor: colors.primary }]]}
                          onPress={() => setEditHttpMethod(m)}
                        >
                          <Text style={[styles.methodBtnText, { color: colors.textSecondary }, editHttpMethod === m && styles.methodBtnTextActive]}>{m}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.input, styles.multilineInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      placeholder="Headers (one per line: Key: Value)"
                      placeholderTextColor={colors.textTertiary}
                      value={editHeaders}
                      onChangeText={setEditHeaders}
                      multiline
                      numberOfLines={2}
                    />
                    <TextInput
                      style={[styles.input, styles.multilineInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      placeholder="Body template"
                      placeholderTextColor={colors.textTertiary}
                      value={editBodyTemplate}
                      onChangeText={setEditBodyTemplate}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.retryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Max Retries</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                          value={editMaxRetries}
                          onChangeText={setEditMaxRetries}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Retry Delay (s)</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                          value={editRetryDelay}
                          onChangeText={setEditRetryDelay}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </>
                )}
                <View style={styles.modalButtons}>
                  <Pressable style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]} onPress={() => setEditWebhook(null)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleEdit}>
                    <Text style={styles.submitText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Deliveries Modal */}
      <Modal visible={!!deliveriesWebhook} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setDeliveriesWebhook(null)}>
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Delivery Logs — {deliveriesWebhook?.name}</Text>
              {deliveriesLoading ? (
                <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 16 }}>Loading...</Text>
              ) : deliveries.length === 0 ? (
                <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 16 }}>No deliveries yet</Text>
              ) : (
                <FlatList
                  data={deliveries}
                  keyExtractor={(d) => d.id.toString()}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item: d }) => (
                    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: d.success ? colors.success : colors.error, fontSize: 13, fontWeight: "600" }}>
                          {d.success ? "OK" : "FAIL"} {d.status_code ? `(${d.status_code})` : ""}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{d.duration_ms}ms</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{new Date(d.attempted_at).toLocaleString()}</Text>
                      {d.response_body_preview ? (
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{d.response_body_preview}</Text>
                      ) : null}
                    </View>
                  )}
                />
              )}
              <Pressable style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary, marginTop: 8 }]} onPress={() => setDeliveriesWebhook(null)}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Close</Text>
              </Pressable>
            </View>
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
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  urlText: { fontSize: 11, fontFamily: "monospace" },
  urlBox: {
    borderRadius: 8,
    padding: 10,
  },
  urlBoxLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  urlBoxText: { fontSize: 12, fontFamily: "monospace" },
  infoText: { fontSize: 12 },
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
  topicList: { flexDirection: "row", gap: 6 },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  topicChipActive: {},
  topicChipText: { fontSize: 13 },
  topicChipTextActive: {},
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeChipActive: {},
  typeChipText: { fontSize: 12, textTransform: "capitalize" },
  typeChipTextActive: {},
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
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  toggleLabel: { fontSize: 15 },
  retryRow: { flexDirection: "row", gap: 12 },
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
