import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  Switch,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { EmptyState } from '../../src/components/EmptyState';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { FormModal } from '../../src/components/design/FormModal';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { getApiClient } from '../../src/api';
import type { UserResponse, TopicPermission } from '../../src/api';

export default function UsersScreen() {
  const user = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Edit user
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Create user
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserAdmin, setNewUserAdmin] = useState(false);

  // Permission creation
  const [showCreatePerm, setShowCreatePerm] = useState(false);
  const [newPermUserId, setNewPermUserId] = useState('');
  const [newPermPattern, setNewPermPattern] = useState('');
  const [newPermRead, setNewPermRead] = useState(true);
  const [newPermWrite, setNewPermWrite] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const [u, p] = await Promise.allSettled([
        api.listUsers(),
        api.listPermissions(),
      ]);
      if (u.status === 'fulfilled') setUsers(u.value);
      if (p.status === 'fulfilled') setPermissions(p.value);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (user?.is_admin) fetchData(); }, [fetchData, user?.is_admin]);

  const handleToggleAdmin = async (u: UserResponse) => {
    if (u.id === user?.id) {
      Alert.alert('Error', 'Cannot change your own admin status');
      return;
    }
    try {
      const api = getApiClient();
      await api.updateUser(u.id, { is_admin: !u.is_admin });
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update user');
    }
  };

  const openEditUser = (u: UserResponse) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email ?? '');
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUsername.trim()) return;
    try {
      const api = getApiClient();
      await api.updateUser(editingUser.id, {
        username: editUsername.trim(),
        email: editEmail.trim() || undefined,
      });
      setEditingUser(null);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = (u: UserResponse) => {
    if (u.id === user?.id) {
      Alert.alert('Error', 'Cannot delete yourself');
      return;
    }
    Alert.alert('Delete User', `Delete "${u.username}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteUser(u.id);
            fetchData();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const handleDeletePermission = (p: TopicPermission) => {
    Alert.alert('Delete Permission', `Delete permission for pattern "${p.topic_pattern}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deletePermission(p.id);
            fetchData();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newUserPassword.trim()) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }
    if (newUserPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    try {
      const api = getApiClient();
      await api.createUser({
        username: newUsername.trim(),
        password: newUserPassword,
        email: newUserEmail.trim() || undefined,
        is_admin: newUserAdmin,
      });
      setNewUsername(''); setNewUserPassword(''); setNewUserEmail(''); setNewUserAdmin(false);
      setShowCreateUser(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create user');
    }
  };

  const handleCreatePermission = async () => {
    const userId = parseInt(newPermUserId, 10);
    if (isNaN(userId) || !newPermPattern.trim()) {
      Alert.alert('Error', 'User ID and pattern are required');
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
      setNewPermUserId(''); setNewPermPattern('');
      setNewPermRead(true); setNewPermWrite(false);
      setShowCreatePerm(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create');
    }
  };

  const resolveUsername = (userId: number): string => {
    const found = users.find((u) => u.id === userId);
    return found?.username ?? `User #${userId}`;
  };

  // Redirect non-admins
  if (!user?.is_admin) {
    return (
      <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg items-center justify-center" edges={['top']}>
        <Text className="text-slate-500">Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <HubScreenHeader title="User Management" onAdd={() => setShowCreateUser(true)} />

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View className="p-4 gap-6">
            {/* Users */}
            <View className="gap-2">
              <SectionLabel>Users ({users.length})</SectionLabel>
              <View className="bg-white dark:bg-surface-card rounded-xl overflow-hidden">
                {users.map((u) => (
                  <View key={u.id} className="flex-row items-center justify-between p-3 gap-3">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{u.username}</Text>
                      {u.email ? (
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{u.email}</Text>
                      ) : null}
                    </View>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-row items-center gap-1">
                        <Text className="text-[11px] text-slate-400 dark:text-slate-500">Admin</Text>
                        <Switch
                          value={u.is_admin}
                          onValueChange={() => handleToggleAdmin(u)}
                          trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                          thumbColor={u.is_admin ? '#3b82f6' : '#9ca3af'}
                          disabled={u.id === user?.id}
                        />
                      </View>
                      <Pressable onPress={() => openEditUser(u)} hitSlop={8}>
                        <Ionicons name="create-outline" size={16} color="#3b82f6" />
                      </Pressable>
                      {u.id !== user?.id && (
                        <Pressable onPress={() => handleDeleteUser(u)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
                {users.length === 0 && (
                  <Text className="p-3 text-slate-400 dark:text-slate-500 text-sm">No users</Text>
                )}
              </View>
            </View>

            {/* Permissions */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between px-1">
                <SectionLabel>Topic Permissions ({permissions.length})</SectionLabel>
                <Pressable onPress={() => setShowCreatePerm(true)} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={18} color="#3b82f6" />
                </Pressable>
              </View>
              <View className="bg-white dark:bg-surface-card rounded-xl overflow-hidden">
                {permissions.map((p) => (
                  <Pressable
                    key={p.id}
                    className="flex-row items-center justify-between p-3 gap-3"
                    onLongPress={() => handleDeletePermission(p)}
                  >
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {resolveUsername(p.user_id)} -- {p.topic_pattern}
                      </Text>
                      <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {p.can_read ? 'Read' : ''}{p.can_read && p.can_write ? ' + ' : ''}{p.can_write ? 'Write' : ''}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {permissions.length === 0 && (
                  <Text className="p-3 text-slate-400 dark:text-slate-500 text-sm">No permissions configured</Text>
                )}
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
      />

      {/* Create Permission Modal */}
      <FormModal visible={showCreatePerm} onClose={() => setShowCreatePerm(false)} title="New Permission">
        <View className="gap-1">
          <Text className="text-sm text-slate-500 dark:text-slate-400">User</Text>
          <View className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
            {users.filter((u) => u.id !== user?.id).map((u) => (
              <Pressable
                key={u.id}
                className={`flex-row items-center justify-between p-3 ${newPermUserId === String(u.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onPress={() => setNewPermUserId(String(u.id))}
              >
                <Text className="text-base text-slate-900 dark:text-slate-100">{u.username}</Text>
                {newPermUserId === String(u.id) && (
                  <Ionicons name="checkmark" size={18} color="#3b82f6" />
                )}
              </Pressable>
            ))}
          </View>
        </View>
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Topic pattern (e.g. alerts.*)"
          placeholderTextColor="#9ca3af"
          value={newPermPattern}
          onChangeText={setNewPermPattern}
          autoCapitalize="none"
        />
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-base text-slate-900 dark:text-slate-100">Can Read</Text>
          <Switch value={newPermRead} onValueChange={setNewPermRead} />
        </View>
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-base text-slate-900 dark:text-slate-100">Can Write</Text>
          <Switch value={newPermWrite} onValueChange={setNewPermWrite} />
        </View>
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setShowCreatePerm(false)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleCreatePermission}
          >
            <Text className="font-semibold text-white">Create</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
      {/* Create User Modal */}
      <FormModal visible={showCreateUser} onClose={() => setShowCreateUser(false)} title="New User">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Username"
          placeholderTextColor="#9ca3af"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Password (min 8 characters)"
          placeholderTextColor="#9ca3af"
          value={newUserPassword}
          onChangeText={setNewUserPassword}
          secureTextEntry
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Email (optional)"
          placeholderTextColor="#9ca3af"
          value={newUserEmail}
          onChangeText={setNewUserEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-base text-slate-900 dark:text-slate-100">Admin</Text>
          <Switch value={newUserAdmin} onValueChange={setNewUserAdmin} />
        </View>
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setShowCreateUser(false)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleCreateUser}
          >
            <Text className="font-semibold text-white">Create</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
      {/* Edit User Modal */}
      <FormModal visible={!!editingUser} onClose={() => setEditingUser(null)} title="Edit User">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Username"
          placeholderTextColor="#9ca3af"
          value={editUsername}
          onChangeText={setEditUsername}
          autoCapitalize="none"
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Email (optional)"
          placeholderTextColor="#9ca3af"
          value={editEmail}
          onChangeText={setEditEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setEditingUser(null)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleEditUser}
          >
            <Text className="font-semibold text-white">Save</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}
