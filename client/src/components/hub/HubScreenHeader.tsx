import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface HubScreenHeaderProps {
  title: string;
  onAdd?: () => void;
}

export function HubScreenHeader({ title, onAdd }: HubScreenHeaderProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-surface-card border-b border-slate-100 dark:border-slate-700">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#94a3b8" />
        </Pressable>
        <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </Text>
      </View>
      {onAdd ? (
        <Pressable onPress={onAdd} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
        </Pressable>
      ) : null}
    </View>
  );
}
