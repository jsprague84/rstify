import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AnimatedPressable } from "../src/components/design/AnimatedPressable";
import { useAuthStore } from "../src/store/auth";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(
    useAuthStore.getState().serverUrl,
  );
  const [showServer, setShowServer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const login = useAuthStore((s) => s.login);
  const setServerUrlStore = useAuthStore((s) => s.setServerUrl);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (serverUrl !== useAuthStore.getState().serverUrl) {
        await setServerUrlStore(serverUrl);
      }
      await login(username.trim(), password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not connect to server";
      setError(msg);
      Alert.alert("Login Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-surface-bg">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / branding */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(500)}
          className="items-center mb-10"
        >
          <Ionicons name="notifications" size={56} color="#2563eb" />
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mt-2">
            rstify
          </Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Push Notifications
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(500)}
          className="gap-3"
        >
          {/* Username */}
          <TextInput
            className="bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-white"
            placeholder="Username"
            placeholderTextColor="#94a3b8"
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
            accessibilityLabel="Username"
            accessibilityRole="none"
          />

          {/* Password */}
          <TextInput
            ref={passwordRef}
            className="bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-white"
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password"
            accessibilityRole="none"
          />

          {/* Error message */}
          {error ? (
            <Animated.View
              entering={FadeInDown.duration(250)}
              className="flex-row items-center gap-1.5 px-1"
            >
              <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
              <Text className="text-sm text-red-500 dark:text-red-400 flex-1">
                {error}
              </Text>
            </Animated.View>
          ) : null}

          {/* Sign In button */}
          <AnimatedPressable
            className="bg-primary rounded-xl py-4 items-center justify-center mt-1"
            style={isSubmitting ? { opacity: 0.6 } : undefined}
            onPress={handleLogin}
            disabled={isSubmitting}
            haptic
            accessibilityLabel="Sign in"
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">
                Sign In
              </Text>
            )}
          </AnimatedPressable>

          {/* Server settings toggle */}
          <AnimatedPressable
            className="flex-row items-center justify-center gap-1.5 py-2"
            onPress={() => setShowServer((v) => !v)}
            haptic={false}
            accessibilityLabel="Toggle server settings"
            accessibilityRole="button"
          >
            <Ionicons
              name={showServer ? "chevron-up-outline" : "server-outline"}
              size={14}
              color="#9ca3af"
            />
            <Text className="text-sm text-slate-400 dark:text-slate-500">
              Server Settings
            </Text>
          </AnimatedPressable>

          {/* Server URL input (expandable) */}
          {showServer ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <TextInput
                className="bg-white dark:bg-surface-card border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-white"
                placeholder="Server URL (e.g. http://192.168.1.100:8080)"
                placeholderTextColor="#94a3b8"
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Server URL"
                accessibilityRole="none"
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
