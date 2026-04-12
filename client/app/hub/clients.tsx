import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { ConfirmSheet } from '../../src/components/design/ConfirmSheet';
import { EmptyState } from '../../src/components/EmptyState';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { FormModal } from '../../src/components/design/FormModal';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { useHubData } from '../../src/hooks/useHubData';
import { getApiClient } from '../../src/api';
import type { Client } from '../../src/api';
import {
  getDevicePushToken,
  requestNotificationPermissions,
} from '../../src/services/notifications';

export default function ClientsScreen() {
  const [pushStatus, setPushStatus] = useState<string>('Checking...');

  // Create token form
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const fetchClients = useCallback(() => {
    const api = getApiClient();
    return api.listClients();
  }, []);
  const { items: clients, isLoading, refresh, mutate } = useHubData(fetchClients);

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

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;
    const api = getApiClient();
    const ok = await mutate(() => api.createClient({ name: newTokenName.trim(), scopes: null }));
    if (ok) {
      setNewTokenName('');
      setShowCreate(false);
    }
  };

  const handleDeleteClient = (client: Client) => setDeleteTarget(client);

  const confirmDeleteClient = async () => {
    if (!deleteTarget) return;
    const api = getApiClient();
    const ok = await mutate(() => api.deleteClient(deleteTarget.id));
    if (ok) setDeleteTarget(null);
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
      <HubScreenHeader title="Client Tokens" onAdd={() => setShowCreate(true)} />

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
            <SectionLabel>Tokens ({clients.length})</SectionLabel>
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
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon="key-outline" title="No client tokens" subtitle="Create a token to authenticate API clients" />
          )
        }
        contentContainerStyle={clients.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
      />

      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteClient}
        title="Delete Token"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />

      {/* Create Token Modal */}
      <FormModal visible={showCreate} onClose={() => setShowCreate(false)} title="New Client Token">
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
      </FormModal>
    </SafeAreaView>
  );
}
