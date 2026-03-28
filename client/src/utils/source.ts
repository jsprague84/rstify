import type { MessageResponse } from "../api/types";

export function getSourceId(msg: MessageResponse): string {
  if (msg.topic) {
    return `topic:${msg.topic}`;
  }
  return `app:${msg.appid ?? 0}`;
}
