import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../store/theme";
import { Colors } from "../theme/colors";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export const EmptyState = React.memo(function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textTertiary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
