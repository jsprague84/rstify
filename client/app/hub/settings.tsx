import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { SectionLabel } from '../../src/components/design/SectionLabel';
import { useAuthStore } from '../../src/store/auth';
import { useThemeStore, useTheme } from '../../src/store/theme';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { getApiClient } from '../../src/api';
import {
  getDevicePushToken,
  requestNotificationPermissions,
} from '../../src/services/notifications';

export default function SettingsScreen() {
  const { mode } = useTheme();
  const setMode = useThemeStore((s) => s.setMode);

  const user = useAuthStore((s) => s.user);

  const [pushStatus, setPushStatus] = useState<string>('Checking...');

  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getDevicePushToken();
      if (token) {
        setPushStatus(`Registered (${token.substring(0, 20)}...)`);
      } else {
        setPushStatus('Not available -- enable in device settings');
      }
    })();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    try {
      const api = getApiClient();
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to change password');
    }
  };

  const themeOptions: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = [
    { value: 'light', label: 'Light Mode', icon: 'sunny', description: 'Bright and clean interface' },
    { value: 'dark', label: 'Dark Mode', icon: 'moon', description: 'Easy on the eyes in low light' },
    { value: 'system', label: 'System', icon: 'phone-portrait', description: 'Match device theme automatically' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <HubScreenHeader title="Settings" />

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="p-4 pb-10 gap-6"
      >
        {/* Appearance */}
        <View className="gap-2">
          <SectionLabel>Appearance</SectionLabel>
          <View className="bg-white dark:bg-surface-card rounded-xl overflow-hidden">
            {themeOptions.map((opt) => (
              <Pressable
                key={opt.value}
                className={`flex-row items-center gap-3 p-3 ${mode === opt.value ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                onPress={() => setMode(opt.value)}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={mode === opt.value ? '#3b82f6' : '#94a3b8'}
                />
                <View className="flex-1">
                  <Text className="text-base font-medium text-slate-900 dark:text-slate-100">{opt.label}</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.description}</Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${mode === opt.value ? 'border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                  {mode === opt.value && <View className="w-3 h-3 rounded-full bg-primary" />}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Account Info */}
        <View className="gap-2">
          <SectionLabel>Account</SectionLabel>
          <View className="bg-white dark:bg-surface-card rounded-xl p-1 gap-1">
            <View className="flex-row items-start gap-3 p-3">
              <Ionicons name="person-outline" size={20} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-sm text-slate-500 dark:text-slate-400">Username</Text>
                <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{user?.username}</Text>
              </View>
            </View>
            {user?.email ? (
              <View className="flex-row items-start gap-3 p-3">
                <Ionicons name="mail-outline" size={20} color="#94a3b8" />
                <View className="flex-1">
                  <Text className="text-sm text-slate-500 dark:text-slate-400">Email</Text>
                  <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">{user.email}</Text>
                </View>
              </View>
            ) : null}
            <View className="flex-row items-start gap-3 p-3">
              <Ionicons name="shield-outline" size={20} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-sm text-slate-500 dark:text-slate-400">Role</Text>
                <Text className="text-base text-slate-900 dark:text-slate-100 mt-0.5">
                  {user?.is_admin ? 'Administrator' : 'User'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Change Password */}
        <View className="gap-2">
          <Pressable className="flex-row justify-between items-center px-1" onPress={() => setShowPassword(!showPassword)}>
            <SectionLabel>Change Password</SectionLabel>
            <Ionicons name={showPassword ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
          </Pressable>
          {showPassword && (
            <View className="bg-white dark:bg-surface-card rounded-xl p-4 gap-3">
              <TextInput
                className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
                placeholder="Current password"
                placeholderTextColor="#9ca3af"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
                placeholder="New password (min 8 chars)"
                placeholderTextColor="#9ca3af"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
                placeholder="Confirm new password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <AnimatedPressable
                className="bg-primary rounded-lg p-3 items-center"
                onPress={handleChangePassword}
              >
                <Text className="text-white font-semibold">Update Password</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {/* Push Notifications */}
        <View className="gap-2">
          <SectionLabel>Push Notifications</SectionLabel>
          <View className="bg-white dark:bg-surface-card rounded-xl p-1 gap-1">
            <View className="flex-row items-start gap-3 p-3">
              <Ionicons name="notifications-outline" size={20} color="#94a3b8" />
              <View className="flex-1">
                <Text className="text-sm text-slate-900 dark:text-slate-100">FCM Status</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{pushStatus}</Text>
              </View>
            </View>
            <Pressable
              className="flex-row items-center gap-3 p-3"
              onPress={async () => {
                const granted = await requestNotificationPermissions();
                if (granted) {
                  const token = await getDevicePushToken();
                  if (token) {
                    setPushStatus(`Registered (${token.substring(0, 20)}...)`);
                    try {
                      const api = getApiClient();
                      const clientsList = await api.listClients();
                      if (clientsList.length > 0) {
                        await api.registerFcmToken(clientsList[0].id, token);
                        Alert.alert('Success', 'Push notifications registered');
                      }
                    } catch { /* best effort */ }
                  }
                } else {
                  Alert.alert('Permissions Denied', 'Enable notifications in device settings');
                }
              }}
            >
              <Ionicons name="refresh-outline" size={20} color="#3b82f6" />
              <Text className="text-base text-primary font-medium">Re-register Push Token</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
