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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { getApiClient } from "../../src/api";
import type { Application } from "../../src/api";
import * as Clipboard from "expo-clipboard";

export default function AppsScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const result = await api.listApplications();
      setApps(result);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load apps");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleCreateApp = async () => {
    if (!newAppName.trim()) return;
    try {
      const api = getApiClient();
      await api.createApplication({
        name: newAppName.trim(),
        description: newAppDesc.trim() || undefined,
      });
      setNewAppName("");
      setNewAppDesc("");
      setShowCreate(false);
      fetchApps();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create app");
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await Clipboard.setStringAsync(token);
      Alert.alert("Copied", "App token copied to clipboard");
    } catch {
      Alert.alert("Token", token);
    }
  };

  const keyExtractor = useCallback(
    (item: Application) => item.id.toString(),
    [],
  );

  const handleDeleteApp = (app: Application) => {
    Alert.alert("Delete Application", `Delete "${app.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteApplication(app.id);
            fetchApps();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Applications</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        </Pressable>
      </View>

      <FlatList
        data={apps}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={styles.appItem}>
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.appDesc} numberOfLines={1}>
                  {item.description}
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
            <Pressable onPress={() => handleDeleteApp(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </Pressable>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchApps} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="apps-outline"
              title="No applications"
              subtitle="Create an app to start sending messages"
            />
          )
        }
        contentContainerStyle={apps.length === 0 ? styles.emptyList : undefined}
      />

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Application</Text>
            <TextInput
              style={styles.input}
              placeholder="Application name"
              placeholderTextColor="#9ca3af"
              value={newAppName}
              onChangeText={setNewAppName}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#9ca3af"
              value={newAppDesc}
              onChangeText={setNewAppDesc}
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
                onPress={handleCreateApp}
              >
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
  appItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  appInfo: { flex: 1, marginRight: 12 },
  appName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  appDesc: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  tokenText: { fontSize: 12, color: "#9ca3af", fontFamily: "monospace" },
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
