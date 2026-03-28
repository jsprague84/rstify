import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChannelRow } from "./ChannelRow";
import type { Topic } from "../../api/types";

interface FolderSectionProps {
  title: string;
  icon: string;
  color: string;
  topics: Topic[];
  collapsed?: boolean;
  onToggle?: () => void;
  count?: number;
}

export const FolderSection = React.memo(function FolderSection({
  title,
  icon,
  color,
  topics,
  collapsed = false,
  onToggle,
  count,
}: FolderSectionProps) {
  if (topics.length === 0) return null;

  const displayCount = count ?? topics.length;

  return (
    <View className="mb-2">
      {/* Section header */}
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-2"
        hitSlop={4}
      >
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 16 }}>{icon}</Text>
          <Text
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color }}
          >
            {title}
          </Text>
          <View
            className="rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: `${color}20` }}
          >
            <Text className="text-xs font-medium" style={{ color }}>
              {displayCount}
            </Text>
          </View>
        </View>

        {onToggle ? (
          <Ionicons
            name={collapsed ? "chevron-forward" : "chevron-down"}
            size={16}
            color="#94a3b8"
          />
        ) : null}
      </Pressable>

      {/* Topic rows */}
      {!collapsed && (
        <View className="mt-1">
          {topics.map((topic) => (
            <ChannelRow key={topic.id} topic={topic} />
          ))}
        </View>
      )}
    </View>
  );
});
