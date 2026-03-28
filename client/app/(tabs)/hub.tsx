import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useApplicationsStore } from '../../src/store';
import { useTheme } from '../../src/store/theme';
import { useThemeStore } from '../../src/store/theme';
import { useMessagesStore } from '../../src/store';
import { IntegrationTile } from '../../src/components/hub/IntegrationTile';
import { SettingsRow } from '../../src/components/hub/SettingsRow';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';

const APP_VERSION = '2.0.0';

export default function HubScreen() {
  const { mode } = useTheme();
  const setMode = useThemeStore((s) => s.setMode);
  const user = useAuthStore((s) => s.user);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const logout = useAuthStore((s) => s.logout);
  const clearMessages = useMessagesStore((s) => s.clear);
  const appsCount = useApplicationsStore((s) => s.apps.size);

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(mode);
    setMode(order[(idx + 1) % order.length]);
  };

  const themeLabel = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          clearMessages();
          logout();
        },
      },
    ]);
  };

  const initial = user?.username?.charAt(0).toUpperCase() ?? '?';
  const role = user?.is_admin ? 'Admin' : 'User';

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-10 gap-6">
        {/* User Header */}
        <View className="flex-row items-center gap-3 px-1">
          <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
            <Text className="text-white text-lg font-bold">{initial}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {user?.username ?? 'Unknown'}
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              {role} &middot; {serverUrl}
            </Text>
          </View>
        </View>

        {/* Integrations */}
        <View className="gap-2">
          <SectionLabel>Integrations</SectionLabel>
          <View className="flex-row gap-3">
            <IntegrationTile
              icon="📱"
              title="Apps"
              subtitle={`${appsCount} app${appsCount !== 1 ? 's' : ''}`}
              href="/hub/apps"
            />
            <IntegrationTile
              icon="🔗"
              title="Webhooks"
              subtitle="Automations"
              href="/hub/webhooks"
            />
          </View>
          <View className="flex-row gap-3">
            <IntegrationTile
              icon="🔌"
              title="MQTT"
              subtitle="Bridges"
              href="/hub/mqtt"
            />
            <IntegrationTile
              icon="🔑"
              title="Clients"
              subtitle="API tokens"
              href="/hub/clients"
            />
          </View>
        </View>

        {/* Account */}
        <View className="gap-2">
          <SectionLabel>Account</SectionLabel>
          <View className="gap-1.5">
            <SettingsRow title="Change Password" href="/hub/settings" />
            <SettingsRow title="Notifications" href="/hub/settings" />
            <SettingsRow title="Appearance" value={themeLabel} onPress={cycleTheme} />
          </View>
        </View>

        {/* Admin */}
        {user?.is_admin ? (
          <View className="gap-2">
            <SectionLabel>Admin</SectionLabel>
            <View className="gap-1.5">
              <SettingsRow title="User Management" href="/hub/users" />
              <SettingsRow title="Server Info" href="/hub/settings" />
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View className="items-center gap-4 mt-4">
          <Text className="text-xs text-slate-400 dark:text-slate-500">
            rstify v{APP_VERSION}
          </Text>
          <AnimatedPressable
            className="flex-row items-center justify-center gap-2 px-6 py-3 rounded-xl border border-error-light/40 dark:border-error/30 bg-white dark:bg-surface-card"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text className="text-error font-semibold text-base">Logout</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
