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
 * Strip markdown syntax so notification body reads as clean plain text.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/__(.+?)__/g, "$1") // bold alt
    .replace(/_(.+?)_/g, "$1") // italic alt
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // inline/block code
    .replace(/^\s*[-*+]\s+/gm, "• ") // list items
    .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .replace(/^\|.*\|$/gm, (line) => // table rows → space-separated
      line.replace(/\|/g, " ").replace(/[-:]+/g, "").trim()
    )
    .replace(/\n{3,}/g, "\n\n") // collapse blank lines
    .trim();
}

/**
 * Show a local notification for a message received via WebSocket.
 * Fires in all app states so the user always sees Android notifications.
 */
export async function showMessageNotification(msg: MessageResponse) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title || "New Message",
      body: stripMarkdown(msg.message),
      data: { messageId: msg.id, clickUrl: msg.click_url },
      ...(Platform.OS === "android" && {
        channelId: getChannelForPriority(msg.priority),
      }),
    },
    trigger: null,
  });
}
