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
import type { UserResponse, StatsResponse, TopicPermission } from '../../src/api';

export default function UsersScreen() {
  const user = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      const [u, s, p] = await Promise.allSettled([
        api.listUsers(),
        api.getStats(),
        api.listPermissions(),
      ]);
      if (u.status === 'fulfilled') setUsers(u.value);
      if (s.status === 'fulfilled') setStats(s.value);
      if (p.status === 'fulfilled') setPermissions(p.value);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      <HubScreenHeader title="User Management" />

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View className="p-4 gap-6">
            {/* Stats */}
            {stats && (
              <View className="gap-2">
                <SectionLabel>Server Stats</SectionLabel>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: 'Users', value: stats.users },
                    { label: 'Topics', value: stats.topics },
                    { label: 'Messages', value: stats.messages },
                    { label: 'Last 24h', value: stats.messages_last_24h },
                  ].map((s) => (
                    <View key={s.label} className="flex-1 min-w-[45%] bg-white dark:bg-surface-card rounded-xl p-4 items-center">
                      <Text className="text-2xl font-bold text-primary">{s.value}</Text>
                      <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

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
                        User #{p.user_id} -- {p.topic_pattern}
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
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="User ID"
          placeholderTextColor="#9ca3af"
          value={newPermUserId}
          onChangeText={setNewPermUserId}
          keyboardType="numeric"
        />
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
    </SafeAreaView>
  );
}
