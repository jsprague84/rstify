import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { MessageResponse } from "../api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializeNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("high", {
      name: "High Priority",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("low", {
      name: "Low Priority",
      importance: Notifications.AndroidImportance.LOW,
    });
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Get the native FCM/APNs device push token.
 * Returns null on emulators or if permissions are denied.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return data;
  } catch (e) {
    console.warn("Failed to get device push token:", e);
    return null;
  }
}

function getChannelForPriority(priority: number): string {
  if (priority >= 8) return "high";
  if (priority >= 4) return "default";
  return "low";
}

/**
 * Show a local notification for a message received via WebSocket.
 * Fires in all app states so the user always sees Android notifications.
 */
export async function showMessageNotification(msg: MessageResponse) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title || "New Message",
      body: msg.message,
      data: { messageId: msg.id, clickUrl: msg.click_url },
      ...(Platform.OS === "android" && {
        channelId: getChannelForPriority(msg.priority),
      }),
    },
    trigger: null,
  });
}
