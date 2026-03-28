import React, { useState } from "react";
import { View, Text, ActivityIndicator, Platform, Linking } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
// IntentLauncherParams type for extras
type IntentExtras = Record<string, string | number | boolean>;
import Toast from "react-native-toast-message";
import { AnimatedPressable } from "./design/AnimatedPressable";
import type { MessageResponse, MessageAction } from "../api/types";

interface MessageActionsProps {
  message: MessageResponse;
}

function parseActions(message: MessageResponse): MessageAction[] | null {
  // First try direct actions field
  if (message.actions && Array.isArray(message.actions)) {
    return message.actions;
  }

  // Gotify compat: extras["android::action"].actions
  const androidAction = message.extras?.["android::action"] as
    | { actions?: unknown[] }
    | undefined;
  if (androidAction?.actions && Array.isArray(androidAction.actions)) {
    return androidAction.actions.map((a: unknown) => {
      const raw = a as Record<string, unknown>;
      return {
        action: (raw.type ?? raw.action) as "view" | "http" | "broadcast",
        label: (raw.label ?? raw.name ?? "Action") as string,
        url: raw.url as string | undefined,
        method: raw.method as string | undefined,
        headers: raw.headers as Record<string, string> | undefined,
        body: raw.body as string | undefined,
        intent: raw.intent as string | undefined,
        extras: raw.extras as Record<string, unknown> | undefined,
        clear: raw.clear as boolean | undefined,
      };
    });
  }

  return null;
}

function getActionClasses(type: "view" | "http" | "broadcast"): {
  button: string;
  text: string;
} {
  switch (type) {
    case "view":
      return { button: "bg-primary/10 border border-primary/30 rounded-md px-4 py-2 min-w-[80px] items-center justify-center", text: "text-primary text-sm font-semibold" };
    case "http":
      return { button: "bg-success/10 border border-success/30 rounded-md px-4 py-2 min-w-[80px] items-center justify-center", text: "text-success text-sm font-semibold" };
    case "broadcast":
      return { button: "bg-accent/10 border border-accent/30 rounded-md px-4 py-2 min-w-[80px] items-center justify-center", text: "text-accent text-sm font-semibold" };
  }
}

export const MessageActions = React.memo(function MessageActions({ message }: MessageActionsProps) {
  const [executing, setExecuting] = useState<string | null>(null);

  const actions = parseActions(message);
  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: MessageAction, index: number) => {
    setExecuting(`${index}`);

    try {
      if (action.action === "view") {
        if (!action.url) throw new Error("No URL provided for view action");

        const supported = await Linking.canOpenURL(action.url);
        if (supported) {
          await Linking.openURL(action.url);
          Toast.show({ type: "success", text1: "Opened", text2: action.label, position: "bottom" });
        } else {
          throw new Error("Cannot open this URL");
        }
      } else if (action.action === "http") {
        if (!action.url) throw new Error("No URL provided for HTTP action");

        const response = await fetch(action.url, {
          method: action.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...action.headers,
          },
          body: action.body,
        });

        if (response.ok) {
          Toast.show({ type: "success", text1: "Success", text2: `${action.label} completed`, position: "bottom" });
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (action.action === "broadcast") {
        if (Platform.OS === "android") {
          // Use the intent field as the Android action string, falling back to a generic main action
          const intentAction = action.intent ?? "android.intent.action.MAIN";
          await IntentLauncher.startActivityAsync(intentAction, {
            extra: action.extras as IntentExtras | undefined,
          });
          Toast.show({ type: "success", text1: "Broadcast Sent", text2: action.label, position: "bottom" });
        } else {
          Toast.show({ type: "info", text1: "iOS Not Supported", text2: "Broadcast actions are Android only", position: "bottom" });
        }
      }
    } catch (err) {
      console.error("Action execution failed:", err);
      Toast.show({
        type: "error",
        text1: "Action Failed",
        text2: err instanceof Error ? err.message : "Unknown error",
        position: "bottom",
      });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <View className="flex-row flex-wrap gap-2 mt-3">
      {actions.slice(0, 3).map((action, index) => {
        const classes = getActionClasses(action.action);
        const isExecuting = executing === `${index}`;
        return (
          <AnimatedPressable
            key={index}
            className={classes.button}
            onPress={() => handleAction(action, index)}
            disabled={executing !== null}
            haptic={false}
            style={isExecuting ? { opacity: 0.5 } : undefined}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            accessibilityHint={
              action.action === "view"
                ? "Opens URL in browser"
                : action.action === "http"
                  ? "Sends HTTP request"
                  : "Sends Android broadcast"
            }
          >
            {isExecuting ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Text className={classes.text}>{action.label}</Text>
            )}
          </AnimatedPressable>
        );
      })}
    </View>
  );
});
