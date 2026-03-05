import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

interface MessageIconProps {
  iconUrl?: string | null;
  size?: number;
}

export const MessageIcon = React.memo(function MessageIcon({ iconUrl, size = 40 }: MessageIconProps) {
  const [error, setError] = useState(false);

  if (!iconUrl || error) {
    return (
      <View style={[styles.iconContainer, { width: size, height: size }]}>
        <Ionicons name="notifications" size={size * 0.6} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: iconUrl }}
      style={[styles.icon, { width: size, height: size }]}
      contentFit="cover"
      transition={200}
      onError={() => setError(true)}
      cachePolicy="memory-disk"
      priority="normal"
    />
  );
});

const styles = StyleSheet.create({
  icon: {
    borderRadius: 8,
  },
  iconContainer: {
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
