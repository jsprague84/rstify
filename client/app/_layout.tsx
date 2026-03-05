import React, { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../src/store/auth";
import { useThemeStore, useTheme } from "../src/store/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
  }, [initializeAuth, initializeTheme]);

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
