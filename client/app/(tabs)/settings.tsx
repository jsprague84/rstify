import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth";
import { useMessagesStore } from "../../src/store/messages";
import { getApiClient } from "../../src/api";
import type { VersionResponse, Client } from "../../src/api";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const logout = useAuthStore((s) => s.logout);
  const setServerUrl = useAuthStore((s) => s.setServerUrl);
  const clearMessages = useMessagesStore((s) => s.clear);

  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = getApiClient();
        const [ver, cls] = await Promise.all([
          api.version(),
          api.listClients(),
        ]);
        setVersion(ver);
        setClients(cls);
      } catch {
        // ignore
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          clearMessages();
          logout();
        },
      },
    ]);
  };

  const handleSaveUrl = async () => {
    try {
      await setServerUrl(urlInput);
      setEditingUrl(false);
      Alert.alert("Server Updated", "Please log in again.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill in both password fields");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters");
      return;
    }
    try {
      const api = getApiClient();
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setShowPassword(false);
      Alert.alert("Success", "Password changed successfully");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to change password");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Username</Text>
                <Text style={styles.rowValue}>{user?.username}</Text>
              </View>
            </View>
            {user?.email ? (
              <View style={styles.row}>
                <Ionicons name="mail-outline" size={20} color="#6b7280" />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Email</Text>
                  <Text style={styles.rowValue}>{user.email}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <Ionicons name="shield-outline" size={20} color="#6b7280" />
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Role</Text>
                <Text style={styles.rowValue}>
                  {user?.is_admin ? "Administrator" : "User"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Change Password */}
        <View style={styles.section}>
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.sectionTitle}>Change Password</Text>
            <Ionicons
              name={showPassword ? "chevron-up" : "chevron-down"}
              size={18}
              color="#9ca3af"
            />
          </Pressable>
          {showPassword ? (
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor="#9ca3af"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="New password (min 8 chars)"
                placeholderTextColor="#9ca3af"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Pressable
                style={styles.actionButton}
                onPress={handleChangePassword}
              >
                <Text style={styles.actionButtonText}>Update Password</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Server */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="server-outline" size={20} color="#6b7280" />
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Server URL</Text>
                {editingUrl ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    <Pressable
                      style={styles.smallButton}
                      onPress={handleSaveUrl}
                    >
                      <Text style={styles.smallButtonText}>Save</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setEditingUrl(true)}>
                    <Text style={styles.rowValueLink}>{serverUrl}</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {version ? (
              <View style={styles.row}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#6b7280"
                />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Server Version</Text>
                  <Text style={styles.rowValue}>{version.version}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Client Tokens */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Client Tokens ({clients.length})
          </Text>
          <View style={styles.card}>
            {clients.map((client) => (
              <View key={client.id} style={styles.row}>
                <Ionicons name="key-outline" size={20} color="#6b7280" />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{client.name}</Text>
                  <Text style={styles.rowValueMono}>{client.token}</Text>
                </View>
              </View>
            ))}
            {clients.length === 0 ? (
              <Text style={styles.emptyText}>No client tokens</Text>
            ) : null}
          </View>
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  section: {},
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, color: "#9ca3af" },
  rowValue: { fontSize: 15, color: "#111827", marginTop: 2 },
  rowValueLink: {
    fontSize: 15,
    color: "#3b82f6",
    marginTop: 2,
    textDecorationLine: "underline",
  },
  rowValueMono: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    fontFamily: "monospace",
  },
  editRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#111827",
    marginHorizontal: 12,
  },
  smallButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  smallButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  actionButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
  },
  actionButtonText: { color: "#fff", fontWeight: "600" },
  emptyText: { padding: 12, color: "#9ca3af", fontSize: 14 },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
});
