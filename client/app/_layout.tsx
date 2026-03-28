import '../global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Linking } from 'react-native';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/store';
import { useMessagesStore } from '../src/store';
import { useTheme } from '../src/store/theme';
import { migrateToMmkv } from '../src/storage/migration';
import {
  initializeNotifications,
  requestNotificationPermissions,
} from '../src/services/notifications';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="thread/[sourceId]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [migrating, setMigrating] = useState(true);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);
  const loadFromCache = useMessagesStore((s) => s.loadFromCache);
  const { isDark } = useTheme();

  // Step 1: Run MMKV migration, load cache, then init auth
  useEffect(() => {
    async function bootstrap() {
      // Migrate from SecureStore/AsyncStorage to MMKV
      await migrateToMmkv();

      // Hydrate messages from MMKV cache (synchronous)
      loadFromCache();

      // Initialize auth (validates token against server)
      await initializeAuth();

      setMigrating(false);
    }

    bootstrap();
  }, [initializeAuth, loadFromCache]);

  // Step 2: Set up notifications (fire-and-forget, non-blocking)
  useEffect(() => {
    initializeNotifications().then(() => requestNotificationPermissions());
  }, []);

  // Step 3: Open click_url when user taps a notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.clickUrl;
        if (typeof url === 'string' && url) {
          Linking.openURL(url);
        }
      },
    );
    return () => sub.remove();
  }, []);

  // Hide splash once migration is done and auth has resolved
  useEffect(() => {
    if (!migrating && !isLoadingAuth) {
      SplashScreen.hide();
    }
  }, [migrating, isLoadingAuth]);

  // Show spinner while migration is running
  if (migrating) {
    return (
      <GestureHandlerRootView className="flex-1">
        <View className="flex-1 items-center justify-center bg-slate-950">
          <ActivityIndicator size="large" color="#60a5fa" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <Toast />
    </GestureHandlerRootView>
  );
}
