import '../global.css';
import '../src/theme/defaultFont';
import React, { useEffect, useState } from 'react';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { ActivityIndicator, View, Linking } from 'react-native';
import { Stack, SplashScreen, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
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
        <Stack.Screen name="hub/apps" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="hub/webhooks" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="hub/settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="hub/server" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="hub/users" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="hub/clients" options={{ headerShown: false, animation: 'slide_from_right' }} />
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
  const { isDark, mode, activeTheme } = useTheme();
  const { setColorScheme } = useNativeWindColorScheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Sync NativeWind's dark mode with our theme store
  useEffect(() => {
    setColorScheme(mode === "system" ? "system" : activeTheme);
  }, [mode, activeTheme, setColorScheme]);

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

  // Step 3: Notification tap → click_url if the message has one, otherwise
  // open the thread the message belongs to (topic:<name> / app:<id>). The
  // target is queued so a cold-start tap navigates once auth has resolved.
  const [pendingThread, setPendingThread] = useState<string | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};
      const url = data.clickUrl;
      if (typeof url === 'string' && url) {
        Linking.openURL(url);
        return;
      }
      const sourceId =
        typeof data.topic === 'string' && data.topic
          ? `topic:${data.topic}`
          : data.appid != null && data.appid !== ''
            ? `app:${data.appid}`
            : null;
      if (sourceId) setPendingThread(sourceId);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    // Cold start: the tap that launched the app fired before the listener existed.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (pendingThread && !migrating && !isLoadingAuth && isAuthenticated) {
      router.push(`/thread/${encodeURIComponent(pendingThread)}`);
      setPendingThread(null);
    }
  }, [pendingThread, migrating, isLoadingAuth, isAuthenticated]);

  // Hide splash once migration is done and auth has resolved
  useEffect(() => {
    if (!migrating && !isLoadingAuth && fontsLoaded) {
      SplashScreen.hide();
    }
  }, [migrating, isLoadingAuth, fontsLoaded]);

  // Show spinner while migration is running or fonts are loading
  if (migrating || !fontsLoaded) {
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
