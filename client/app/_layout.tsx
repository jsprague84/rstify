import React, { useEffect } from "react";
import { Linking } from "react-native";
import { Stack, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../src/store/auth";
import { useThemeStore, useTheme } from "../src/store/theme";
import {
  initializeNotifications,
  requestNotificationPermissions,
} from "../src/services/notifications";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const initializeAuth = useAuthStore((s) => s.initialize);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);
  const initializeTheme = useThemeStore((s) => s.initialize);
  const { isDark } = useTheme();

  useEffect(() => {
    Promise.all([initializeAuth(), initializeTheme()]);
    initializeNotifications().then(() => requestNotificationPermissions());
  }, [initializeAuth, initializeTheme]);

  // Open click_url when user taps a notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.clickUrl;
        if (typeof url === "string" && url) {
          Linking.openURL(url);
        }
      },
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isLoadingAuth) {
      SplashScreen.hide();
    }
  }, [isLoadingAuth]);

  return (
    <KeyboardProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
      <Toast />
    </KeyboardProvider>
  );
}
