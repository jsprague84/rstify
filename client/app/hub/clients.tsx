import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { EmptyState } from '../../src/components/EmptyState';
import { getApiClient } from '../../src/api';
import type { Client } from '../../src/api';
import {
  getDevicePushToken,
  requestNotificationPermissions,
} from '../../src/services/notifications';

export default function ClientsScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('Checking...');

  // Create token form
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getDevicePushToken();
      if (token) {
        setPushStatus(`Registered (${token.substring(0, 20)}...)`);
      } else {
        setPushStatus('Not available');
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const list = await api.listClients();
      setClients(list);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load clients');
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;
    try {
      const api = getApiClient();
      await api.createClient({ name: newTokenName.trim() });
      setNewTokenName('');
      setShowCreate(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create');
    }
  };

  const handleDeleteClient = (client: Client) => {
    Alert.alert('Delete Token', `Delete "${client.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteClient(client.id);
            fetchData();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  const handleRegisterPush = async (clientId: number) => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert('Permissions Denied', 'Enable notifications in device settings');
      return;
    }
    const token = await getDevicePushToken();
    if (!token) {
      Alert.alert('Error', 'Could not get push token');
      return;
    }
    try {
      const api = getApiClient();
      await api.registerFcmToken(clientId, token);
      setPushStatus(`Registered (${token.substring(0, 20)}...)`);
      Alert.alert('Success', 'Push notifications registered');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to register');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-surface-card border-b border-slate-100 dark:border-slate-700">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#94a3b8" />
          </Pressable>
          <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">Client Tokens</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        </Pressable>
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View className="px-4 pt-4 gap-2 mb-2">
            {/* FCM Status */}
            <View className="bg-white dark:bg-surface-card rounded-xl p-1">
              <View className="flex-row items-start gap-3 p-3">
                <Ionicons name="notifications-outline" size={20} color="#94a3b8" />
                <View className="flex-1">
                  <Text className="text-sm text-slate-900 dark:text-slate-100">FCM Token Status</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{pushStatus}</Text>
                </View>
              </View>
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1 mt-2">
              Tokens ({clients.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mx-4 mb-2 bg-white dark:bg-surface-card rounded-xl overflow-hidden">
            <View className="flex-row items-center gap-3 p-3">
              <Ionicons name="key-outline" size={20} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-900 dark:text-slate-100">{item.name}</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.token}</Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable onPress={() => handleRegisterPush(item.id)} hitSlop={8}>
                  <Ionicons name="notifications-outline" size={16} color="#3b82f6" />
                </Pressable>
                <Pressable onPress={() => handleDeleteClient(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon="key-outline" title="No client tokens" subtitle="Create a token to authenticate API clients" />
          )
        }
        contentContainerStyle={clients.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      {/* Create Token Modal */}
      <Modal visible={showCreate} animationType="fade" transparent>
        <Pressable className="flex-1 bg-black/40 justify-center px-6" onPress={() => setShowCreate(false)}>
          <Pressable onPress={() => {}}>
            <View className="bg-white dark:bg-surface-card rounded-2xl p-6 gap-3">
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">New Client Token</Text>
              <TextInput
                className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
                placeholder="Token name"
                placeholderTextColor="#9ca3af"
                value={newTokenName}
                onChangeText={setNewTokenName}
                autoCapitalize="none"
              />
              <View className="flex-row gap-3 mt-1">
                <AnimatedPressable
                  className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
                  onPress={() => { setShowCreate(false); setNewTokenName(''); }}
                >
                  <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  className="flex-1 p-3.5 rounded-lg bg-primary items-center"
                  onPress={handleCreateToken}
                >
                  <Text className="font-semibold text-white">Create</Text>
                </AnimatedPressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
