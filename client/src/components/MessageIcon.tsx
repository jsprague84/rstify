import React, { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { useApplicationsStore } from "../store";

interface MessageIconProps {
  appId?: number;
  iconUrl?: string | null;
  size?: number;
  name?: string;
}

export const MessageIcon = React.memo(function MessageIcon({
  appId,
  iconUrl,
  size = 40,
  name,
}: MessageIconProps) {
  const [error, setError] = useState(false);
  const getIconUrl = useApplicationsStore((s) => s.getIconUrl);

  // Resolve icon URL: explicit iconUrl takes priority, then derive from appId
  const resolvedUrl = iconUrl ?? (appId ? getIconUrl(appId) : null);

  if (resolvedUrl && !error) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={{ width: size, height: size, borderRadius: 8 }}
        contentFit="contain"
        transition={200}
        onError={() => setError(true)}
        cachePolicy="memory-disk"
        priority="normal"
      />
    );
  }

  // Fallback: colored circle with first letter of name
  const letter = name ? name.charAt(0).toUpperCase() : null;

  return (
    <View
      className="rounded-md bg-primary/20 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {letter ? (
        <Text
          className="text-primary font-bold"
          style={{ fontSize: size * 0.4 }}
        >
          {letter}
        </Text>
      ) : null}
    </View>
  );
});
