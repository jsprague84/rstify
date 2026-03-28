import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  RefreshControl,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../src/components/EmptyState';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { FormModal } from '../../src/components/design/FormModal';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { getApiClient } from '../../src/api';
import type { Application } from '../../src/api';
import * as Clipboard from 'expo-clipboard';
import { useApplicationsStore } from '../../src/store';

function AppIconView({ app }: { app: Application }) {
  const api = getApiClient();
  if (!app.image) {
    return (
      <View className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 items-center justify-center mr-3">
        <Text className="text-base font-bold text-slate-400 dark:text-slate-500">
          {app.name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `${api.applicationIconUrl(app.id)}?v=${app.updated_at}` }}
      style={{ width: 36, height: 36, borderRadius: 8, marginRight: 12 }}
      contentFit="contain"
    />
  );
}

export default function AppsScreen() {
  const [apps, setApps] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppDesc, setNewAppDesc] = useState('');
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('5');

  const { fetchApplications } = useApplicationsStore();

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = getApiClient();
      const result = await api.listApplications();
      setApps(result);
      fetchApplications();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load apps');
    } finally {
      setIsLoading(false);
    }
  }, [fetchApplications]);

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
      setNewAppName('');
      setNewAppDesc('');
      setShowCreate(false);
      fetchApps();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create app');
    }
  };

  const handleCopyToken = async (token: string) => {
    try {
      await Clipboard.setStringAsync(token);
      Alert.alert('Copied', 'App token copied to clipboard');
    } catch {
      Alert.alert('Token', token);
    }
  };

  const openEditApp = (app: Application) => {
    setEditApp(app);
    setEditName(app.name);
    setEditDesc(app.description || '');
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDeleteApp = (app: Application) => {
    Alert.alert('Delete Application', `Delete "${app.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const api = getApiClient();
            await api.deleteApplication(app.id);
            fetchApps();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <HubScreenHeader title="Applications" onAdd={() => setShowCreate(true)} />

      <FlatList
        data={apps}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between px-4 py-4 bg-white dark:bg-surface-card border-b border-slate-100 dark:border-slate-700">
            <AppIconView app={item} />
            <View className="flex-1 mr-3">
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {item.name}
              </Text>
              {item.description ? (
                <Text className="text-sm text-slate-500 dark:text-slate-400 mt-0.5" numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
              <Pressable
                className="flex-row items-center gap-1 mt-1"
                onPress={() => handleCopyToken(item.token)}
              >
                <Text className="text-xs text-slate-400 dark:text-slate-500 font-mono" numberOfLines={1}>
                  {item.token}
                </Text>
                <Ionicons name="copy-outline" size={12} color="#94a3b8" />
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              <Pressable onPress={() => openEditApp(item)} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color="#3b82f6" />
              </Pressable>
              <Pressable onPress={() => handleDeleteApp(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
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
        contentContainerStyle={apps.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Create Modal */}
      <FormModal visible={showCreate} onClose={() => setShowCreate(false)} title="Create Application">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Application name"
          placeholderTextColor="#9ca3af"
          value={newAppName}
          onChangeText={setNewAppName}
          returnKeyType="next"
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Description (optional)"
          placeholderTextColor="#9ca3af"
          value={newAppDesc}
          onChangeText={setNewAppDesc}
          returnKeyType="done"
          onSubmitEditing={handleCreateApp}
        />
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setShowCreate(false)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleCreateApp}
          >
            <Text className="font-semibold text-white">Create</Text>
          </AnimatedPressable>
        </View>
      </FormModal>

      {/* Edit Modal */}
      <FormModal visible={!!editApp} onClose={() => setEditApp(null)} title="Edit Application">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Name"
          placeholderTextColor="#9ca3af"
          value={editName}
          onChangeText={setEditName}
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Description (optional)"
          placeholderTextColor="#9ca3af"
          value={editDesc}
          onChangeText={setEditDesc}
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Default Priority (1-10)"
          placeholderTextColor="#9ca3af"
          value={editPriority}
          onChangeText={setEditPriority}
          keyboardType="numeric"
        />
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setEditApp(null)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleEditApp}
          >
            <Text className="font-semibold text-white">Save</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
    </SafeAreaView>
  );
}
