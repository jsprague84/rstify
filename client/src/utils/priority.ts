export const PRIORITY_BORDER_COLORS: Record<string, string> = {
  low: "#94a3b8", // slate-400
  medium: "#2563eb", // primary
  high: "#f59e0b", // warning
  critical: "#ef4444", // error
};

export function getPriorityLevel(priority: number): string {
  if (priority >= 8) return "critical";
  if (priority >= 6) return "high";
  if (priority >= 4) return "medium";
  return "low";
}

export function getPriorityColorHex(priority: number): string {
  if (priority <= 3) return "#6b7280";
  if (priority <= 5) return "#3b82f6";
  if (priority <= 7) return "#f59e0b";
  return "#ef4444";
}
