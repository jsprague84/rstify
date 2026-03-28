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
import { useAuthStore } from '../../src/store/auth';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { getApiClient } from '../../src/api';
import type { StatsResponse, VersionResponse } from '../../src/api';

export default function ServerScreen() {
  const user = useAuthStore((s) => s.user);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const setServerUrl = useAuthStore((s) => s.setServerUrl);
  const logout = useAuthStore((s) => s.logout);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(serverUrl);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const [s, v] = await Promise.allSettled([
        api.getStats(),
        api.version(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (v.status === 'fulfilled') setVersion(v.value);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (user?.is_admin) fetchData(); }, [fetchData, user?.is_admin]);

  const handleSaveUrl = async () => {
    try {
      setServerUrl(urlInput);
      setEditingUrl(false);
      logout();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
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
      <HubScreenHeader title="Server Info" />

      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View className="p-4 gap-6">
            {/* Server Stats */}
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

            {/* Server */}
            <View className="gap-2">
              <SectionLabel>Server</SectionLabel>
              <View className="bg-white dark:bg-surface-card rounded-xl p-1 gap-1">
                <View className="flex-row items-start gap-3 p-3">
                  <Ionicons name="server-outline" size={20} color="#94a3b8" />
                  <View className="flex-1">
                    <Text className="text-sm text-slate-500 dark:text-slate-400">Server URL</Text>
                    {editingUrl ? (
                      <View className="flex-row gap-2 mt-1">
                        <TextInput
                          className="flex-1 bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100"
                          value={urlInput}
                          onChangeText={setUrlInput}
                          autoCapitalize="none"
                          keyboardType="url"
                          placeholderTextColor="#9ca3af"
                        />
                        <AnimatedPressable className="bg-primary rounded-lg px-4 justify-center" onPress={handleSaveUrl}>
                          <Text className="text-white font-semibold text-sm">Save</Text>
                        </AnimatedPressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => setEditingUrl(true)}>
                        <Text className="text-base text-primary underline mt-0.5">{serverUrl}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {version ? (
                  <View className="flex-row items-start gap-3 p-3">
                    <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                    <View className="flex-1">
                      <Text className="text-sm text-slate-500 dark:text-slate-400">Server Version</Text>
                      <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{version.version}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchData} />}
      />
    </SafeAreaView>
  );
}
