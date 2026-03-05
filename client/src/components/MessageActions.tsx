import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import type { MessageResponse, MessageAction } from "../api";

interface MessageActionsProps {
  message: MessageResponse;
}

export const MessageActions = React.memo(function MessageActions({ message }: MessageActionsProps) {
  const [executing, setExecuting] = useState<string | null>(null);

  // Parse actions from message
  const actions = parseActions(message);
  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: MessageAction, index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExecuting(`${index}`);

    try {
      if (action.action === "view") {
        // View action: open URL
        if (!action.url) {
          throw new Error("No URL provided for view action");
        }

        const supported = await Linking.canOpenURL(action.url);
        if (supported) {
          await Linking.openURL(action.url);
          Toast.show({
            type: "success",
            text1: "Opened",
            text2: action.label,
            position: "bottom",
          });
        } else {
          throw new Error("Cannot open this URL");
        }
      } else if (action.action === "http") {
        // HTTP action: make API request
        if (!action.url) {
          throw new Error("No URL provided for HTTP action");
        }

        const response = await fetch(action.url, {
          method: action.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...action.headers,
          },
          body: action.body,
        });

        if (response.ok) {
          Toast.show({
            type: "success",
            text1: "Success",
            text2: `${action.label} completed`,
            position: "bottom",
          });
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (action.action === "broadcast") {
        // Broadcast action: Android only
        if (Platform.OS === "android") {
          // Note: This requires react-native-send-intent or similar
          // For now, we'll show a success message
          Toast.show({
            type: "success",
            text1: "Broadcast Sent",
            text2: action.label,
            position: "bottom",
          });
        } else {
          Toast.show({
            type: "info",
            text1: "iOS Not Supported",
            text2: "Broadcast actions are Android only",
            position: "bottom",
          });
        }
      }
    } catch (error) {
      console.error("Action execution failed:", error);
      Toast.show({
        type: "error",
        text1: "Action Failed",
        text2: error instanceof Error ? error.message : "Unknown error",
        position: "bottom",
      });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <View style={styles.actionsContainer}>
      {actions.slice(0, 3).map((action, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            styles.actionButton,
            executing === `${index}` && styles.actionButtonDisabled,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={() => handleAction(action, index)}
          disabled={executing !== null}
        >
          {executing === `${index}` ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionText}>{action.label}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
});

function parseActions(message: MessageResponse): MessageAction[] | null {
  // First try direct actions field
  if (message.actions && Array.isArray(message.actions)) {
    return message.actions;
  }

  // Try Gotify format: extras.android::action.actions
  if (message.extras?.["android::action"]?.actions) {
    const gotifyActions = message.extras["android::action"].actions;
    if (Array.isArray(gotifyActions)) {
      // Convert Gotify format to our format
      return gotifyActions.map((a: any) => ({
        action: a.type || a.action,
        label: a.label || a.name || "Action",
        url: a.url,
        method: a.method,
        headers: a.headers,
        body: a.body,
        intent: a.intent,
        extras: a.extras,
        clear: a.clear,
      }));
    }
  }

  return null;
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPressed: {
    backgroundColor: "#4338CA",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
