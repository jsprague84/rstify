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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../src/components/EmptyState";
import { getApiClient } from "../../src/api";
import type { Application } from "../../src/api";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../src/store/theme";
import { Colors } from "../../src/theme/colors";

function AppIconView({ app }: { app: Application }) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const api = getApiClient();
  if (!app.image) {
    return (
      <View style={[styles.iconPlaceholder, { backgroundColor: colors.backgroundTertiary }]}>
        <Text style={[styles.iconPlaceholderText, { color: colors.textTertiary }]}>
          {app.name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `${api.applicationIconUrl(app.id)}?v=${app.updated_at}` }}
      style={styles.appIcon}
      resizeMode="contain"
    />
  );
}

export default function AppsScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [apps, setApps] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppDesc, setNewAppDesc] = useState("");
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("5");

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

  const openEditApp = (app: Application) => {
    setEditApp(app);
    setEditName(app.name);
    setEditDesc(app.description || "");
    setEditPriority(String(app.default_priority));
  };

  const handleEditApp = async () => {
    if (!editApp || !editName.trim()) return;
    try {
      const api = getApiClient();
      await api.updateApplication(editApp.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        default_priority: parseInt(editPriority) || 5,
      });
      setEditApp(null);
      fetchApps();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Update failed");
    }
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Applications</Text>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={apps}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={[styles.appItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <AppIconView app={item} />
            <View style={styles.appInfo}>
              <Text style={[styles.appName, { color: colors.text }]}>{item.name}</Text>
              {item.description ? (
                <Text style={[styles.appDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.description}
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
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => openEditApp(item)} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => handleDeleteApp(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
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
                <Text style={[styles.modalTitle, { color: colors.text }]}>Create Application</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Application name"
                  placeholderTextColor={colors.textTertiary}
                  value={newAppName}
                  onChangeText={setNewAppName}
                  returnKeyType="next"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={newAppDesc}
                  onChangeText={setNewAppDesc}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateApp}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={() => setShowCreate(false)}
                  >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateApp}
                  >
                    <Text style={styles.submitText}>Create</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!editApp} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setEditApp(null)}>
          <Pressable style={styles.modalOuter} onPress={() => {}}>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScrollContent}>
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Application</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Name"
                  placeholderTextColor={colors.textTertiary}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={editDesc}
                  onChangeText={setEditDesc}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Default Priority (1-10)"
                  placeholderTextColor={colors.textTertiary}
                  value={editPriority}
                  onChangeText={setEditPriority}
                  keyboardType="numeric"
                />
                <View style={styles.modalButtons}>
                  <Pressable style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]} onPress={() => setEditApp(null)}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleEditApp}>
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
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  emptyList: { flex: 1 },
  appItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 12,
  },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconPlaceholderText: {
    fontSize: 16,
    fontWeight: "700",
  },
  appInfo: { flex: 1, marginRight: 12 },
  appName: { fontSize: 15, fontWeight: "600" },
  appDesc: { fontSize: 13, marginTop: 2 },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  tokenText: { fontSize: 12, fontFamily: "monospace" },
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
