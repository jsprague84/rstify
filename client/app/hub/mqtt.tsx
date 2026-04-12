import React, { useState, useCallback } from 'react';
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
import { useAuthStore } from '../../src/store/auth';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { ConfirmSheet } from '../../src/components/design/ConfirmSheet';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { FormModal } from '../../src/components/design/FormModal';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { useHubData } from '../../src/hooks/useHubData';
import { getApiClient } from '../../src/api';
import type { MqttBridge, MqttStatusResponse } from '../../src/api';

export default function MqttScreen() {
  const user = useAuthStore((s) => s.user);

  const [mqttStatus, setMqttStatus] = useState<MqttStatusResponse | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<MqttBridge | null>(null);

  // Create bridge form
  const [showCreate, setShowCreate] = useState(false);
  const [newBridgeName, setNewBridgeName] = useState('');
  const [newBridgeUrl, setNewBridgeUrl] = useState('');
  const [newBridgeUsername, setNewBridgeUsername] = useState('');
  const [newBridgePassword, setNewBridgePassword] = useState('');

  const fetchBridges = useCallback(async () => {
    if (!user?.is_admin) return [];
    const api = getApiClient();
    // Fetch MQTT status as a side-effect alongside the bridges list
    api.getMqttStatus().then(setMqttStatus).catch(() => {});
    return api.listBridges();
  }, [user?.is_admin]);
  const { items: bridges, isLoading, refresh, mutate } = useHubData(fetchBridges);

  const handleDeleteBridge = (b: MqttBridge) => setDeleteTarget(b);

  const confirmDeleteBridge = async () => {
    if (!deleteTarget) return;
    const api = getApiClient();
    const ok = await mutate(() => api.deleteBridge(deleteTarget.id));
    if (ok) setDeleteTarget(null);
  };

  const handleCreateBridge = async () => {
    if (!newBridgeName.trim() || !newBridgeUrl.trim()) {
      Alert.alert('Error', 'Name and URL are required');
      return;
    }
    const api = getApiClient();
    const ok = await mutate(() =>
      api.createBridge({
        name: newBridgeName.trim(),
        remote_url: newBridgeUrl.trim(),
        subscribe_topics: ['#'],
        publish_topics: [],
        username: newBridgeUsername || null,
        password: newBridgePassword || null,
        qos: null,
        topic_prefix: null,
        auto_create_topics: null,
      }),
    );
    if (ok) {
      setNewBridgeName(''); setNewBridgeUrl('');
      setNewBridgeUsername(''); setNewBridgePassword('');
      setShowCreate(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg items-center justify-center" edges={['top']}>
        <Text className="text-slate-500">Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <HubScreenHeader title="MQTT" onAdd={() => setShowCreate(true)} />

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View className="p-4 gap-6">
            {/* Broker Status */}
            {mqttStatus && (
              <View className="gap-2">
                <SectionLabel>MQTT Broker</SectionLabel>
                <View className="bg-white dark:bg-surface-card rounded-xl p-1 gap-1">
                  <View className="flex-row items-start gap-3 p-3">
                    <Ionicons
                      name="radio-outline"
                      size={20}
                      color={mqttStatus.enabled ? '#22c55e' : '#94a3b8'}
                    />
                    <View className="flex-1">
                      <Text className="text-sm text-slate-900 dark:text-slate-100">Status</Text>
                      <Text className={`text-base mt-0.5 ${mqttStatus.enabled ? 'text-green-500' : 'text-slate-500 dark:text-slate-400'}`}>
                        {mqttStatus.enabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </View>
                  </View>
                  {!mqttStatus.enabled && (
                    <View className="flex-row items-start gap-3 p-3 py-1">
                      <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                      <Text className="text-xs text-slate-400 dark:text-slate-500 flex-1">
                        Set MQTT_ENABLED=true to activate
                      </Text>
                    </View>
                  )}
                  {mqttStatus.listen_addr && (
                    <View className="flex-row items-start gap-3 p-3">
                      <Ionicons name="link-outline" size={20} color="#94a3b8" />
                      <View className="flex-1">
                        <Text className="text-sm text-slate-500 dark:text-slate-400">TCP</Text>
                        <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{mqttStatus.listen_addr}</Text>
                      </View>
                    </View>
                  )}
                  {mqttStatus.ws_listen_addr && (
                    <View className="flex-row items-start gap-3 p-3">
                      <Ionicons name="globe-outline" size={20} color="#94a3b8" />
                      <View className="flex-1">
                        <Text className="text-sm text-slate-500 dark:text-slate-400">WebSocket</Text>
                        <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{mqttStatus.ws_listen_addr}</Text>
                      </View>
                    </View>
                  )}
                  <View className="flex-row items-start gap-3 p-3">
                    <Ionicons name="git-branch-outline" size={20} color="#94a3b8" />
                    <View className="flex-1">
                      <Text className="text-sm text-slate-500 dark:text-slate-400">Active Bridges</Text>
                      <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{mqttStatus.bridges_active}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Bridges */}
            <View className="gap-2">
              <SectionLabel>MQTT Bridges ({bridges.length})</SectionLabel>
              <View className="bg-white dark:bg-surface-card rounded-xl overflow-hidden">
                {bridges.map((b) => {
                  const subCount = (() => { try { return JSON.parse(b.subscribe_topics).length; } catch { return 0; } })();
                  const pubCount = (() => { try { return (b.publish_topics ? JSON.parse(b.publish_topics).length : 0); } catch { return 0; } })();
                  const isConnected = mqttStatus?.bridges?.find((s) => s.id === b.id)?.connected;
                  const statusColor = !b.enabled ? 'bg-gray-400' : isConnected ? 'bg-green-500' : 'bg-red-500';

                  return (
                    <Pressable
                      key={b.id}
                      className="flex-row items-center gap-2 p-3"
                      onLongPress={() => handleDeleteBridge(b)}
                    >
                      <View className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{b.name}</Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.remote_url}</Text>
                        <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                          Sub: {subCount} &middot; Pub: {pubCount} &middot; QoS {b.qos ?? 0}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {bridges.length === 0 && (
                  <Text className="p-3 text-slate-400 dark:text-slate-500 text-sm">No MQTT bridges</Text>
                )}
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      />

      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteBridge}
        title="Delete Bridge"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />

      {/* Create Bridge Modal */}
      <FormModal visible={showCreate} onClose={() => setShowCreate(false)} title="New MQTT Bridge">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Bridge name"
          placeholderTextColor="#9ca3af"
          value={newBridgeName}
          onChangeText={setNewBridgeName}
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Broker URL (host:port)"
          placeholderTextColor="#9ca3af"
          value={newBridgeUrl}
          onChangeText={setNewBridgeUrl}
          autoCapitalize="none"
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Username (optional)"
          placeholderTextColor="#9ca3af"
          value={newBridgeUsername}
          onChangeText={setNewBridgeUsername}
          autoCapitalize="none"
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Password (optional)"
          placeholderTextColor="#9ca3af"
          value={newBridgePassword}
          onChangeText={setNewBridgePassword}
          secureTextEntry
        />
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => { setShowCreate(false); setNewBridgeName(''); setNewBridgeUrl(''); }}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleCreateBridge}
          >
            <Text className="font-semibold text-white">Create</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}
