import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth";
import { useMessagesStore } from "../../src/store/messages";
import { useThemeStore, useTheme } from "../../src/store/theme";
import { Colors } from "../../src/theme/colors";
import { getApiClient } from "../../src/api";
import type {
  VersionResponse,
  Client,
  StatsResponse,
  UserResponse,
  TopicPermission,
  MqttBridge,
  MqttStatus,
} from "../../src/api";
import {
  getDevicePushToken,
  requestNotificationPermissions,
} from "../../src/services/notifications";

export default function SettingsScreen() {
  const { isDark, mode } = useTheme();
  const setMode = useThemeStore((s) => s.setMode);
  const colors = isDark ? Colors.dark : Colors.light;

  const user = useAuthStore((s) => s.user);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const logout = useAuthStore((s) => s.logout);
  const setServerUrl = useAuthStore((s) => s.setServerUrl);
  const clearMessages = useMessagesStore((s) => s.clear);

  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>("Checking...");

  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Client token creation
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");

  // Admin sections
  const [showUsers, setShowUsers] = useState(false);
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showCreatePerm, setShowCreatePerm] = useState(false);
  const [newPermUserId, setNewPermUserId] = useState("");
  const [newPermPattern, setNewPermPattern] = useState("");
  const [newPermRead, setNewPermRead] = useState(true);
  const [newPermWrite, setNewPermWrite] = useState(false);

  // MQTT
  const [mqttStatus, setMqttStatus] = useState<MqttStatus | null>(null);
  const [bridges, setBridges] = useState<MqttBridge[]>([]);
  const [showBridges, setShowBridges] = useState(false);
  const [showMqttStatus, setShowMqttStatus] = useState(false);
  const [showCreateBridge, setShowCreateBridge] = useState(false);
  const [newBridgeName, setNewBridgeName] = useState("");
  const [newBridgeUrl, setNewBridgeUrl] = useState("");
  const [newBridgeUsername, setNewBridgeUsername] = useState("");
  const [newBridgePassword, setNewBridgePassword] = useState("");

  // Push notification status check
  useEffect(() => {
    (async () => {
      const token = await getDevicePushToken();
      if (token) {
        setPushStatus(`Registered (${token.substring(0, 20)}...)`);
      } else {
        setPushStatus("Not available — enable notifications in device settings");
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const api = getApiClient();
      const promises: Promise<unknown>[] = [
        api.version(),
        api.listClients(),
      ];

      if (user?.is_admin) {
        promises.push(api.getStats(), api.listUsers(), api.listPermissions(), api.getMqttStatus(), api.listBridges());
      }

      const results = await Promise.allSettled(promises);

      if (results[0].status === "fulfilled")
        setVersion(results[0].value as VersionResponse);
      if (results[1].status === "fulfilled")
        setClients(results[1].value as Client[]);

      if (user?.is_admin) {
        if (results[2]?.status === "fulfilled")
          setStats(results[2].value as StatsResponse);
        if (results[3]?.status === "fulfilled")
          setUsers(results[3].value as UserResponse[]);
        if (results[4]?.status === "fulfilled")
          setPermissions(results[4].value as TopicPermission[]);
        if (results[5]?.status === "fulfilled")
          setMqttStatus(results[5].value as MqttStatus);
        if (results[6]?.status === "fulfilled")
          setBridges(results[6].value as MqttBridge[]);
      }
    } catch {
      // ignore
    }
  }, [user?.is_admin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

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
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to update",
      );
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
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to change password",
      );
    }
  };

  const handleToggleAdmin = async (u: UserResponse) => {
    if (u.id === user?.id) {
      Alert.alert("Error", "Cannot change your own admin status");
      return;
    }
    try {
      const api = getApiClient();
      await api.updateUser(u.id, { is_admin: !u.is_admin });
      fetchData();
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to update user",
      );
    }
  };

  const handleDeleteUser = (u: UserResponse) => {
    if (u.id === user?.id) {
      Alert.alert("Error", "Cannot delete yourself");
      return;
    }
    Alert.alert("Delete User", `Delete "${u.username}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteUser(u.id);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {/* Light Mode */}
            <Pressable
              style={[styles.row, mode === "light" && styles.rowSelected]}
              onPress={() => setMode("light")}
            >
              <Ionicons name="sunny" size={22} color={mode === "light" ? colors.primary : colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Light Mode</Text>
                <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                  Bright and clean interface
                </Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: mode === "light" ? colors.primary : colors.border }]}>
                {mode === "light" && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>

            {/* Dark Mode */}
            <Pressable
              style={[styles.row, mode === "dark" && styles.rowSelected]}
              onPress={() => setMode("dark")}
            >
              <Ionicons name="moon" size={22} color={mode === "dark" ? colors.primary : colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                  Easy on the eyes in low light
                </Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: mode === "dark" ? colors.primary : colors.border }]}>
                {mode === "dark" && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>

            {/* System Mode */}
            <Pressable
              style={[styles.row, mode === "system" && styles.rowSelected]}
              onPress={() => setMode("system")}
            >
              <Ionicons name="phone-portrait" size={22} color={mode === "system" ? colors.primary : colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>System</Text>
                <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                  Match device theme automatically
                </Text>
              </View>
              <View style={[styles.radioOuter, { borderColor: mode === "system" ? colors.primary : colors.border }]}>
                {mode === "system" && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </Pressable>
          </View>
        </View>

        {/* Admin Stats */}
        {user?.is_admin && stats ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Server Stats</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.users}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Users</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.topics}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Topics</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.messages}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Messages</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.messages_last_24h}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last 24h</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* User Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Username</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>{user?.username}</Text>
              </View>
            </View>
            {user?.email ? (
              <View style={styles.row}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Email</Text>
                  <Text style={[styles.rowValue, { color: colors.text }]}>{user.email}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Role</Text>
                <Text style={[styles.rowValue, { color: colors.text }]}>
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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Change Password</Text>
            <Ionicons
              name={showPassword ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
          {showPassword ? (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="Current password"
                placeholderTextColor={colors.textTertiary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="New password (min 8 chars)"
                placeholderTextColor={colors.textTertiary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleChangePassword}
              >
                <Text style={styles.actionButtonText}>Update Password</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Server */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Server</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Ionicons name="server-outline" size={20} color={colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Server URL</Text>
                {editingUrl ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      autoCapitalize="none"
                      keyboardType="url"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Pressable
                      style={[styles.smallButton, { backgroundColor: colors.primary }]}
                      onPress={handleSaveUrl}
                    >
                      <Text style={styles.smallButtonText}>Save</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setEditingUrl(true)}>
                    <Text style={[styles.rowValueLink, { color: colors.primary }]}>{serverUrl}</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {version ? (
              <View style={styles.row}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Server Version</Text>
                  <Text style={[styles.rowValue, { color: colors.text }]}>{version.version}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Client Tokens */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Client Tokens ({clients.length})
            </Text>
            <Pressable
              onPress={() => {
                Alert.prompt
                  ? Alert.prompt("New Client Token", "Enter a name:", async (name) => {
                      if (!name?.trim()) return;
                      try {
                        const api = getApiClient();
                        await api.createClient({ name: name.trim() });
                        fetchData();
                      } catch (e) {
                        Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
                      }
                    })
                  : setShowCreateToken(true);
              }}
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {clients.map((client) => (
              <Pressable
                key={client.id}
                style={styles.row}
                onLongPress={() => {
                  Alert.alert("Delete Token", `Delete "${client.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const api = getApiClient();
                          await api.deleteClient(client.id);
                          fetchData();
                        } catch (e) {
                          Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
                        }
                      },
                    },
                  ]);
                }}
              >
                <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{client.name}</Text>
                  <Text style={[styles.rowValueMono, { color: colors.textSecondary }]}>{client.token}</Text>
                </View>
              </Pressable>
            ))}
            {clients.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No client tokens</Text>
            ) : null}
          </View>
        </View>

        {/* Push Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Push Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>FCM Status</Text>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{pushStatus}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.row]}
              onPress={async () => {
                const granted = await requestNotificationPermissions();
                if (granted) {
                  const token = await getDevicePushToken();
                  if (token) {
                    setPushStatus(`Registered (${token.substring(0, 20)}...)`);
                    // Re-register with server
                    try {
                      const api = getApiClient();
                      const clientsList = await api.listClients();
                      if (clientsList.length > 0) {
                        await api.registerFcmToken(clientsList[0].id, token);
                        Alert.alert("Success", "Push notifications registered");
                      }
                    } catch {
                      // best effort
                    }
                  }
                } else {
                  Alert.alert("Permissions Denied", "Enable notifications in device settings");
                }
              }}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.primary }]}>Re-register Push Token</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Admin User Management */}
        {user?.is_admin ? (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setShowUsers(!showUsers)}
            >
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                User Management ({users.length})
              </Text>
              <Ionicons
                name={showUsers ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>
            {showUsers ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {users.map((u) => (
                  <View key={u.id} style={styles.userRow}>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>{u.username}</Text>
                      {u.email ? (
                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                      ) : null}
                    </View>
                    <View style={styles.userActions}>
                      <View style={styles.adminToggle}>
                        <Text style={[styles.adminLabel, { color: colors.textTertiary }]}>Admin</Text>
                        <Switch
                          value={u.is_admin}
                          onValueChange={() => handleToggleAdmin(u)}
                          trackColor={{
                            false: isDark ? colors.border : "#d1d5db",
                            true: isDark ? colors.primary : "#93c5fd"
                          }}
                          thumbColor={u.is_admin ? colors.primary : (isDark ? colors.textTertiary : "#9ca3af")}
                          disabled={u.id === user?.id}
                        />
                      </View>
                      {u.id !== user?.id ? (
                        <Pressable
                          onPress={() => handleDeleteUser(u)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={colors.error}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Permissions (Admin) */}
        {user?.is_admin ? (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setShowPermissions(!showPermissions)}
            >
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Topic Permissions ({permissions.length})
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => setShowCreatePerm(true)}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                </Pressable>
                <Ionicons
                  name={showPermissions ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textTertiary}
                />
              </View>
            </Pressable>
            {showPermissions ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {permissions.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.userRow}
                    onLongPress={() => {
                      Alert.alert("Delete Permission", `Delete permission for pattern "${p.topic_pattern}"?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              const api = getApiClient();
                              await api.deletePermission(p.id);
                              fetchData();
                            } catch (e) {
                              Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>
                        User #{p.user_id} — {p.topic_pattern}
                      </Text>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                        {p.can_read ? "Read" : ""}{p.can_read && p.can_write ? " + " : ""}{p.can_write ? "Write" : ""}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {permissions.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No permissions configured</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* MQTT Status (Admin) */}
        {user?.is_admin && mqttStatus ? (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setShowMqttStatus(!showMqttStatus)}
            >
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                MQTT Broker
              </Text>
              <Ionicons
                name={showMqttStatus ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>
            {showMqttStatus ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.row}>
                  <Ionicons name="radio-outline" size={20} color={mqttStatus.enabled ? "#22c55e" : colors.textSecondary} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>Status</Text>
                    <Text style={[styles.rowValue, { color: mqttStatus.enabled ? "#22c55e" : colors.textSecondary }]}>
                      {mqttStatus.enabled ? "Enabled" : "Disabled"}
                    </Text>
                  </View>
                </View>
                {!mqttStatus.enabled ? (
                  <View style={[styles.row, { paddingVertical: 4 }]}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.textTertiary} />
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: colors.textTertiary, fontSize: 12 }]}>
                        Set MQTT_ENABLED=true to activate
                      </Text>
                    </View>
                  </View>
                ) : null}
                {mqttStatus.listen_addr ? (
                  <View style={styles.row}>
                    <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>TCP</Text>
                      <Text style={[styles.rowValue, { color: colors.text }]}>{mqttStatus.listen_addr}</Text>
                    </View>
                  </View>
                ) : null}
                {mqttStatus.ws_listen_addr ? (
                  <View style={styles.row}>
                    <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>WebSocket</Text>
                      <Text style={[styles.rowValue, { color: colors.text }]}>{mqttStatus.ws_listen_addr}</Text>
                    </View>
                  </View>
                ) : null}
                <View style={styles.row}>
                  <Ionicons name="git-branch-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Active Bridges</Text>
                    <Text style={[styles.rowValue, { color: colors.text }]}>{mqttStatus.bridges_active}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* MQTT Bridges (Admin) */}
        {user?.is_admin ? (
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setShowBridges(!showBridges)}
            >
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                MQTT Bridges ({bridges.length})
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => setShowCreateBridge(true)}
                  hitSlop={8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                </Pressable>
                <Ionicons
                  name={showBridges ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textTertiary}
                />
              </View>
            </Pressable>
            {showBridges ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {bridges.map((b) => {
                  const subCount = (() => { try { return JSON.parse(b.subscribe_topics).length; } catch { return 0; } })();
                  const pubCount = (() => { try { return (b.publish_topics ? JSON.parse(b.publish_topics).length : 0); } catch { return 0; } })();
                  return (
                    <Pressable
                      key={b.id}
                      style={styles.userRow}
                      onLongPress={() => {
                        Alert.alert(b.name, "Choose an action", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                const api = getApiClient();
                                await api.deleteBridge(b.id);
                                fetchData();
                              } catch (e) {
                                Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View style={[styles.statusDot, { backgroundColor: !b.enabled ? "#9ca3af" : mqttStatus?.bridges?.find(s => s.id === b.id)?.connected ? "#22c55e" : "#ef4444" }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userName, { color: colors.text }]}>{b.name}</Text>
                          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{b.remote_url}</Text>
                          <Text style={[styles.userEmail, { color: colors.textTertiary }]}>
                            Sub: {subCount} · Pub: {pubCount} · QoS {b.qos ?? 0}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                {bridges.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No MQTT bridges</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Logout */}
        <Pressable style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: isDark ? colors.error + "40" : "#fecaca" }]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal visible={showCreatePerm} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreatePerm(false)}>
          <Pressable style={{ maxHeight: "80%" }} onPress={() => {}}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Permission</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="User ID"
                placeholderTextColor={colors.textTertiary}
                value={newPermUserId}
                onChangeText={setNewPermUserId}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="Topic pattern (e.g. alerts.*)"
                placeholderTextColor={colors.textTertiary}
                value={newPermPattern}
                onChangeText={setNewPermPattern}
                autoCapitalize="none"
              />
              <View style={styles.permToggleRow}>
                <Text style={[{ fontSize: 15 }, { color: colors.text }]}>Can Read</Text>
                <Switch value={newPermRead} onValueChange={setNewPermRead} />
              </View>
              <View style={styles.permToggleRow}>
                <Text style={[{ fontSize: 15 }, { color: colors.text }]}>Can Write</Text>
                <Switch value={newPermWrite} onValueChange={setNewPermWrite} />
              </View>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalCancelButton, { backgroundColor: colors.backgroundTertiary }]}
                  onPress={() => { setShowCreatePerm(false); }}
                >
                  <Text style={[{ fontWeight: "600" }, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    const userId = parseInt(newPermUserId, 10);
                    if (isNaN(userId) || !newPermPattern.trim()) {
                      Alert.alert("Error", "User ID and pattern are required");
                      return;
                    }
                    try {
                      const api = getApiClient();
                      await api.createPermission({
                        user_id: userId,
                        topic_pattern: newPermPattern.trim(),
                        can_read: newPermRead,
                        can_write: newPermWrite,
                      });
                      setNewPermUserId("");
                      setNewPermPattern("");
                      setNewPermRead(true);
                      setNewPermWrite(false);
                      setShowCreatePerm(false);
                      fetchData();
                    } catch (e) {
                      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
                    }
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Create</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCreateBridge} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateBridge(false)}>
          <Pressable style={{ maxHeight: "80%" }} onPress={() => {}}>
            <KeyboardAwareScrollView
              bottomOffset={20}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            >
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New MQTT Bridge</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Bridge name"
                  placeholderTextColor={colors.textTertiary}
                  value={newBridgeName}
                  onChangeText={setNewBridgeName}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Broker URL (host:port)"
                  placeholderTextColor={colors.textTertiary}
                  value={newBridgeUrl}
                  onChangeText={setNewBridgeUrl}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Username (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={newBridgeUsername}
                  onChangeText={setNewBridgeUsername}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Password (optional)"
                  placeholderTextColor={colors.textTertiary}
                  value={newBridgePassword}
                  onChangeText={setNewBridgePassword}
                  secureTextEntry
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalCancelButton, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={() => { setShowCreateBridge(false); setNewBridgeName(""); setNewBridgeUrl(""); }}
                  >
                    <Text style={[{ fontWeight: "600" }, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      if (!newBridgeName.trim() || !newBridgeUrl.trim()) {
                        Alert.alert("Error", "Name and URL are required");
                        return;
                      }
                      try {
                        const api = getApiClient();
                        await api.createBridge({
                          name: newBridgeName.trim(),
                          remote_url: newBridgeUrl.trim(),
                          subscribe_topics: ["#"],
                          username: newBridgeUsername || undefined,
                          password: newBridgePassword || undefined,
                        });
                        setNewBridgeName("");
                        setNewBridgeUrl("");
                        setNewBridgeUsername("");
                        setNewBridgePassword("");
                        setShowCreateBridge(false);
                        fetchData();
                      } catch (e) {
                        Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
                      }
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Create</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCreateToken} animationType="fade" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateToken(false)}>
          <Pressable style={{ maxHeight: "80%" }} onPress={() => {}}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Client Token</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="Token name"
                placeholderTextColor={colors.textTertiary}
                value={newTokenName}
                onChangeText={setNewTokenName}
                autoCapitalize="none"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalCancelButton, { backgroundColor: colors.backgroundTertiary }]}
                  onPress={() => { setShowCreateToken(false); setNewTokenName(""); }}
                >
                  <Text style={[{ fontWeight: "600" }, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitButton, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    if (!newTokenName.trim()) return;
                    try {
                      const api = getApiClient();
                      await api.createClient({ name: newTokenName.trim() });
                      setNewTokenName("");
                      setShowCreateToken(false);
                      fetchData();
                    } catch (e) {
                      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
                    }
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Create</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  rowSelected: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowDescription: { fontSize: 12, marginTop: 2 },
  rowValue: { fontSize: 15, marginTop: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
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
  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3b82f6",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  // User management
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  userEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  userActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  adminToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  adminLabel: { fontSize: 11, color: "#9ca3af" },
  // Logout
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  modalSubmitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  permToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
